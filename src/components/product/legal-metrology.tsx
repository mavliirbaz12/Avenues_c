import { formatPaise } from "@/lib/format";
import type { StoreSettings } from "@/lib/settings";

/**
 * Statutory declarations required on a pre-packaged commodity sold online in
 * India (Legal Metrology (Packaged Commodities) Rules, 2011 — rule 6 and the
 * e-commerce disclosure requirement).
 *
 * Every value is admin-editable from Settings; nothing here is hardcoded so
 * the founder can correct the registered address without a deploy.
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
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Marketed by", value: settings.manufacturerName },
    ...(settings.manufacturerAddress
      ? [{ label: "Address", value: settings.manufacturerAddress }]
      : []),
    { label: "Net quantity", value: netQuantity },
    {
      label: "Maximum retail price",
      value: `${formatPaise(mrpPaise)} (inclusive of all taxes)`,
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
