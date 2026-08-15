import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-nav";
import { getCurrentUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s · Account · Avenues" },
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Reads the session but deliberately does NOT redirect.
  //
  // It used to call `requireUser("/account")`. Because a layout renders before
  // its page, that redirect always won the race — so a guest deep-linking to
  // /account/orders was sent to /login?next=/account and, after signing in,
  // landed on the account home instead of the page they asked for.
  //
  // Enforcement lives on the pages instead, each of which already calls
  // requireUser() with its own path. INVARIANT: every page under /account must
  // do so. If this layout renders with a null user, the page's own redirect is
  // already in flight and this output is discarded.
  //
  // Guarding here rather than in middleware at all is deliberate: bcrypt isn't
  // edge-compatible, so the full auth config in middleware would drag the app
  // onto the Node runtime. See src/lib/auth-guards.ts.
  const user = await getCurrentUser();

  return (
    <div className="shell py-12 sm:py-16">
      <header>
        <p className="micro-label-gold">Your account</p>
        <h1 className="mt-4 font-display text-d3 font-light text-bone">
          {user?.name ?? "Welcome back"}
        </h1>
        <p className="mt-2 font-sans text-sm text-stone">
          {/* Phone-OTP accounts may not have an email yet. */}
          {user?.email ?? "Signed in by phone"}
        </p>
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
