import type { Metadata } from "next";

// The wishlist page is a client component (guest wishlists live in
// localStorage), so its metadata is declared here.
export const metadata: Metadata = {
  title: "Your wishlist",
  description: "Fragrances you have saved for later.",
  robots: { index: false, follow: true },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
