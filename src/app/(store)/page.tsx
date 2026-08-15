import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { BottleReveal } from "@/components/landing/bottle-reveal";
import { FeaturedSlider } from "@/components/landing/featured-slider";
import { BrandBanner } from "@/components/landing/brand-banner";
import { NotesStory } from "@/components/landing/notes-story";
import { CollectionGrid } from "@/components/landing/collection-grid";
import { BrandStory } from "@/components/landing/brand-story";
import { getFeaturedProductCards } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Avenues — Eau de parfum, made in India",
  description:
    "Five eau de parfum fragrances built for Indian weather and long days. 50ml, eight to ten hours of wear, cash on delivery available.",
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
  const [products, settings] = await Promise.all([
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
  ]);

  return (
    <>
      <Hero videoUrl={settings.heroVideoUrl} posterUrl={settings.heroPosterUrl} />
      <BottleReveal />
      <FeaturedSlider products={products} />
      <BrandBanner imageUrl={settings.brandBannerUrl} />
      <NotesStory products={products} />
      <CollectionGrid products={products} />
      <BrandStory />
    </>
  );
}
