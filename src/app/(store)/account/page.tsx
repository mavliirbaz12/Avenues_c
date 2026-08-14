import type { Metadata } from "next";
import { ProfileForm, PasswordForm } from "@/components/account/profile-forms";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser("/account");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true, phone: true, passwordHash: true, createdAt: true },
  });

  if (!user) return null;

  return (
    <div className="space-y-12">
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="font-display text-d5 font-light text-bone">
          Your details
        </h2>
        <p className="mt-2 font-sans text-sm text-stone">
          Used on invoices and for delivery updates.
        </p>
        <div className="mt-7">
          <ProfileForm
            defaults={{
              name: user.name ?? "",
              // Phone-OTP accounts have no email yet; the form shows the
              // field empty and read-only either way.
              email: user.email ?? "",
              phone: user.phone ?? "",
            }}
          />
        </div>
      </section>

      <div className="rule" />

      <section aria-labelledby="password-heading">
        <h2 id="password-heading" className="font-display text-d5 font-light text-bone">
          Password
        </h2>
        {user.passwordHash ? (
          <>
            <p className="mt-2 font-sans text-sm text-stone">
              Changing it signs you out of nothing else — but pick something you
              haven&rsquo;t used elsewhere.
            </p>
            <div className="mt-7">
              <PasswordForm />
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-prose2 font-sans text-sm leading-relaxed text-stone">
            You sign in with Google, so there is no password on this account. If
            you would like one, use{" "}
            <a
              href="/forgot-password"
              className="text-gold underline underline-offset-4 hover:text-gold-light"
            >
              forgot password
            </a>{" "}
            to set it.
          </p>
        )}
      </section>
    </div>
  );
}
