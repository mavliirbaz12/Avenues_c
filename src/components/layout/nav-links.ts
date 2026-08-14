/**
 * The primary navigation, in one place.
 *
 * Desktop and the mobile drawer previously kept separate arrays and had
 * drifted — desktop said "Shop", mobile said "Shop all". One source now.
 */
export const NAV_LINKS = [
  { href: "/shop", label: "Shop all" },
  { href: "/about", label: "Know Avenues" },
  { href: "/track-order", label: "Track order" },
  { href: "/contact", label: "Contact" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
