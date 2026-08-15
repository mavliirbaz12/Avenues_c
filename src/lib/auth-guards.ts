import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Route guards for server components.
 *
 * Enforcement lives here rather than in middleware on purpose: bcrypt (used by
 * the credentials provider) is not edge-compatible, and running the full auth
 * config in middleware would force the whole thing onto the Node runtime
 * anyway. Guarding in the layout keeps the check next to the data it protects.
 */

/**
 * Request-scoped memo. Without it the JWT is decoded once per caller, and the
 * callers stack up: on /account/orders it ran three times (store layout,
 * account layout, then the page itself). `cache()` collapses those to one
 * decode per request without any caller needing to thread the user down.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

/** Redirects to sign-in, preserving where the user was headed. */
export async function requireUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin(returnTo = "/admin") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  // A signed-in customer who guesses the URL gets a 404, not a redirect loop
  // and not an "access denied" page that confirms /admin exists.
  if (user.role !== "ADMIN") redirect("/not-found");
  return user;
}
