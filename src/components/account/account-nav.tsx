"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "@/store/session";
import { User, MapPin, Package, Heart, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Profile", icon: User, exact: true },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
];

/**
 * Account navigation. A vertical rail on desktop, a horizontally scrollable
 * row of tabs on mobile — a stacked vertical menu would push the actual
 * content a full screen down on a phone.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account">
      <ul className="no-scrollbar -mx-gutter flex gap-1 overflow-x-auto px-gutter lg:mx-0 lg:flex-col lg:px-0">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href} className="shrink-0 lg:shrink">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 whitespace-nowrap border-b-2 px-4 py-3 font-sans text-micro uppercase transition-colors duration-400 ease-smoke",
                  "lg:border-b-0 lg:border-l-2 lg:px-4 lg:py-3.5",
                  active
                    ? "border-gold text-gold-light"
                    : "border-transparent text-stone hover:text-bone",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.4} />
                {link.label}
              </Link>
            </li>
          );
        })}

        <li className="shrink-0 lg:mt-6 lg:shrink lg:border-t lg:border-line lg:pt-4">
          <button
            type="button"
            onClick={() => {
              // Re-probe AFTER the cookie is cleared, not before — probing
              // first would just re-confirm the session that is about to end.
              // signOut usually does a document navigation (which resets the
              // store anyway); this covers the case where it does not. See
              // src/store/session.ts.
              void signOut({ callbackUrl: "/" }).then(() =>
                useSession.getState().refresh(),
              );
            }}
            className="flex w-full items-center gap-3 whitespace-nowrap border-b-2 border-transparent px-4 py-3
                       font-sans text-micro uppercase text-stone transition-colors duration-400 ease-smoke
                       hover:text-danger lg:border-b-0 lg:border-l-2 lg:py-3.5"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.4} />
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}
