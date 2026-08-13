import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s · Account · Avenues" },
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Guard lives here rather than in middleware: bcrypt isn't edge-compatible,
  // so running the full auth config in middleware would drag the whole app
  // onto the Node runtime. See src/lib/auth-guards.ts.
  const user = await requireUser("/account");

  return (
    <div className="shell py-12 sm:py-16">
      <header>
        <p className="micro-label-gold">Your account</p>
        <h1 className="mt-4 font-display text-d3 font-light text-bone">
          {user.name ?? "Welcome back"}
        </h1>
        <p className="mt-2 font-sans text-sm text-stone">{user.email}</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-3">
          <AccountNav />
        </div>
        <div className="min-w-0 lg:col-span-9">{children}</div>
      </div>
    </div>
  );
}
