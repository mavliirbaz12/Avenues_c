"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TicketPercent,
  Layers,
  Star,
  Inbox,
  Users,
  Mail,
  Settings,
  Store,
  Gift,
} from "lucide-react";
import { Monogram } from "@/components/brand/monogram";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/combos", label: "Gift sets", icon: Gift },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/collections", label: "Collections", icon: Layers },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * Admin rail. Icons with labels on desktop, an icon-only bottom bar on
 * mobile so the founder can pack orders from a phone.
 */
export function AdminNav({ pendingBadges }: { pendingBadges: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-sunken
                 lg:inset-y-0 lg:left-0 lg:w-52 lg:border-r lg:border-t-0"
    >
      <div className="hidden items-center gap-2.5 px-5 pb-2 pt-6 lg:flex">
        <Monogram className="h-7 w-7" />
        <span className="font-sans text-[0.6875rem] uppercase tracking-label text-stone">
          Back of house
        </span>
      </div>

      <ul className="flex justify-around lg:mt-4 lg:block lg:space-y-0.5 lg:px-3">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          const badge = pendingBadges[link.href] ?? 0;
          return (
            <li key={link.href} className="lg:block">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-2 py-2.5 font-sans text-[0.5625rem] uppercase tracking-wide2 transition-colors",
                  "lg:flex-row lg:gap-3 lg:px-3 lg:py-2 lg:text-[0.6875rem]",
                  active
                    ? "text-gold-light lg:bg-gold/[0.07]"
                    : "text-stone hover:text-bone",
                  // On the phone bar, hide the long tail; the first six cover
                  // day-to-day operations.
                  ["/admin/collections", "/admin/customers", "/admin/newsletter", "/admin/settings"].includes(
                    link.href,
                  ) && "hidden lg:flex",
                )}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
                <span className="max-lg:hidden">{link.label}</span>
                {badge > 0 && (
                  <span className="absolute right-1 top-1 min-w-[1rem] rounded-pill bg-gold px-1 text-center font-sans text-[0.5625rem] font-medium leading-4 text-ink lg:static lg:ml-auto">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden border-t border-line px-3 py-3 lg:block">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-gold-light"
        >
          <Store className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
          View storefront
        </Link>
      </div>
    </nav>
  );
}
