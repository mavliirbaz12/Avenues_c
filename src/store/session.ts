"use client";

import { create } from "zustand";

/**
 * Who is signed in, resolved on the client.
 *
 * WHY THIS EXISTS — it is the difference between a cached storefront and one
 * that server-renders every request.
 *
 * The store layout used to `await getCurrentUser()` so it could pass
 * `isAuthed` and a first name into the nav. Reading the session cookie is a
 * dynamic API, and one dynamic call in a layout opts the ENTIRE route group out
 * of static generation — so /, /shop, /sets and every product page were built
 * fresh on every single visit. The homepage declared `revalidate = 3600` and it
 * never once applied; production answered `Cache-Control: private, no-cache,
 * no-store` and `X-Vercel-Cache: MISS` to every request, at 1.3-3.1s a load.
 * next.config.ts even documented the symptom ("every route here is dynamic")
 * and treated it as a fact of life rather than a consequence.
 *
 * Moving the read here lets the HTML be cached at the edge for everyone, and
 * costs one small fetch after hydration.
 *
 * THE TRADE, stated plainly: a signed-in visitor sees the logged-out nav for
 * the few hundred ms before this resolves. That is the standard bargain for
 * cached commerce HTML and it is the right one here — the alternative is every
 * visitor, signed in or not, waiting on a server render. `status` is exposed so
 * components can render a neutral state rather than flashing "Login" at
 * someone who is already signed in.
 */

export type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionState = {
  status: SessionStatus;
  name: string | null;
  /** Convenience for the common check. False while still loading. */
  isAuthed: boolean;
  /** First word of the name, for the nav's account label. */
  firstName: string | null;
  /** Probe once per page load. Subsequent calls are no-ops. */
  load: () => Promise<void>;
  /**
   * Re-probe after the session has actually changed — sign-in, sign-out.
   *
   * `load()` deliberately runs once, which is right for mounting components
   * and wrong for an auth transition. Signing in uses router.push(), a CLIENT
   * navigation: the JS context survives, so without this the store keeps the
   * "anonymous" it resolved on /login and the nav still says Login until a hard
   * reload. Every signIn/signOut call site must call this.
   */
  refresh: () => Promise<void>;
};

let inflight: Promise<void> | null = null;

export const useSession = create<SessionState>()((set, get) => ({
  status: "loading",
  name: null,
  isAuthed: false,
  firstName: null,

  /**
   * Fetches once per page load and dedupes concurrent callers.
   *
   * The nav, the drawer and the cart-merge sync all want this, and all three
   * mount together — without the guard that is three requests for one answer
   * on every navigation.
   */
  load: async () => {
    if (get().status !== "loading") return;
    return get().refresh();
  },

  refresh: async () => {
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        // NextAuth's own endpoint; already mounted at api/auth/[...nextauth].
        // `same-origin` credentials so the session cookie actually goes.
        const res = await fetch("/api/auth/session", {
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          set({ status: "anonymous", name: null, isAuthed: false, firstName: null });
          return;
        }
        // An anonymous visitor gets `{}` or `null`, not an error.
        const data = (await res.json()) as { user?: { name?: string | null } } | null;
        const user = data?.user;
        if (!user) {
          set({ status: "anonymous", name: null, isAuthed: false, firstName: null });
          return;
        }
        const name = user.name ?? null;
        set({
          status: "authenticated",
          name,
          isAuthed: true,
          firstName: name?.trim().split(/\s+/)[0] ?? null,
        });
      } catch {
        // A failed probe must not leave the nav stuck in a loading state
        // forever — degrade to the signed-out view, which is still usable.
        set({ status: "anonymous", name: null, isAuthed: false, firstName: null });
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },
}));
