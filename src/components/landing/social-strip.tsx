import { Instagram } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { Sparkle } from "@/components/brand/sparkle";

const SLUGS = ["intense", "pink-aura", "night-drip", "blue-mist", "white-oud", "intense"];

/**
 * Social strip.
 *
 * Until the Instagram feed is connected, these tiles show the bottle figures
 * rather than empty frames or fake screenshots — it reads as a designed
 * placeholder instead of a broken embed. Swap the tile contents for real posts
 * (Instagram Basic Display API or a static export) without touching the layout.
 */
export function SocialStrip({ instagramUrl }: { instagramUrl: string | null }) {
  const handle = instagramUrl
    ? `@${instagramUrl.replace(/\/+$/, "").split("/").pop()}`
    : "@avenuesperfumes";

  return (
    <section className="py-section" aria-labelledby="social-heading">
      <div className="shell">
        <Reveal className="text-center">
          <p className="micro-label-gold flex items-center justify-center gap-3">
            <Sparkle className="h-1.5 w-1.5" />
            In the wild
            <Sparkle className="h-1.5 w-1.5" />
          </p>
          <h2 id="social-heading" className="mt-5 font-display text-d3 font-light text-bone">
            Worn, photographed, tagged
          </h2>
          <p className="mx-auto mt-4 max-w-md font-sans text-[0.9375rem] leading-relaxed text-stone">
            Tag {handle} and we will send the best of them a bottle.
          </p>
        </Reveal>
      </div>

      <div className="no-scrollbar mt-12 flex gap-3 overflow-x-auto px-gutter sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
        {SLUGS.map((slug, i) => (
          <Reveal key={i} delay={i * 0.05} className="w-[42vw] shrink-0 sm:w-auto">
            <a
              href={instagramUrl ?? "https://instagram.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex aspect-square items-center justify-center overflow-hidden
                         border border-line bg-ink-deep transition-colors duration-600 ease-smoke hover:border-gold/40"
              aria-label={`Avenues on Instagram (${handle})`}
            >
              <BottleFigure slug={slug} className="scale-[0.78] transition-transform duration-900 ease-smoke group-hover:scale-[0.86]" />
              <span className="absolute inset-0 flex items-center justify-center bg-ink-deep/70 opacity-0 transition-opacity duration-500 ease-smoke group-hover:opacity-100">
                <Instagram className="h-5 w-5 text-gold" strokeWidth={1.3} />
              </span>
            </a>
          </Reveal>
        ))}
      </div>

      <div className="shell mt-10 text-center">
        <a
          href={instagramUrl ?? "https://instagram.com"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-md"
        >
          <Instagram className="h-4 w-4" strokeWidth={1.4} />
          Follow {handle}
        </a>
      </div>
    </section>
  );
}
