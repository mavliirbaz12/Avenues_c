"use client";

import { useEffect, useRef } from "react";
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
import { BrandMark } from "@/components/brand/brand-mark";
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
 * Admin rail. A labelled column on desktop; on mobile a bottom bar that
 * SCROLLS rather than one that hides what will not fit.
 *
 * It used to drop Collections, Customers, Newsletter and Settings below `lg`
 * with `hidden lg:flex` — the reasoning being that six entries cover day-to-day
 * operations. But "day-to-day" is not the same as "all of it": those four were
 * not deprioritised on a phone, they were unreachable from one. Changing a
 * price band, checking a customer's order history or exporting the newsletter
 * meant finding a laptop, which is exactly the situation a phone-friendly admin
 * is supposed to avoid.
 *
 * A horizontally scrollable strip keeps every destination reachable without
 * shrinking eleven icons to illegibility. The active item scrolls itself into
 * view, so arriving on a page never leaves you looking at the wrong end of the
 * strip.
 */
export function AdminNav({ pendingBadges }: { pendingBadges: Record<string, number> }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Without this the strip always starts at "Dashboard", so landing on
  // Settings — the last entry — shows a bar that appears not to contain it.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-sunken
                 lg:inset-y-0 lg:left-0 lg:w-52 lg:border-r lg:border-t-0"
    >
      <div className="hidden items-center gap-2.5 px-5 pb-2 pt-6 lg:flex">
        <BrandMark className="h-7 w-auto" />
        <span className="font-sans text-[0.6875rem] uppercase tracking-label text-stone">
          Back of house
        </span>
      </div>

      <ul
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                   lg:mt-4 lg:block lg:snap-none lg:space-y-0.5 lg:overflow-visible lg:px-3"
      >
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          const badge = pendingBadges[link.href] ?? 0;
          return (
            <li key={link.href} className="shrink-0 snap-center lg:block lg:shrink">
              <Link
                ref={active ? activeRef : undefined}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // A fixed min-width on the phone strip: equal cells scroll
                  // predictably, and it keeps the 44px tap target that
                  // `justify-around` used to squeeze away as entries were added.
                  "relative flex min-w-[4.25rem] flex-col items-center gap-1 px-2 py-2.5 font-sans text-[0.5625rem] uppercase tracking-wide2 transition-colors",
                  "lg:min-w-0 lg:flex-row lg:gap-3 lg:px-3 lg:py-2 lg:text-[0.6875rem]",
                  active
                    ? "text-gold-light lg:bg-gold/[0.07]"
                    : "text-stone hover:text-bone",
                )}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
                {/*
                  Labelled on the phone too. Eleven unlabelled icons is a
                  memory test — and with the strip scrolling, there is now room
                  for the word that says which one this is.
                */}
                <span className="max-w-full truncate">{link.label}</span>
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
