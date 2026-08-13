import { v2 as cloudinary } from "cloudinary";
import { env, integrations } from "@/lib/env";

/**
 * Cloudinary, server-side only. Uploads are signed here — the browser posts
 * the file to our /api/admin/upload route, never straight to Cloudinary, so
 * the API secret never leaves the server and only admins can add images.
 */

export const cloudinaryLive = integrations.cloudinary;

if (cloudinaryLive) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadImage(buffer: Buffer, filename: string) {
  if (!cloudinaryLive) throw new Error("Cloudinary is not configured.");

  return new Promise<{ url: string; publicId: string; width: number; height: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: env.CLOUDINARY_FOLDER,
          resource_type: "image",
          // Normalise everything to a sane ceiling; next/image handles the rest.
          transformation: [{ width: 2000, height: 2000, crop: "limit" }],
          context: { original_filename: filename },
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed."));
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        },
      );
      stream.end(buffer);
    },
  );
}

export async function destroyImage(publicId: string) {
  if (!cloudinaryLive) return;
  await cloudinary.uploader.destroy(publicId);
}
