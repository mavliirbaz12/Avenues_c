import Image from "next/image";
import { Reveal } from "@/components/motion/reveal";

const FACTS = [
  { value: "05", label: "Fragrances" },
  { value: "50ml", label: "Eau de parfum" },
  { value: "8–10h", label: "On skin" },
  { value: "India", label: "Made and bottled" },
];

/**
 * The brand statement band.
 *
 * Structural, not decorative: it sits between the featured slider and the
 * collection grid so the page never shows product imagery twice in a row.
 *
 * Deliberately NOT a link and NOT carrying a button — its unclickability is
 * what makes it read as a statement rather than an ad. The story teaser lower
 * down is the one that invites a click.
 *
 * The facts strip grounds the mood with something concrete; a mantra alone
 * over an image is the stock-photo move.
 */
export function BrandBanner({ imageUrl }: { imageUrl: string | null }) {
  return (
    <section className="relative overflow-hidden border-y border-line bg-ink-deep" aria-label="Our promise">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {imageUrl ? (
          <>
            <Image src={imageUrl} alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-ink-deep/72" />
          </>
        ) : (
          <div className="absolute inset-0 grain">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(48rem 30rem at 50% 120%, rgba(201,162,75,0.13), transparent 68%)",
              }}
            />
          </div>
        )}
        <div className="absolute inset-0 vignette" />
      </div>

      <div className="shell relative z-[2] py-section text-center">
        <Reveal>
          {/* max-w-5xl and the shorter second line together stop "room."
              orphaning onto a third line at the d2 clamp's upper end. */}
          <p className="mx-auto max-w-5xl font-display text-d2 font-light leading-[1.15] text-bone">
            Confidence, bottled.
            <br />
            <span className="text-gradient-gold">Worn by those who own the room.</span>
          </p>
        </Reveal>

        <Reveal delay={0.12}>
          <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-8 border-t border-line/60 pt-10 sm:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt className="micro-label">{f.label}</dt>
                <dd className="mt-2.5 font-display text-3xl font-light text-gradient-gold">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
