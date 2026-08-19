import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Hero } from "@/components/landing/hero";
import { LazyBottleReveal } from "@/components/landing/lazy-bottle-reveal";
import {
  getFeaturedProductCards,
  getFeaturedCombo,
  getCatalogueSummary,
  spellCount,
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
const BrandStory = dynamic(
  () => import("@/components/landing/brand-story").then((m) => m.BrandStory),
);

/**
 * Built from the catalogue rather than asserted.
 *
 * A static description saying "Five fragrances" is the same bug as the on-page
 * copy: it goes stale silently the day a sixth is added, and search engines
 * keep repeating it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { count, sizeLabel } = await getCatalogueSummary().catch(() => ({
    count: 0,
    sizeLabel: "",
  }));

  const range = count > 0 ? `${spellCount(count)} eau de parfum fragrances` : "Eau de parfum";
  const size = sizeLabel ? `${sizeLabel}, ` : "";

  return {
    title: "Avenues — Eau de parfum, made in India",
    description: `${range} built for Indian weather and long days. ${size}eight to ten hours of wear, cash on delivery available.`,
    alternates: { canonical: siteUrl },
  };
}

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
  const [products, settings, featuredSet, summary] = await Promise.all([
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
    getFeaturedCombo().catch((err) => {
      console.error("[home] featured combo unavailable:", err);
      return null;
    }),
    // How many fragrances and in which sizes — read, never asserted.
    getCatalogueSummary().catch((err) => {
      console.error("[home] catalogue summary unavailable:", err);
      return { count: 0, sizeLabel: "", sizes: [] as string[] };
    }),
  ]);

  const countWord = spellCount(summary.count);

  return (
    <>
      <Hero
        videoUrl={settings.heroVideoUrl}
        posterUrl={settings.heroPosterUrl}
        // The range photograph sits beside the headline. It doubles as the
        // brand banner further down, which is deliberate: one hero image is
        // cheaper than two and the repeat reads as a motif, not a mistake.
        showcaseUrl={settings.brandBannerUrl}
        count={summary.count}
        countWord={countWord}
        sizeLabel={summary.sizeLabel}
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
      <BrandBanner imageUrl={null} count={summary.count} sizeLabel={summary.sizeLabel} />
      <NotesStory products={products} />
      <ComboBand set={featuredSet} />
      <CollectionGrid products={products} countWord={countWord} />
      <BrandStory />
    </>
  );
}
