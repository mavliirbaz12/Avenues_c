import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { env } from "./env";
import { normalisePhone } from "./sms";
import { claimGuestOrders, claimGuestOrdersByPhone } from "./commerce/claim-orders";

/**
 * Auth.js v5.
 *
 * Session strategy is JWT because the credentials provider cannot use database
 * sessions. The Prisma adapter stays wired up: it owns the User rows both
 * providers resolve against, and keeps the door open for an OAuth provider
 * later without a migration.
 *
 * Two ways in, both first-party: email + password, and a phone OTP. There is
 * deliberately no social login — see the note above the providers array.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;

      const email = parsed.data.email.toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });

      // Compare against a dummy hash when the account doesn't exist or is
      // OAuth-only, so response time doesn't reveal whether an email is
      // registered.
      const hash =
        user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
      const ok = await bcrypt.compare(parsed.data.password, hash);

      if (!user || !user.passwordHash || !ok) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  }),

  Credentials({
    id: "phone-otp",
    name: "Phone",
    credentials: {
      phone: { label: "Phone", type: "tel" },
      code: { label: "One-time code", type: "text" },
    },
    /**
     * Verifies the code issued by requestLoginOtp() and finds-or-creates the
     * account. Attempts are counted per code and capped at 5; success
     * consumes the code so it can never be replayed.
     */
    async authorize(raw) {
      const phone = normalisePhone(String(raw?.phone ?? ""));
      const code = String(raw?.code ?? "").replace(/\D/g, "");
      if (!phone || code.length !== 6) return null;

      const otp = await prisma.phoneOtp.findFirst({
        where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!otp || otp.attempts >= 5) return null;

      const hash = createHash("sha256").update(code).digest("hex");
      if (hash !== otp.codeHash) {
        await prisma.phoneOtp.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } },
        });
        return null;
      }

      await prisma.phoneOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });

      const user = await prisma.user.upsert({
        where: { phone },
        update: {},
        create: { phone, role: "CUSTOMER" },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        phone: user.phone,
      };
    },
  }),
];

// Google sign-in is deliberately not offered. Customers sign in with email +
// password or with a phone OTP.
//
// The provider is left out entirely rather than merely hidden: registering it
// keeps /api/auth/signin/google live, so anyone hitting that URL directly
// would start an OAuth flow with no button to explain it and no supported
// account-linking path behind it.
//
// To re-enable, restore the Google provider here and the GoogleButton in
// auth-shell.tsx, and register the callback URL in Google Cloud Console as
// <site>/api/auth/callback/google — note the order of those last two segments.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
      }

      // Re-read the role when the client calls useSession().update(), so an
      // admin promotion takes effect without a full sign-out.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, name: true, image: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.name = fresh.name;
          token.picture = fresh.image;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CUSTOMER" | "ADMIN") ?? "CUSTOMER";
      }
      return session;
    },
  },

  events: {
    /**
     * A guest can check out with just contact details. When someone later
     * authenticates with that same email (password/Google) or phone (OTP),
     * their past guest orders attach to the account, so history and tracking
     * simply work.
     */
    async signIn({ user }) {
      if (!user?.id) return;
      if (user.email) {
        await claimGuestOrders(user.id, user.email).catch((err) =>
          console.error("[auth] claiming guest orders failed:", err),
        );
      }
      const phone = (user as { phone?: string | null }).phone;
      if (phone) {
        await claimGuestOrdersByPhone(user.id, phone).catch((err) =>
          console.error("[auth] claiming guest orders by phone failed:", err),
        );
      }
    },
  },
});
