import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { FeaturedCollection } from "@/components/landing/featured-collection";
import { NotesStory } from "@/components/landing/notes-story";
import { BrandStory } from "@/components/landing/brand-story";
import { SocialStrip } from "@/components/landing/social-strip";
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

export default async function HomePage() {
  const [products, settings] = await Promise.all([
    getFeaturedProductCards(5),
    getStoreSettings(),
  ]);

  return (
    <>
      <Hero />

      <FeaturedCollection
        products={products}
        eyebrow="The signature five"
        title="Five fragrances, and no filler"
        subtitle="Each one built around a single idea, and finished only when it lasted a full day on skin."
      />

      <NotesStory />

      <BrandStory />

      <SocialStrip instagramUrl={settings.instagramUrl} />
    </>
  );
}
