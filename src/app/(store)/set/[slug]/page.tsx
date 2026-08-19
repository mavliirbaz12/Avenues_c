import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getStoreSettings } from "@/lib/settings";
import { getCombo, getComboCards } from "@/lib/catalog";
import { siteUrl } from "@/lib/env";
import { ProductGallery } from "@/components/product/product-gallery";
import { BuyBox } from "@/components/product/buy-box";
import { WhatsInside } from "@/components/combo/whats-inside";
import { DetailAccordion } from "@/components/product/detail-accordion";
import { ProductReviews } from "@/components/product/product-reviews";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/motion/reveal";
import { jsonLdHtml } from "@/lib/seo";

// Same reasoning as the fragrance page — see the note there on why a cached
// buy box is not just a stale number but the wrong control.
export const dynamic = "force-dynamic";

/**
 * Gift-set detail page.
 *
 * Combos live at /set/<slug> rather than /fragrance/<slug>. Product.slug is
 * unique across both kinds, so a collision is impossible — the split exists
 * because the two pages answer different questions (a note pyramid versus
 * what is in the box), and because one canonical URL per product keeps the
 * sitemap and the JSON-LD honest.
 *
 * Memoized for the same reason as the fragrance page: generateMetadata and the
 * body are separate calls, and React's fetch dedupe does not cover Prisma.
 */
const load = cache(async (slug: string) => getCombo(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const combo = await load(slug);
  // notFound() here, not a "not found" title — returning metadata lets Next
  // commit a 200 head before the body can set the status.
  if (!combo) notFound();

  const url = `${siteUrl}/set/${combo.slug}`;
  const title = combo.metaTitle ?? `${combo.name} — ${combo.tagline}`;
  const description = combo.metaDescription ?? combo.highlight;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      images: combo.images[0] ? [{ url: combo.images[0].url }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [combo, settings] = await Promise.all([load(slug), getStoreSettings()]);

  if (!combo) notFound();

  const shortName = combo.name.replace(/^Avenues\s+/i, "");
  const primary = combo.variants.find((v) => v.stock > 0) ?? combo.variants[0] ?? null;
  const itemCount = combo.members.length;

  // Other sets, for the strip at the foot of the page.
  const otherSets = (await getComboCards(4)).filter((c) => c.slug !== combo.slug).slice(0, 3);

  /**
   * JSON-LD. A gift set is a Product whose parts are named — `isRelatedTo`
   * rather than `hasPart`, because the members are separately purchasable
   * products, not components that only exist inside this one.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: combo.name,
    description: combo.description,
    sku: primary?.sku,
    brand: { "@type": "Brand", name: "Avenues" },
    category: "Beauty/Fragrance/Gift Set",
    countryOfOrigin: combo.countryOfOrigin,
    ...(combo.images[0] ? { image: [`${siteUrl}${combo.images[0].url}`] } : {}),
    ...(combo.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: combo.avgRating.toFixed(1),
            reviewCount: combo.reviewCount,
          },
        }
      : {}),
    isRelatedTo: combo.members.map((m) => ({
      "@type": "Product",
      name: m.name,
      ...(m.href ? { url: `${siteUrl}${m.href}` } : {}),
    })),
    offers: combo.variants.map((v) => ({
      "@type": "Offer",
      url: `${siteUrl}/set/${combo.slug}`,
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
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="shell pt-8">
        <ol className="flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-label text-stone-dark">
          <li>
            <Link href="/" className="transition-colors hover:text-gold-light">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center">
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </li>
          <li>
            <Link href="/sets" className="transition-colors hover:text-gold-light">
              Sets
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center">
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </li>
          <li aria-current="page" className="text-stone">
            {shortName}
          </li>
        </ol>
      </nav>

      <section className="shell grid gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14">
        <div>
          <ProductGallery slug={combo.slug} name={combo.name} images={combo.images} />
        </div>

        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          {/* Contents count, stated before price — it is the first thing
              anyone wants to know about a set, and it is never hardcoded. */}
          <p className="micro-label-gold" data-testid="combo-contents-count">
            {`${itemCount} fragrance${itemCount === 1 ? "" : "s"}` +
              (combo.members[0]
                ? ` · ${sizeSummary(combo.members.map((m) => m.sizeLabel))}`
                : "")}
          </p>

          <div className="mt-4">
            <BuyBox
              product={{
                id: combo.id,
                slug: combo.slug,
                name: combo.name,
                shortName,
                tagline: combo.tagline,
                concentration: "Gift set",
                longevity: "",
                avgRating: combo.avgRating,
                reviewCount: combo.reviewCount,
              }}
              variants={combo.variants}
              imageUrl={combo.images[0]?.url ?? null}
              whatsappNumber={settings.whatsappNumber}
              codEnabled={settings.codEnabled}
              freeShippingThresholdPaise={settings.freeShippingThresholdPaise}
            />
          </div>

          {/* Savings line, only when the founder has written one. Deliberately
              not computed from member prices: those move independently, and a
              stale "worth ₹X" is worse than none. */}
          {combo.savingsNote && (
            <p className="mt-5 inline-flex border border-gold/35 px-4 py-2 font-sans text-xs text-gold-light">
              {combo.savingsNote}
            </p>
          )}

          {!combo.couponEligible && (
            <p className="mt-5 font-sans text-xs leading-relaxed text-stone-dark">
              Already priced below the sum of its parts, so discount codes do
              not apply to this set.
            </p>
          )}
        </div>
      </section>

      <section className="border-y border-line bg-surface/40 py-14">
        <div className="shell">
          <Reveal>
            <p className="mx-auto max-w-3xl text-center font-display text-d4 font-light leading-snug text-bone">
              {combo.highlight}
            </p>
          </Reveal>
        </div>
      </section>

      <WhatsInside members={combo.members} />

      <section className="border-t border-line py-section">
        <div className="shell max-w-3xl">
          <h2 className="mb-8 text-center font-display text-d4 font-light text-bone">
            The details
          </h2>
          <DetailAccordion
            items={[
              { title: "About this set", body: <p>{combo.description}</p>, defaultOpen: true },
              { title: "How to use", body: <p>{combo.howToUse}</p> },
              { title: "Caution", body: <p>{combo.caution}</p> },
              {
                title: "Delivery & returns",
                body: (
                  <div className="space-y-4">
                    <p>
                      Dispatched within 24 to 48 hours, delivered by Delhivery
                      across India. Free above{" "}
                      {(settings.freeShippingThresholdPaise / 100).toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      })}
                      .
                    </p>
                    <p>
                      A sealed set can be returned within seven days of
                      delivery. Once any bottle inside has been opened the set
                      cannot be returned, for the same hygiene reasons that
                      apply to a single fragrance.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </section>

      <ProductReviews
        productId={combo.id}
        productName={combo.name}
        slug={`set/${combo.slug}`}
        avgRating={combo.avgRating}
        reviewCount={combo.reviewCount}
      />

      {otherSets.length > 0 && (
        <section className="border-t border-line py-section" aria-labelledby="other-sets">
          <div className="shell">
            <Reveal className="text-center">
              <p className="micro-label-gold">Also boxed</p>
              <h2 id="other-sets" className="mt-5 font-display text-d3 font-light text-bone">
                Other sets
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {otherSets.map((c, i) => (
                <ProductCard key={c.id} product={c} index={i + 1} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * "10ml each" when every bottle is the same size, otherwise the distinct sizes
 * listed. Works for any number of members, including one.
 */
function sizeSummary(sizes: string[]) {
  const distinct = [...new Set(sizes)];
  if (distinct.length === 1) return sizes.length === 1 ? distinct[0]! : `${distinct[0]} each`;
  return distinct.join(" · ");
}
