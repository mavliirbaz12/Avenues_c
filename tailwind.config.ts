import type { Config } from "tailwindcss";

/**
 * "Noir Gold" — the Avenues design system.
 *
 * Two rules the palette enforces by omission: there is no pure white and no
 * pure black. Everything sits on warm near-black, and every light value is
 * bone rather than white, so the whole surface reads as candlelit glass.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0B0D", // page base
          deep: "#060607", // wells, footer, overlays
        },
        surface: {
          DEFAULT: "#141416", // cards
          raised: "#1B1B1E", // menus, inputs, hovered cards
          sunken: "#101012",
        },
        line: {
          DEFAULT: "#232327", // hairline borders
          strong: "#33333A",
          gold: "rgba(201, 162, 75, 0.28)",
        },
        gold: {
          DEFAULT: "#C9A24B",
          light: "#E8CE8C", // hover, glints, focus
          deep: "#8A6B2A", // gradient shadow side
        },
        bone: {
          DEFAULT: "#F2EDE3", // primary text
          dim: "#CFC7B9",
        },
        stone: {
          DEFAULT: "#9A938A", // secondary text
          dark: "#6B655D", // tertiary / disabled
        },
        bordeaux: {
          DEFAULT: "#3A1220", // rare accent: sale + offer tags only
          light: "#5C1E33",
        },
        // Semantic states, desaturated to sit inside the dark palette.
        success: "#5E8C6A",
        warning: "#C9873B",
        danger: "#B4544E",
      },
      fontFamily: {
        display: ["var(--font-display)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-sans)", "Jost", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fluid display scale — the site's voice.
        d1: ["clamp(3rem, 9.5vw, 8rem)", { lineHeight: "0.94", letterSpacing: "-0.02em" }],
        d2: ["clamp(2.5rem, 6.5vw, 5rem)", { lineHeight: "1.0", letterSpacing: "-0.015em" }],
        d3: ["clamp(2rem, 4.5vw, 3.5rem)", { lineHeight: "1.06", letterSpacing: "-0.01em" }],
        d4: ["clamp(1.625rem, 3.2vw, 2.5rem)", { lineHeight: "1.14", letterSpacing: "-0.005em" }],
        d5: ["clamp(1.375rem, 2.2vw, 1.75rem)", { lineHeight: "1.2" }],
        // The recurring letter-spaced uppercase device.
        micro: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.3em" }],
        label: ["0.75rem", { lineHeight: "1.3", letterSpacing: "0.2em" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.75" }],
      },
      letterSpacing: {
        micro: "0.3em",
        label: "0.2em",
        wide2: "0.12em",
      },
      maxWidth: {
        shell: "88rem", // 1408px — the page gutter container
        prose2: "68ch",
      },
      spacing: {
        gutter: "clamp(1.25rem, 4vw, 4rem)",
        section: "clamp(4.5rem, 10vw, 9rem)",
      },
      borderRadius: {
        card: "2px", // near-square: engraved label, not app UI
        pill: "999px",
      },
      boxShadow: {
        // Gold rim-light glow for product cards on hover.
        rim: "0 0 0 1px rgba(201,162,75,0.35), 0 24px 60px -20px rgba(201,162,75,0.22)",
        lift: "0 32px 80px -32px rgba(0,0,0,0.9)",
        inset: "inset 0 1px 0 0 rgba(242,237,227,0.04)",
      },
      transitionTimingFunction: {
        // "Slow smoke" — the house easing. Nothing in this site bounces.
        smoke: "cubic-bezier(0.22, 1, 0.36, 1)",
        veil: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        400: "400ms",
        600: "600ms",
        900: "900ms",
      },
      keyframes: {
        "ring-draw": {
          from: { strokeDashoffset: "var(--ring-length)" },
          to: { strokeDashoffset: "0" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(1.25rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "veil-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "rise-in": "rise-in 700ms cubic-bezier(0.22,1,0.36,1) both",
        "veil-in": "veil-in 500ms cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.8s infinite",
        "spin-slow": "spin-slow 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
