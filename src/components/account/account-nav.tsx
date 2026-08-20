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
 * Account navigation. A vertical rail from `lg` up; a two-column grid of tiles
 * below it.
 *
 * It used to be a horizontally scrollable row of tabs on mobile. That row was
 * ~430px of content in a ~350px bar, so Orders, Wishlist and Sign out sat off
 * the right edge with nothing to say they were there — a sideways scroll is
 * invisible until you happen to swipe it, and on a page whose whole job is
 * "where are my orders", the answer was hidden.
 *
 * The obvious fix — stack it vertically, exactly like the desktop rail — is
 * what the old comment here rejected, and it was right to: five full-width
 * rows push the profile form or the order list about 200px down the screen on
 * every single visit.
 *
 * A two-column grid costs roughly half that, shows all five destinations at
 * once, and reads as a menu block rather than a strip that has been cut off.
 * Sign out spans both columns — it is not a peer of the four destinations, and
 * the full-width row keeps it from being fat-fingered on the way to Wishlist.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account">
      <ul className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-1">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  /*
                    Two shapes, one element.

                    Below `lg` it is a bordered tile with the icon above the
                    label — stacking them is what lets two tiles fit a 320px
                    screen without "Addresses" wrapping or truncating. From
                    `lg` it becomes the rail row it always was: icon beside
                    label, no box, a gold left border marking the current page.
                  */
                  "flex h-full flex-col items-start gap-1.5 border border-line px-3.5 py-3",
                  "font-sans text-micro uppercase transition-colors duration-400 ease-smoke",
                  "lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:border-l-2 lg:px-4 lg:py-3.5",
                  active
                    ? "border-gold/50 bg-gold/[0.06] text-gold-light lg:border-gold lg:bg-transparent"
                    : "text-stone hover:border-line-strong hover:text-bone lg:border-transparent",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.4} />
                {link.label}
              </Link>
            </li>
          );
        })}

        {/* Full width on the grid, and its own section on the rail. */}
        <li className="col-span-2 lg:col-span-1 lg:mt-6 lg:border-t lg:border-line lg:pt-4">
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
            className="flex w-full items-center gap-3 border border-line px-3.5 py-3
                       font-sans text-micro uppercase text-stone transition-colors duration-400 ease-smoke
                       hover:border-danger/40 hover:text-danger
                       lg:border-0 lg:border-l-2 lg:border-transparent lg:px-4 lg:py-3.5 lg:hover:border-transparent"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.4} />
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}
