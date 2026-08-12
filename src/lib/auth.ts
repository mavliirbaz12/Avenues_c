import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { env, integrations } from "./env";
import { claimGuestOrders } from "./commerce/claim-orders";

/**
 * Auth.js v5.
 *
 * Session strategy is JWT because the credentials provider cannot use database
 * sessions. The Prisma adapter is still wired up so Google accounts get proper
 * User/Account rows and can be linked.
 *
 * The Google provider is only registered when both halves of the key pair are
 * present — the sign-in page checks the same flag, so an unconfigured OAuth
 * never renders a button that leads to a broken callback.
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
];

if (integrations.google) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

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
     * A guest can check out with just an email. When someone later signs up or
     * signs in with that same address, their past orders are attached to the
     * account so the order history is not empty and tracking just works.
     */
    async signIn({ user }) {
      if (user?.id && user.email) {
        await claimGuestOrders(user.id, user.email).catch((err) =>
          console.error("[auth] claiming guest orders failed:", err),
        );
      }
    },
  },
});
