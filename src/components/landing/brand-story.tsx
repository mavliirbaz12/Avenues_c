import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Monogram } from "@/components/brand/monogram";

const FACTS = [
  { value: "05", label: "Fragrances" },
  { value: "50ml", label: "Eau de parfum" },
  { value: "8–10h", label: "On skin" },
  { value: "India", label: "Made and bottled" },
];

export function BrandStory() {
  return (
    <section className="relative border-y border-line bg-ink-deep py-section grain" aria-labelledby="story-heading">
      <div className="shell relative z-[2] grid gap-14 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-5">
          <div className="relative flex h-full min-h-[18rem] items-center justify-center">
            <Monogram className="h-40 w-40 opacity-90 sm:h-52 sm:w-52" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(24rem 24rem at 50% 50%, rgba(201,162,75,0.09), transparent 65%)",
              }}
            />
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <Reveal>
            <p className="micro-label-gold">Our story</p>
            <h2 id="story-heading" className="mt-5 max-w-xl font-display text-d3 font-light text-bone">
              We would rather make five well than fifty quickly
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-7 max-w-xl space-y-5 font-sans text-body-lg leading-relaxed text-stone">
              <p>
                Avenues started with a complaint. Good fragrance in India was
                either imported and priced like jewellery, or affordable and gone
                within the hour. There was very little in between.
              </p>
              <p>
                So we built the in-between. Eau de parfum concentration, oils
                sourced properly, and formulations tested through a Mumbai summer
                rather than a European autumn — because a scent that survives
                forty degrees and humidity is a different piece of engineering.
              </p>
              <p>
                Five fragrances is not a soft launch. It is the whole catalogue,
                and it stays that way until the sixth earns its place.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <dl className="mt-11 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-9 sm:grid-cols-4">
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

          <Reveal delay={0.22}>
            <Link
              href="/about"
              className="group mt-10 inline-flex items-center gap-3 font-sans text-micro uppercase text-gold transition-colors hover:text-gold-light"
            >
              Read the full story
              <ArrowRight
                className="h-4 w-4 transition-transform duration-600 ease-smoke group-hover:translate-x-1.5"
                strokeWidth={1.4}
              />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
