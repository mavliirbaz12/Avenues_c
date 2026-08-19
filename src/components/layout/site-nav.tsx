"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, User, ShoppingBag, Menu, ChevronDown } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NAV_LINKS } from "./nav-links";
import { useCart, cartCount } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useUI } from "@/store/ui";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";

import type { NavProduct } from "@/lib/catalog";

export type NavFragrance = NavProduct;

/**
 * Primary navigation.
 *
 * Every control carries a visible label or a count — no icon is left for a
 * first-time visitor to decode.
 *
 * Adding "Gift sets" made six primary links, which briefly overran the bar and
 * collided with the logo at 1440. The fix was to tighten the link row rather
 * than drop the utility words: labels still appear from ~1400px, and below
 * that the cluster falls back to icons carrying the same `aria-label`s rather
 * than wrapping to two rows.
 */
export function SiteNav({ fragrances }: { fragrances: NavFragrance[] }) {
  const pathname = usePathname();
  /*
    Auth comes from the client store, not from props.

    It used to be passed down from the store layout, which had to read the
    session cookie to produce it — and that single read made every storefront
    route dynamic, so nothing was ever served from the CDN. See
    src/store/session.ts for the trade this buys.
  */
  const isAuthed = useSession((s) => s.isAuthed);
  const firstName = useSession((s) => s.firstName);
  const sessionStatus = useSession((s) => s.status);
  const [scrolled, setScrolled] = useState(false);

  const lines = useCart((s) => s.lines);
  const wishIds = useWishlist((s) => s.ids);
  const { openCart, openSearch, openMenu } = useUI();

  // The nav floats transparently over the landing hero and only takes on glass
  // once the page moves. Everywhere else it is glass from the first frame.
  const overHero = pathname === "/";
  const solid = scrolled || !overHero;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = cartCount(lines);
  // Neutral while the probe is in flight: "Login" flashed at someone who is
  // already signed in is worse than a word that is true either way.
  const accountLabel =
    sessionStatus === "loading" ? "Account" : isAuthed ? firstName?.trim() || "Account" : "Login";

  return (
    <header
      className={cn(
        "fixed inset-x-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-600 ease-smoke",
        // `glass-nav`, not `glass` — see the note on it in globals.css. The
        // short version: the page's body copy stayed legible straight through
        // the bar as it scrolled underneath, which read as a rendering fault.
        solid ? "glass-nav glass-hairline border-x-0 border-t-0" : "border-transparent bg-transparent",
      )}
      style={{ top: "var(--announce-h)", height: "var(--nav-h)" }}
    >
      <nav className="shell flex h-full items-center justify-between gap-4" aria-label="Primary">
        <div className="flex items-center gap-2 lg:hidden">
          <IconButton label="Open menu" onClick={openMenu}>
            <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>
        </div>

        {/*
          `shrink-0` is load-bearing.

          Without it the lockup is an ordinary flex item and gives up width
          first whenever the bar is full — which it is at every desktop size.
          The wordmark was being compressed to 205px against its natural 242,
          and at 1400px and above, where the icon cluster gains text labels, to
          66px: the brand name squeezed to a smudge, and worse the wider the
          screen got. Nothing about it looked like a layout bug, only like a
          logo that was too small.
        */}
        <div className="absolute left-1/2 w-max shrink-0 -translate-x-1/2 lg:static lg:translate-x-0">
          <Logo size="md" />
        </div>

        <ul className="hidden items-center gap-4 lg:flex xl:gap-6 2xl:gap-7">
          <li>
            <FragrancesMenu fragrances={fragrances} />
          </li>
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className="link-draw whitespace-nowrap font-sans text-micro uppercase text-bone/90"
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <IconButton
            label="Search fragrances"
            text="Search"
            onClick={openSearch}
            className="hidden sm:inline-flex"
          >
            <Search className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          {/*
            Wishlist and account are on the bar at every width.

            They were `hidden sm:inline-flex`, which on a phone left them
            reachable only by opening the drawer and scrolling to its footer —
            two deliberate actions to reach a saved list, on the viewport where
            most of this store's traffic actually is. The badge count was
            invisible there too, so a saved item gave no signal it had been
            saved.

            This costs the centred lockup ~76px of clearance below 768px, which
            is why the `md` steps in components/brand/logo.tsx were re-measured
            against the new cluster rather than left alone.
          */}
          <IconButton
            label={`Wishlist${wishIds.length ? `, ${wishIds.length} saved` : ""}`}
            text="Wishlist"
            href="/wishlist"
            badge={wishIds.length}
          >
            <Heart className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          <IconButton
            label={isAuthed ? "Your account" : "Sign in"}
            text={accountLabel}
            // Signed out, /account redirects to /login with a next param, so
            // this is correct even if the probe has not landed yet.
            href={isAuthed ? "/account" : "/login"}
          >
            <User className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          <IconButton
            label={`Cart${count ? `, ${count} item${count === 1 ? "" : "s"}` : ", empty"}`}
            text="Cart"
            onClick={openCart}
            badge={count}
          >
            <ShoppingBag className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>
        </div>
      </nav>
    </header>
  );
}

/**
 * The Fragrances dropdown. Opens on hover AND on focus/click — a hover-only
 * menu is unusable by keyboard and on touch. Closes on Escape, on outside
 * click, and on navigation.
 *
 * Only SINGLE products appear. Gift sets used to be listed here — the query
 * behind this never filtered by type — which put "Discovery Set" under a
 * heading that is not what it is, and pointed it at a fragrance URL that
 * refuses to render a combo. Sets have their own top-level nav entry.
 */
function FragrancesMenu({ fragrances }: { fragrances: NavFragrance[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const singles = fragrances.filter((f) => f.type === "SINGLE");

  useEffect(() => setOpen(false), [pathname]);

  /**
   * Closing is deferred; opening is not.
   *
   * The panel sits a few pixels below the trigger, and that gap is real screen
   * the pointer has to cross. Closing synchronously on mouseleave meant the
   * menu shut the instant you moved toward it — the trigger's box ends, the
   * pointer is briefly over bare header, and the handler fires before the
   * panel is ever entered. The grace period covers the crossing; entering
   * either element cancels it.
   */
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Guards on what the menu actually lists: a catalogue holding only gift sets
  // would otherwise render a "Fragrances" trigger opening an empty panel.
  if (singles.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="link-draw inline-flex items-center gap-1.5 whitespace-nowrap font-sans text-micro uppercase text-bone/90"
      >
        Fragrances
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-400 ease-smoke", open && "rotate-180")}
          strokeWidth={1.6}
        />
      </button>

      {open && (
        /*
          The gap between trigger and panel is PADDING, not margin.

          It was `marginTop: 0.5rem`, which puts 8px of bare header between the
          wrapper's box and the panel's. The pointer crossing that strip is
          over neither element, so mouseleave fired and the menu closed before
          it could be reached — the menu was effectively unusable with a mouse.
          As top padding the same 8px belongs to the panel, so the hover region
          is continuous from trigger to first link.
        */
        <div
          className="glass-strong absolute left-1/2 top-full z-10 w-60 -translate-x-1/2 pt-4"
          onMouseEnter={cancelClose}
        >
          <ul className="py-2">
            {singles.map((f) => (
              <li key={f.slug}>
                <Link
                  href={f.href}
                  className="block px-5 py-2.5 font-display text-lg font-light text-bone transition-colors duration-300 hover:bg-gold/[0.06] hover:text-gold-light"
                >
                  {f.name.replace(/^Avenues\s+/i, "")}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-1">
              <Link
                href="/shop"
                className="block px-5 py-2.5 font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light"
              >
                Shop the range
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  text,
  onClick,
  href,
  badge,
  className,
}: {
  children: React.ReactNode;
  /** Full accessible name. */
  label: string;
  /** Visible label, shown from `xl` up. */
  text?: string;
  onClick?: () => void;
  href?: string;
  badge?: number;
  className?: string;
}) {
  const classes = cn(
    // Tighter horizontal padding below `sm`: the phone bar now carries four
    // controls (menu, wishlist, account, cart) where it used to carry two, and
    // the padding is the only place to find the room. The 44px tap target is
    // preserved by `h-11` plus the gap, not by the padding.
    "relative inline-flex h-11 items-center justify-center gap-2 px-1.5 sm:px-2.5 text-bone/85",
    "transition-colors duration-300 ease-smoke hover:text-gold-light",
    className,
  );

  const inner = (
    <>
      <span className="relative inline-flex">
        {children}
        {typeof badge === "number" && badge > 0 && (
          <span
            className="absolute -right-2 -top-1.5 min-w-[1.05rem] rounded-pill bg-gold px-1
                       text-center font-sans text-[0.625rem] font-medium leading-[1.05rem] text-ink"
            aria-hidden="true"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {/*
        1400px, matching this file's own note above and the spec in
        e2e/storefront/home.spec.ts. It had drifted to 1650, so at the 1440px
        the desktop suite runs at — and on most laptops — every utility control
        was an unlabelled icon, which is the exact thing the brief rules out.
      */}
      {text && (
        <span className="hidden max-w-[7rem] truncate font-sans text-micro uppercase min-[1400px]:inline">
          {text}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}
