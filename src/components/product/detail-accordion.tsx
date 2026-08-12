import { Plus } from "lucide-react";

/**
 * Built on native <details>/<summary>: keyboard accessible, screen-reader
 * correct, and open-by-default if JavaScript never arrives. No state, no
 * library.
 */
export function DetailAccordion({
  items,
}: {
  items: { title: string; body: React.ReactNode; defaultOpen?: boolean }[];
}) {
  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <details key={item.title} open={item.defaultOpen} className="group border-b border-line">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-6 py-6
                       font-sans text-sm uppercase tracking-wide2 text-bone transition-colors
                       hover:text-gold-light [&::-webkit-details-marker]:hidden"
          >
            {item.title}
            <Plus
              className="h-4 w-4 shrink-0 text-gold transition-transform duration-500 ease-smoke group-open:rotate-45"
              strokeWidth={1.4}
            />
          </summary>
          <div className="pb-7 font-sans text-[0.9375rem] leading-relaxed text-stone">
            {item.body}
          </div>
        </details>
      ))}
    </div>
  );
}
