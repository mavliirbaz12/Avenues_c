import { cache } from "react";
import { cachedSettings } from "./cache";
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
  announcementText: string | null;
  announcementHref: string | null;
  announcementEnabled: boolean;
  heroVideoUrl: string | null;
  heroPosterUrl: string | null;
  brandBannerUrl: string | null;
};

const DEFAULTS: StoreSettings = {
  shippingFlatPaise: 7900,
  freeShippingThresholdPaise: 99900,
  codEnabled: true,
  codFeePaise: 4900,
  codMaxOrderPaise: null,
  delhiveryPickupName: null,
  // E.164 without the "+" — wa.me wants bare digits. Editable in Admin -> Settings.
  whatsappNumber: "919979612029",
  // The address a customer is told to write to, and the reply-to on every
  // order email. It has to RECEIVE, which is a higher bar than looking right:
  // the domain is registered but has no mailbox, so support@avenuesperfume.com would
  // bounce silently and a customer chasing an order would hear nothing.
  //
  // The Gmail is monitored today. Change it in Admin -> Settings the moment a
  // real mailbox exists; this is a default, not a decision.
  supportEmail: "supportavenuesperfume@gmail.com",
  supportPhone: null,
  manufacturerName: "Avenues Perfumes",
  manufacturerAddress: "",
  customerCareEmail: "supportavenuesperfume@gmail.com",
  customerCarePhone: null,
  gstin: null,
  invoicePrefix: "AVN",
  instagramUrl: null,
  facebookUrl: null,
  announcementText: null,
  announcementHref: null,
  announcementEnabled: true,
  heroVideoUrl: null,
  heroPosterUrl: null,
  brandBannerUrl: null,
};

/**
 * One immutable-ish row, read on every request of every page.
 *
 * It drives the announcement strip, the WhatsApp number, shipping thresholds
 * and the hero media, so the layout needs it before it can render anything —
 * which made it a per-navigation round trip on a row that changes when the
 * founder edits Settings and at no other time.
 */
const storeSettingsUncached = async (): Promise<StoreSettings> => {
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
      announcementText: row.announcementText,
      announcementHref: row.announcementHref,
      announcementEnabled: row.announcementEnabled,
      heroVideoUrl: row.heroVideoUrl,
      heroPosterUrl: row.heroPosterUrl,
      brandBannerUrl: row.brandBannerUrl,
    };
  } catch {
    // Database unreachable at render time — serve the shell rather than a 500.
    return DEFAULTS;
  }
};

export const getStoreSettings = cache(
  cachedSettings(storeSettingsUncached, ["store-settings"]),
);

/** Builds a wa.me deep link with a pre-filled message. */
export function whatsappLink(number: string | null | undefined, message: string) {
  if (!number) return null;
  const digits = number.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
