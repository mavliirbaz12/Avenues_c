import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadImage, cloudinaryLive } from "@/lib/images/cloudinary";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Admin image upload. Multipart: file + productId (+ optional alt).
 * Creates the ProductImage row and returns it; first image on a product
 * becomes primary automatically.
 */
export async function POST(req: NextRequest) {
  const session = await auth().catch(() => null);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  if (!cloudinaryLive) {
    return NextResponse.json(
      { error: "Image upload needs Cloudinary keys in .env — see .env.example." },
      { status: 501 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const productId = String(form?.get("productId") ?? "");
  const alt = String(form?.get("alt") ?? "").slice(0, 200);

  if (!(file instanceof File) || !productId) {
    return NextResponse.json({ error: "File and productId are required." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP or AVIF image." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep images under 8MB." }, { status: 413 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, _count: { select: { images: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadImage(buffer, file.name);

    const image = await prisma.productImage.create({
      data: {
        productId: product.id,
        url: uploaded.url,
        publicId: uploaded.publicId,
        alt: alt || `${product.name} — product photograph`,
        position: product._count.images,
        isPrimary: product._count.images === 0,
        width: uploaded.width,
        height: uploaded.height,
      },
    });

    return NextResponse.json({ image });
  } catch (err) {
    console.error("[admin:upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
