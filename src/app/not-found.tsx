import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { GoldArc } from "@/components/brand/gold-arc";

/**
 * 404. Renders outside the storefront chrome (root layout only), so it
 * carries its own centring and a way back in.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40rem 30rem at 50% 40%, rgba(201,162,75,0.08), transparent 65%)",
        }}
      />

      <div className="relative z-[2]">
        <Link href="/" aria-label="Avenues — home" className="inline-flex">
          <BrandMark className="h-14 w-auto" />
        </Link>

        <p className="micro-label-gold mt-10">Four-oh-four</p>
        <h1 className="mt-5 font-display text-d2 font-light text-bone">
          This scent trail goes cold
        </h1>
        <p className="mx-auto mt-5 max-w-md font-sans text-body-lg leading-relaxed text-stone">
          Whatever was here has evaporated — moved, renamed, or never bottled in
          the first place. The five originals are exactly where they always are.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/shop" className="btn btn-primary btn-lg">
            Shop the five
          </Link>
          <Link href="/" className="btn btn-ghost btn-lg">
            Back to the start
          </Link>
        </div>

        <GoldArc className="mt-14 max-w-md" />
      </div>
    </div>
  );
}
