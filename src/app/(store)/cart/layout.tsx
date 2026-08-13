import type { Metadata } from "next";

// The cart page itself is a client component (the guest cart lives in
// localStorage), so its metadata is declared here.
export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your Avenues order before checkout.",
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
