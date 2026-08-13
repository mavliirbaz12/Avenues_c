import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? "";

  if (!token) {
    return (
      <AuthShell
        eyebrow="Reset password"
        title="That link is incomplete"
        intro="Open the link straight from the email, or ask for a new one."
        footer={
          <Link
            href="/forgot-password"
            className="text-gold transition-colors hover:text-gold-light"
          >
            Send a new link
          </Link>
        }
      >
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Almost there"
      title="Choose a new password"
      intro="Pick something you haven't used elsewhere. Signing in again everywhere else will be required."
      footer={
        <Link href="/login" className="text-gold transition-colors hover:text-gold-light">
          Back to sign in
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
