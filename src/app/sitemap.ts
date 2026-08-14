import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product
    .findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })
    .catch(() => []);

  const statics: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/track-order`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/policies/shipping`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/returns`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/policies/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    ...statics,
    ...products.map((p) => ({
      url: `${siteUrl}/fragrance/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
