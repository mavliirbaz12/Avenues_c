import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server also listens on the LAN address, which is how you preview
  // on a phone. Without this Next warns on every asset request, and a future
  // major will refuse them outright.
  allowedDevOrigins: ["172.28.80.1", "192.168.56.1", "localhost"],
  poweredByHeader: false,
  experimental: {
    // Next 15 defaults the client Router Cache to 0s for dynamic routes, and
    // every route here is dynamic (auth in the store layout). Without this,
    // navigating back to a page seen seconds ago always round-trips to the
    // server, which is most of what "clicking through pages is slow" feels
    // like. 30s is short enough that stock and prices stay honest.
    staleTimes: { dynamic: 30, static: 180 },
    // `motion` is not in Next's built-in optimizePackageImports list (unlike
    // lucide-react), and the Toaster in the root layout pulls it into every
    // route's bundle — admin included. `date-fns` and the dnd-kit packages are
    // barrel exports too: admin imports a handful of helpers from each and was
    // pulling the whole surface into the shared chunk.
    optimizePackageImports: ["motion", "date-fns", "@dnd-kit/core", "@dnd-kit/sortable"],
  },
  images: {
    remotePatterns: [
      // Cloudinary is the production image host (admin uploads land here).
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Google profile pictures for OAuth avatars.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  eslint: {
    // Lint is run explicitly in CI via `npm run lint`; don't fail the build on it.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
