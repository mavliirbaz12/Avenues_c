import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/reveal";

/**
 * The two figures that move with the catalogue are passed in; the two that do
 * not are literals. Previously all four were literals, so adding a sixth scent
 * or a 100ml bottle would have left the band quietly stating something false.
 */
function facts(count: number, sizeLabel: string) {
  return [
    { value: String(count).padStart(2, "0"), label: "Fragrances" },
    { value: sizeLabel, label: "Eau de parfum" },
    { value: "8–10h", label: "On skin" },
    { value: "India", label: "Made and bottled" },
  ].filter((f) => f.value);
}

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
export function BrandBanner({
  imageUrl,
  count,
  sizeLabel,
}: {
  imageUrl: string | null;
  count: number;
  sizeLabel: string;
}) {
  const FACTS = facts(count, sizeLabel);
  return (
    <section
      className={cn(
        "relative overflow-hidden border-y border-line bg-ink-deep",
        // The band takes the photograph's own proportions (1600x1283) so
        // `object-contain` has somewhere to be, capped so it never eats a
        // whole tall screen. Without a ratio here the height came from the
        // two lines of type and the image shrank to a strip.
        imageUrl && "aspect-[1600/1283] max-h-[85vh] sm:aspect-[16/9] lg:aspect-[1600/1283]",
      )}
      aria-label="Our promise"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {imageUrl ? (
          <>
            {/* `contain`, not `cover`: this is a composed product photograph
                — the gift box, the five bottles, the wordmark — and cropping
                it to fill a band cut the subject in half. The section takes
                its height from the image instead, so the whole frame shows on
                every viewport. */}
            <Image
              src={imageUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-contain object-center"
            />
            {/* Lighter scrim than before: the type sits in the upper third
                where the photograph is mostly marble, so it no longer needs to
                be dimmed to near-black to stay readable. */}
            <div className="absolute inset-0 bg-ink-deep/55" />
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

      {/* Centred over the photograph rather than pushing it taller. */}
      <div
        className={cn(
          "shell relative z-[2] text-center",
          imageUrl
            ? "flex h-full flex-col items-center justify-center py-12"
            : "py-section",
        )}
      >
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
