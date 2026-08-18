import { unstable_cache } from "next/cache";

/**
 * Cross-request caching for data that only an admin can change.
 *
 * WHY THIS EXISTS
 *
 * The catalogue reads were wrapped in React's `cache()`, which is a
 * PER-REQUEST memo. It correctly stops the nav and the footer running the same
 * product query twice inside one render, and it does nothing at all between
 * navigations — every click re-ran every query against Postgres.
 *
 * Two of those queries sit in the storefront layout, so they ran on every page
 * of the site including the ones with no data of their own. `/about` measured
 * ~600ms warm while rendering nothing but static copy; that was a settings row
 * and a product list being fetched to draw a nav that had not changed.
 *
 * `unstable_cache` is the cross-request equivalent. The catalogue changes when
 * an admin saves a product, which is rare and — importantly — observable, so
 * the cache can be invalidated precisely rather than guessed at with a short
 * TTL.
 *
 * WHY THERE IS STILL A TTL
 *
 * Tag invalidation is the mechanism; the TTL is the backstop. If a future
 * admin action forgets to call `revalidateCatalog()`, a stale nav should
 * correct itself in minutes rather than persist until the next deploy. Five
 * minutes is short enough that nobody files a bug and long enough that it is
 * not doing the real work.
 *
 * WHAT MUST NOT GO IN HERE
 *
 * Anything per-user or per-request. `unstable_cache` shares its entry across
 * every visitor, so a function that reads `cookies()`, `headers()` or the
 * session would serve one customer's data to another. Cart, orders, addresses
 * and auth all stay uncached.
 */

/** Products, variants, images, combos — everything an admin edits in Catalogue. */
export const CATALOG_TAG = "catalog";

/** Store settings: shipping, COD, contact channels, hero media. */
export const SETTINGS_TAG = "settings";

/** Backstop only. Correctness comes from the tags below. */
const TTL_SECONDS = 300;

/**
 * Wraps a catalogue read.
 *
 * `keyParts` must include every argument the function varies on. Getting this
 * wrong is the one genuinely dangerous mistake available here: a `getProduct`
 * cached under a key that omits the slug would serve the wrong fragrance to
 * everyone. Functions that take no arguments pass their own name and nothing
 * else.
 */
export function cachedCatalog<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
) {
  return unstable_cache(fn, keyParts, {
    tags: [CATALOG_TAG],
    revalidate: TTL_SECONDS,
  });
}

/** Wraps a store-settings read. Same rules as above. */
export function cachedSettings<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
) {
  return unstable_cache(fn, keyParts, {
    tags: [SETTINGS_TAG],
    revalidate: TTL_SECONDS,
  });
}
