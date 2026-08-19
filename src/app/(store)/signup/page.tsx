import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/auth-guards";
import { safeNext } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an Avenues account to track orders and save your addresses.",
  robots: { index: false, follow: true },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeNext(raw);

  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <AuthShell
      eyebrow="First time"
      title="Create an account"
      intro="Track every order, keep your addresses on file, and save what you're still deciding between."
      footer={
        <>
          Already have one?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-gold transition-colors hover:text-gold-light"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
