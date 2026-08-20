import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const images = await p.productImage.findMany({
  take: 10,
  select: { url: true, alt: true, productId: true },
});
console.log(JSON.stringify(images, null, 2));

const products = await p.product.findMany({
  select: { name: true, slug: true, images: { select: { url: true } } },
});
console.log("\nProducts with images:");
for (const prod of products) {
  console.log(`  ${prod.name}: ${prod.images.length} images`);
  for (const img of prod.images) {
    console.log(`    - ${img.url}`);
  }
}
await p.$disconnect();
