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
import { cn } from "@/lib/utils";

export type NavFragrance = { slug: string; name: string };

/**
 * Primary navigation.
 *
 * Every control carries a visible label or a count — no icon is left for a
 * first-time visitor to decode.
 *
 * The six primary links keep their words at every desktop width. The four
 * utility controls need ~1620px to share the line with them, which is what
 * adding "Gift sets" cost; below that they fall back to icons carrying the
 * same `aria-label`s, rather than letting the bar collide with the logo.
 */
export function SiteNav({
  isAuthed,
  firstName,
  fragrances,
}: {
  isAuthed: boolean;
  /** Shown in place of "Login" once signed in. */
  firstName?: string | null;
  fragrances: NavFragrance[];
}) {
  const pathname = usePathname();
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
  const accountLabel = isAuthed ? (firstName?.trim() || "Account") : "Login";

  return (
    <header
      className={cn(
        "fixed inset-x-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-600 ease-smoke",
        solid ? "glass glass-hairline border-x-0 border-t-0" : "border-transparent bg-transparent",
      )}
      style={{ top: "var(--announce-h)", height: "var(--nav-h)" }}
    >
      <nav className="shell flex h-full items-center justify-between gap-4" aria-label="Primary">
        <div className="flex items-center gap-2 lg:hidden">
          <IconButton label="Open menu" onClick={openMenu}>
            <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
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

          <IconButton
            label={`Wishlist${wishIds.length ? `, ${wishIds.length} saved` : ""}`}
            text="Wishlist"
            href="/wishlist"
            badge={wishIds.length}
            className="hidden sm:inline-flex"
          >
            <Heart className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          <IconButton
            label={isAuthed ? "Your account" : "Sign in"}
            text={accountLabel}
            href={isAuthed ? "/account" : "/login"}
            className="hidden sm:inline-flex"
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
 */
function FragrancesMenu({ fragrances }: { fragrances: NavFragrance[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

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

  if (fragrances.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
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
        <div
          className="glass-strong absolute left-1/2 top-full z-10 w-60 -translate-x-1/2 pt-2"
          // Bridges the gap between trigger and panel so the pointer can
          // travel without the menu closing under it.
          style={{ marginTop: "0.5rem" }}
        >
          <ul className="py-2">
            {fragrances.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/fragrance/${f.slug}`}
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
                Shop all five
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
    "relative inline-flex h-11 items-center justify-center gap-2 px-2.5 text-bone/85",
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
      {text && (
        <span className="hidden max-w-[7rem] truncate font-sans text-micro uppercase min-[1620px]:inline">
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
