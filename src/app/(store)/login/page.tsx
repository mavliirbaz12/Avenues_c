import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginMethods } from "@/components/auth/login-methods";
import { getCurrentUser } from "@/lib/auth-guards";
import { integrations } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to track orders, save addresses and keep a wishlist.",
  robots: { index: false, follow: true },
};

const ERRORS: Record<string, string> = {
  CredentialsSignin: "That email and password don't match.",
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with it instead.",
  AccessDenied: "That account can't sign in.",
};

/** Only allow same-origin relative paths, so ?next= can't be an open redirect. */
function safeNext(raw: string | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);

  const next = safeNext(one("next"));
  const user = await getCurrentUser();
  if (user) redirect(next);

  const errorCode = one("error");

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      intro="Your orders, addresses and wishlist, waiting where you left them."
      footer={
        <>
          New here?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="text-gold transition-colors hover:text-gold-light"
          >
            Create an account
          </Link>
          <span className="mt-3 block text-xs text-stone-dark">
            Buying as a guest? You don&rsquo;t need an account —{" "}
            <Link href="/shop" className="underline underline-offset-4 hover:text-gold-light">
              carry on shopping
            </Link>
            .
          </span>
        </>
      }
    >
      <LoginMethods
        smsLive={integrations.sms}
        next={next}
        initialError={errorCode ? (ERRORS[errorCode] ?? "Something went wrong signing in.") : undefined}
      />
    </AuthShell>
  );
}
