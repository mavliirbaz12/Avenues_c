"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, User, ShoppingBag, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useCart, cartCount } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "Our story" },
  { href: "/track", label: "Track order" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav({ isAuthed }: { isAuthed: boolean }) {
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

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-600 ease-smoke",
        solid ? "glass glass-hairline border-x-0 border-t-0" : "border-transparent bg-transparent",
      )}
      style={{ height: "var(--nav-h)" }}
    >
      <nav
        className="shell flex h-full items-center justify-between gap-4"
        aria-label="Primary"
      >
        {/* Mobile: menu trigger. Desktop: logo. */}
        <div className="flex items-center gap-2 lg:hidden">
          <IconButton label="Open menu" onClick={openMenu}>
            <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
          <Logo size="md" />
        </div>

        <ul className="hidden items-center gap-9 lg:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className="link-draw font-sans text-micro uppercase text-bone/90"
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-0.5 sm:gap-1.5">
          <IconButton label="Search fragrances" onClick={openSearch} className="hidden sm:inline-flex">
            <Search className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          <IconButton
            label={`Wishlist${wishIds.length ? `, ${wishIds.length} saved` : ""}`}
            href="/wishlist"
            badge={wishIds.length}
            className="hidden sm:inline-flex"
          >
            <Heart className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          <IconButton
            label={isAuthed ? "Your account" : "Sign in"}
            href={isAuthed ? "/account" : "/login"}
            className="hidden sm:inline-flex"
          >
            <User className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.4} />
          </IconButton>

          <IconButton
            label={`Cart${count ? `, ${count} item${count === 1 ? "" : "s"}` : ", empty"}`}
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

function IconButton({
  children,
  label,
  onClick,
  href,
  badge,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: number;
  className?: string;
}) {
  const classes = cn(
    "relative inline-flex h-11 w-11 items-center justify-center text-bone/85",
    "transition-colors duration-300 ease-smoke hover:text-gold-light",
    className,
  );

  const inner = (
    <>
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span
          className="absolute right-1 top-1.5 min-w-[1.05rem] rounded-pill bg-gold px-1
                     text-center font-sans text-[0.625rem] font-medium leading-[1.05rem] text-ink"
          aria-hidden="true"
        >
          {badge > 9 ? "9+" : badge}
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
