import { GoldArc } from "@/components/brand/gold-arc";

/** Shared frame for legal pages: narrow measure, quiet header. */
export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell mx-auto max-w-3xl py-14 sm:py-20">
      {children}
      <GoldArc className="mt-16" flip />
    </div>
  );
}
