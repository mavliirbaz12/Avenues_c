import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Hero } from "@/components/landing/hero";
import { LazyBottleReveal } from "@/components/landing/lazy-bottle-reveal";
import {
  getFeaturedProductCards,
  getComboCards,
  getHomeReviews,
} from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";

const FeaturedSlider = dynamic(
  () => import("@/components/landing/featured-slider").then((m) => m.FeaturedSlider),
);
const BrandBanner = dynamic(
  () => import("@/components/landing/brand-banner").then((m) => m.BrandBanner),
);
const NotesStory = dynamic(
  () => import("@/components/landing/notes-story").then((m) => m.NotesStory),
);
const CollectionGrid = dynamic(
  () => import("@/components/landing/collection-grid").then((m) => m.CollectionGrid),
);
const ComboBand = dynamic(
  () => import("@/components/landing/combo-band").then((m) => m.ComboBand),
);
const ComboStrip = dynamic(
  () => import("@/components/landing/combo-strip").then((m) => m.ComboStrip),
);
const BrandStory = dynamic(
  () => import("@/components/landing/brand-story").then((m) => m.BrandStory),
);
const ReviewsStrip = dynamic(
  () => import("@/components/landing/reviews-strip").then((m) => m.ReviewsStrip),
);

/**
 * Static, and deliberately says nothing about how many or what size.
 *
 * This used to build the description from the live catalogue — "Five eau de
 * parfum fragrances… 50ml, eight to ten hours of wear" — on the reasoning that
 * reading it live beat hardcoding it. Reading it live fixed staleness and left
 * two worse problems: `sizeLabel` joins every size with " & ", so a shop with
 * three sizes described itself as "20ml & 50ml & 100ml" in search results; and
 * a description that counts the catalogue advertises a small one.
 *
 * What is left is what stays true at any size of shop, and what someone
 * searching actually wants to know.
 */
export const metadata: Metadata = {
  title: "Avenues — Eau de parfum, made in India",
  description:
    "Eau de parfum built for Indian weather. Eight to ten hours of wear from two sprays, cash on delivery across India.",
  alternates: { canonical: siteUrl },
};

// The catalogue changes only when an admin edits it, so serve this from cache
// and revalidate hourly. Admin mutations call revalidatePath to push through.
export const revalidate = 3600;

/**
 * Landing page.
 *
 * Section rhythm: emotional intro → one fragrance in detail → brand conviction
 * → note education → transact → story. The statement band and the note
 * education deliberately sit between the two product sections, so the page
 * never shows product imagery twice in a row — with five SKUs that is the
 * difference between an editorial page and a padded one.
 *
 * The email capture lives in the footer, which follows immediately; a second
 * newsletter form a screen above it would be the clearest template tell here.
 */
export default async function HomePage() {
  const [products, settings, sets, reviews] = await Promise.all([
    // Guarded like the layout and footer queries. This page is prerendered at
    // build time, so an unreachable database used to fail `next build`
    // outright — a transient blip during deploy should not take the whole
    // release down. The product sections each render nothing on an empty
    // array, so the hero, statement band and story still ship.
    getFeaturedProductCards(5).catch((err) => {
      console.error("[home] featured products unavailable:", err);
      return [];
    }),
    getStoreSettings(),
    // Same guard: no set, or an unreachable database, simply means the band
    // does not render.
    // Every set, not just the featured one. The page shows a band when there
    // is exactly one and a rail from two, so a shop that grows to four boxes
    // advertises four instead of hiding three behind /sets.
    getComboCards().catch((err) => {
      console.error("[home] gift sets unavailable:", err);
      return [];
    }),
    // Guarded like the rest: no reviews, or an unreachable database, simply
    // means the strip does not render.
    getHomeReviews().catch((err) => {
      console.error("[home] reviews unavailable:", err);
      return [];
    }),
  ]);

  return (
    <>
      <Hero
        videoUrl={settings.heroVideoUrl}
        posterUrl={settings.heroPosterUrl}
        // The range photograph sits beside the headline. It doubles as the
        // brand banner further down, which is deliberate: one hero image is
        // cheaper than two and the repeat reads as a motif, not a mistake.
        showcaseUrl={settings.brandBannerUrl}
      />
      <LazyBottleReveal />
      <FeaturedSlider products={products} />
      {/*
        No photograph behind the mantra.

        The same shot is now the hero, and repeating it a screen later added
        nothing — it also rendered badly here: contained inside a full-width
        band it sat left with a void beside it, and the two lines of display
        type landed on top of the bottles rather than on quiet ground.

        The band falls back to its designed treatment — grain and a low gold
        radial — which is what the words want behind them. `brandBannerUrl`
        still drives the hero showcase above.
      */}
      <BrandBanner imageUrl={null} />
      <NotesStory products={products} />
      {/* One set is a statement; several are a choice, and a rail of one is a
          design failure. /sets makes the same switch at the same threshold. */}
      {sets.length === 1 ? <ComboBand set={sets[0]!} /> : <ComboStrip sets={sets} />}
      <CollectionGrid products={products} />
      {/* Social proof after the range and before the story: someone who has
          just seen the products is at the point of doubt, and this is the only
          section on the page the brand does not write itself. */}
      <ReviewsStrip reviews={reviews} />
      <BrandStory />
    </>
  );
}
