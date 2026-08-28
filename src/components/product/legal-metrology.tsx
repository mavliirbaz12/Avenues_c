"use client";

import { formatPaise } from "@/lib/format";
import type { StoreSettings } from "@/lib/settings";
import { useSelectedVariant } from "./variant-selection";

/**
 * Statutory declarations required on a pre-packaged commodity sold online in
 * India (Legal Metrology (Packaged Commodities) Rules, 2011 — rule 6 and the
 * e-commerce disclosure requirement).
 *
 * Every value is admin-editable from Settings; nothing here is hardcoded so
 * the founder can correct the registered address without a deploy.
 *
 * Net quantity and MRP are declarations about ONE package, so they follow the
 * size the shopper has selected rather than the page's default. The props are
 * the server-rendered fallback: they are what a crawler and a JavaScript-less
 * browser see, and what renders on a page with no size selector at all.
 */
export function LegalMetrology({
  settings,
  netQuantity,
  mrpPaise,
  countryOfOrigin,
}: {
  settings: StoreSettings;
  netQuantity: string;
  mrpPaise: number;
  countryOfOrigin: string;
}) {
  const selected = useSelectedVariant();
  const size = selected?.size ?? netQuantity;
  const mrp = selected?.mrpPaise ?? mrpPaise;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Marketed by", value: settings.manufacturerName },
    ...(settings.manufacturerAddress
      ? [{ label: "Address", value: settings.manufacturerAddress }]
      : []),
    { label: "Net quantity", value: size },
    {
      label: "Maximum retail price",
      value: `${formatPaise(mrp)} (inclusive of all taxes)`,
    },
    { label: "Country of origin", value: countryOfOrigin },
    {
      label: "Customer care",
      value: (
        <>
          <a
            href={`mailto:${settings.customerCareEmail}`}
            className="text-gold transition-colors hover:text-gold-light"
          >
            {settings.customerCareEmail}
          </a>
          {settings.customerCarePhone && (
            <>
              {" · "}
              <a
                href={`tel:${settings.customerCarePhone.replace(/\s/g, "")}`}
                className="text-gold transition-colors hover:text-gold-light"
              >
                {settings.customerCarePhone}
              </a>
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="micro-label sm:pt-0.5">{row.label}</dt>
          <dd className="font-sans text-sm leading-relaxed text-stone">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
