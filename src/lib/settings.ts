import { cache } from "react";
import { prisma } from "./prisma";

/**
 * The single StoreSetting row, memoised per request.
 *
 * Everything the founder can change without a deploy comes through here:
 * shipping economics, COD policy, support channels, and the statutory
 * manufacturer details Legal Metrology requires on a product page.
 *
 * Falls back to defaults rather than throwing, so a database that has not
 * been seeded yet still renders a working storefront.
 */

export type StoreSettings = {
  shippingFlatPaise: number;
  freeShippingThresholdPaise: number;
  codEnabled: boolean;
  codFeePaise: number;
  codMaxOrderPaise: number | null;
  delhiveryPickupName: string | null;
  whatsappNumber: string | null;
  supportEmail: string;
  supportPhone: string | null;
  manufacturerName: string;
  manufacturerAddress: string;
  customerCareEmail: string;
  customerCarePhone: string | null;
  gstin: string | null;
  invoicePrefix: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
};

const DEFAULTS: StoreSettings = {
  shippingFlatPaise: 7900,
  freeShippingThresholdPaise: 99900,
  codEnabled: true,
  codFeePaise: 4900,
  codMaxOrderPaise: null,
  delhiveryPickupName: null,
  whatsappNumber: null,
  supportEmail: "support@avenuesperfumes.com",
  supportPhone: null,
  manufacturerName: "Avenues Perfumes",
  manufacturerAddress: "",
  customerCareEmail: "care@avenuesperfumes.com",
  customerCarePhone: null,
  gstin: null,
  invoicePrefix: "AVN",
  instagramUrl: null,
  facebookUrl: null,
};

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const row = await prisma.storeSetting.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULTS;
    return {
      shippingFlatPaise: row.shippingFlatPaise,
      freeShippingThresholdPaise: row.freeShippingThresholdPaise,
      codEnabled: row.codEnabled,
      codFeePaise: row.codFeePaise,
      codMaxOrderPaise: row.codMaxOrderPaise,
      delhiveryPickupName: row.delhiveryPickupName,
      whatsappNumber: row.whatsappNumber,
      supportEmail: row.supportEmail,
      supportPhone: row.supportPhone,
      manufacturerName: row.manufacturerName,
      manufacturerAddress: row.manufacturerAddress,
      customerCareEmail: row.customerCareEmail,
      customerCarePhone: row.customerCarePhone,
      gstin: row.gstin,
      invoicePrefix: row.invoicePrefix,
      instagramUrl: row.instagramUrl,
      facebookUrl: row.facebookUrl,
    };
  } catch {
    // Database unreachable at render time — serve the shell rather than a 500.
    return DEFAULTS;
  }
});

/** Builds a wa.me deep link with a pre-filled message. */
export function whatsappLink(number: string | null | undefined, message: string) {
  if (!number) return null;
  const digits = number.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
