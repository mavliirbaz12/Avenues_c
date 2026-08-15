import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import { getRelatedProductCards } from "@/lib/catalog";
import { siteUrl } from "@/lib/env";
import { ProductGallery } from "@/components/product/product-gallery";
import { BuyBox } from "@/components/product/buy-box";
import { NotePyramid } from "@/components/product/note-pyramid";
import { DetailAccordion } from "@/components/product/detail-accordion";
import { LegalMetrology } from "@/components/product/legal-metrology";
import { FeaturedCollection } from "@/components/landing/featured-collection";
import { ProductReviews } from "@/components/product/product-reviews";
import { GoldArc } from "@/components/brand/gold-arc";
import { Reveal } from "@/components/motion/reveal";
import { Sparkle } from "@/components/brand/sparkle";

// Dynamic, not ISR: the reviews band reads the session (to offer the right
// form state) and the buy box shows live stock — both want fresh renders.
export const dynamic = "force-dynamic";

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  highlight: true,
  description: true,
  concentration: true,
  gender: true,
  notesTop: true,
  notesHeart: true,
  notesBase: true,
  occasions: true,
  whyChoose: true,
  howToUse: true,
  caution: true,
  sensoryNarrative: true,
  bestFor: true,
  longevity: true,
  countryOfOrigin: true,
  avgRating: true,
  reviewCount: true,
  metaTitle: true,
  metaDescription: true,
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }] as const,
    select: { id: true, size: true, sku: true, mrpPaise: true, pricePaise: true, stock: true },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }] as const,
    select: { url: true, alt: true },
  },
  // `satisfies` rather than `as const`: the latter makes the nested orderBy
  // arrays readonly, which Prisma's generated input types reject.
} satisfies Prisma.ProductSelect;

/**
 * Memoized because both `generateMetadata` and the page body need the full
 * product, and Next runs them as separate calls in the same request. React's
 * fetch dedupe does not cover raw Prisma calls, so without `cache()` every PDP
 * view queried this row twice.
 */
const getProduct = cache(async (slug: string) => {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    select: detailSelect,
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  // notFound(), not a "Fragrance not found" title. Returning metadata here
  // let Next commit a 200 head and start streaming before the page body's own
  // notFound() ran, so an unknown slug served the 404 UI with a 200 status —
  // which Google would happily index as a real page. Bailing during metadata
  // generation is what actually sets the status.
  if (!product) notFound();

  const url = `${siteUrl}/fragrance/${product.slug}`;
  const title = product.metaTitle ?? `${product.name} — ${product.tagline}`;
  const description =
    product.metaDescription ?? `${product.highlight} ${product.concentration}, 50ml.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProduct(slug), getStoreSettings()]);

  if (!product) notFound();

  const related = await getRelatedProductCards(
    { id: product.id, gender: product.gender },
    3,
  );

  const primary = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;
  const inStock = product.variants.some((v) => v.stock > 0);
  const shortName = product.name.replace(/^Avenues\s+/i, "");

  // Product JSON-LD. AggregateRating is omitted entirely when there are no
  // reviews — Google penalises a rating of 0 with 0 votes.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: primary?.sku,
    brand: { "@type": "Brand", name: "Avenues" },
    category: "Beauty/Fragrance/Eau de Parfum",
    countryOfOrigin: product.countryOfOrigin,
    ...(product.images[0] ? { image: [`${siteUrl}${product.images[0].url}`] } : {}),
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avgRating.toFixed(1),
            reviewCount: product.reviewCount,
          },
        }
      : {}),
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      url: `${siteUrl}/fragrance/${product.slug}`,
      priceCurrency: "INR",
      price: (v.pricePaise / 100).toFixed(2),
      sku: v.sku,
      availability:
        v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: settings.manufacturerName },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="shell pt-8">
        <ol className="flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-label text-stone-dark">
          <li>
            <Link href="/" className="transition-colors hover:text-gold-light">
              Home
            </Link>
          </li>
          {/* Separators live inside <li>: an <ol> may only directly contain
              <li>, and a bare SVG between items breaks the list semantics so
              a screen reader stops announcing it as a breadcrumb at all. */}
          <li aria-hidden="true" className="flex items-center">
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </li>
          <li>
            <Link href="/shop" className="transition-colors hover:text-gold-light">
              Shop
            </Link>
          </li>
          {/* Separators live inside <li>: an <ol> may only directly contain
              <li>, and a bare SVG between items breaks the list semantics so
              a screen reader stops announcing it as a breadcrumb at all. */}
          <li aria-hidden="true" className="flex items-center">
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </li>
          <li aria-current="page" className="text-stone">
            {shortName}
          </li>
        </ol>
      </nav>

      {/* Gallery + buy box. The buy box pins on desktop so price and the call
          to action stay reachable through the whole page. */}
      <section className="shell grid gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14">
        <div>
          <ProductGallery slug={product.slug} name={product.name} images={product.images} />
        </div>

        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          <BuyBox
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              shortName,
              tagline: product.tagline,
              concentration: product.concentration,
              longevity: product.longevity,
              avgRating: product.avgRating,
              reviewCount: product.reviewCount,
            }}
            variants={product.variants}
            imageUrl={product.images[0]?.url ?? null}
            whatsappNumber={settings.whatsappNumber}
            codEnabled={settings.codEnabled}
            freeShippingThresholdPaise={settings.freeShippingThresholdPaise}
          />
        </div>
      </section>

      {/* Highlight line — the one-sentence promise, given a full band. */}
      <section className="border-y border-line bg-ink-deep py-16 grain">
        <Reveal className="shell relative z-[2] text-center">
          <Sparkle className="mx-auto h-3 w-3 text-gold" />
          <p className="mx-auto mt-6 max-w-3xl font-display text-d4 font-light italic text-bone">
            &ldquo;{product.highlight}&rdquo;
          </p>
        </Reveal>
      </section>

      {/* The pyramid */}
      <section className="py-section" aria-labelledby="notes-heading">
        <div className="shell">
          <Reveal className="text-center">
            <p className="micro-label-gold">The composition</p>
            <h2 id="notes-heading" className="mt-5 font-display text-d3 font-light text-bone">
              How {shortName} unfolds
            </h2>
            {/* The sensory lead-in. This is what keeps the page from reading
                as a spec sheet — the pyramid below is the structure, this is
                what it actually smells like. */}
            {product.sensoryNarrative ? (
              <p className="mx-auto mt-6 max-w-2xl font-sans text-body-lg leading-relaxed text-stone">
                {product.sensoryNarrative}
              </p>
            ) : (
              <p className="mx-auto mt-5 max-w-xl font-sans text-body-lg leading-relaxed text-stone">
                Three tiers, arriving in order. The heavier the note, the longer
                it stays with you.
              </p>
            )}
          </Reveal>

          <NotePyramid
            top={product.notesTop}
            heart={product.notesHeart}
            base={product.notesBase}
            className="mt-14"
          />

          {(product.occasions.length > 0 || product.bestFor) && (
            <Reveal className="mt-14 text-center">
              {product.bestFor && (
                <p className="mx-auto mb-8 max-w-xl font-display text-d5 font-light italic text-bone">
                  {product.bestFor}
                </p>
              )}
              {product.occasions.length > 0 && (
                <>
                  <p className="micro-label mb-4">Wear it for</p>
                  <ul className="flex flex-wrap items-center justify-center gap-2.5">
                    {product.occasions.map((o) => (
                      <li
                        key={o}
                        className="border border-line px-4 py-2 font-sans text-xs text-stone"
                      >
                        {o}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Reveal>
          )}
        </div>
      </section>

      {/* Story + why choose */}
      <section className="border-t border-line py-section">
        <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-6">
            <p className="micro-label-gold">The scent</p>
            <h2 className="mt-5 font-display text-d4 font-light text-bone">
              What you are actually buying
            </h2>
            <p className="mt-6 font-sans text-body-lg leading-relaxed text-stone">
              {product.description}
            </p>
          </Reveal>

          {product.whyChoose.length > 0 && (
            <Reveal delay={0.08} className="lg:col-span-6">
              <p className="micro-label mb-6">Why choose it</p>
              <ul className="space-y-5">
                {product.whyChoose.map((reason) => (
                  <li key={reason} className="flex gap-4 border-b border-line pb-5 last:border-0">
                    <Sparkle className="mt-1.5 h-2.5 w-2.5 shrink-0 text-gold" />
                    <span className="font-sans text-[0.9375rem] leading-relaxed text-stone">
                      {reason}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </section>

      {/* Practical detail */}
      <section className="border-t border-line py-section">
        <div className="shell mx-auto max-w-3xl">
          <Reveal>
            <h2 className="mb-8 text-center font-display text-d4 font-light text-bone">
              The details
            </h2>
            <DetailAccordion
              items={[
                { title: "How to use", body: <p>{product.howToUse}</p>, defaultOpen: true },
                { title: "Caution", body: <p>{product.caution}</p> },
                {
                  title: "Delivery & returns",
                  body: (
                    <div className="space-y-4">
                      <p>
                        Dispatched within 24 to 48 hours of your order, delivered
                        by Delhivery across India. Free above{" "}
                        {(settings.freeShippingThresholdPaise / 100).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        })}
                        .
                      </p>
                      <p>
                        Sealed bottles can be returned within seven days of
                        delivery. For hygiene reasons we cannot accept an opened
                        fragrance unless it arrived damaged — see the{" "}
                        <Link href="/policies/returns" className="text-gold underline underline-offset-4">
                          returns policy
                        </Link>
                        .
                      </p>
                    </div>
                  ),
                },
                {
                  title: "Product information",
                  body: (
                    <LegalMetrology
                      settings={settings}
                      netQuantity={primary?.size ?? "50ml"}
                      mrpPaise={primary?.mrpPaise ?? 0}
                      countryOfOrigin={product.countryOfOrigin}
                    />
                  ),
                },
              ]}
            />
          </Reveal>
        </div>
      </section>

      <ProductReviews
        productId={product.id}
        productName={shortName}
        slug={product.slug}
        avgRating={product.avgRating}
        reviewCount={product.reviewCount}
      />

      {related.length > 0 && (
        <div className="border-t border-line">
          <FeaturedCollection
            products={related}
            eyebrow="Also consider"
            title={inStock ? "Others in the range" : "In stock right now"}
          />
        </div>
      )}
    </>
  );
}
