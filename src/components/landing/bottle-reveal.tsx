"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The scroll-scrubbed bottle reveal.
 *
 * A tall wrapper holds a sticky, full-height stage. As you scroll the wrapper
 * past the viewport, scroll progress scrubs a frame sequence: an extreme macro
 * on the engraved monogram pulling back to the whole bottle. Scrolling up
 * reverses it. Frames come from `npm run gen:sequence`.
 *
 * DESIGN NOTES
 *
 * Canvas, not an <img> whose src is swapped. Reassigning src 120 times fights
 * the browser's image pipeline — you get decode jank and occasional blank
 * frames mid-scrub. Drawing pre-decoded bitmaps to a canvas is frame-accurate.
 *
 * Two-stage load. Every 8th frame is fetched first (15 frames, ~340KB on
 * desktop / ~160KB on mobile), which makes the scrub usable almost at once;
 * the remaining 105 stream in behind it. Until an exact frame lands the draw
 * falls back to the nearest one already decoded, so the sequence degrades in
 * smoothness rather than breaking. This is the whole difference between this
 * and the reference implementation that inspired it, which eagerly preloads
 * 600 PNGs — roughly 200MB — before the section works at all.
 *
 * Smoothed, not snapped. `currentFrame` chases `targetFrame` through a lerp on
 * rAF. Mapping scroll straight to a frame index feels mechanical; the easing
 * is what makes it read as a camera move.
 *
 * Reduced motion mounts none of this — no canvas, no rAF, and critically no
 * sequence request at all. It renders one final frame and the text beats as
 * ordinary content, which matches how every other motion component here
 * degrades.
 */

/** Must match FRAMES in scripts/gen-bottle-sequence.mjs. */
const FRAME_COUNT = 120;
/** Every Nth frame in the priority pass. */
const COARSE_STRIDE = 8;
/** Below this viewport width we load the 640px frames instead of 1200px. */
const SMALL_BP = 768;

const frameUrl = (variant: "lg" | "sm", i: number) =>
  `/sequence/${variant}-${String(i).padStart(4, "0")}.webp`;

/** Text beats, keyed to scroll progress. */
const BEATS = [
  { at: 0, until: 0.3, title: "It starts as detail.", body: "Gold, pressed into black glass." },
  { at: 0.38, until: 0.62, title: "Then it becomes form.", body: "Weight you notice before you open it." },
  { at: 0.72, until: 1.01, title: "Then it becomes yours.", body: null },
] as const;

export function BottleReveal() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const framesRef = useRef<Array<HTMLImageElement | null>>([]);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  /**
   * Whether the section is close enough to be worth downloading.
   *
   * The sequence is ~6MB. Fetching it the moment the page mounts made every
   * arrival at the homepage — including someone who only wanted the nav —
   * pull six megabytes it might never look at, and it competed with the
   * requests for whatever page they clicked next. It now starts a full
   * viewport before the section reaches the screen, which on any real scroll
   * is still far earlier than it is needed.
   */
  const [near, setNear] = useState(false);

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    // Start when the wrapper's top hits the viewport top, finish when its
    // bottom does — i.e. exactly the span over which the sticky child is
    // pinned.
    offset: ["start start", "end end"],
  });

  /** Nearest decoded frame at or before `i`, else the nearest after. */
  const nearestLoaded = useCallback((i: number) => {
    const frames = framesRef.current;
    if (frames[i]) return frames[i];
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }, []);

  const draw = useCallback(
    (index: number) => {
      const canvas = canvasRef.current;
      const img = nearestLoaded(index);
      if (!canvas || !img) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      // Cover, not contain. Frames are generated at the aspect of the device
      // they play on, so the crop here is small — but the section has to read
      // as full-bleed, and contain would letterbox it the moment a viewport
      // was a little wider or taller than the generated ratio.
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    },
    [nearestLoaded],
  );

  // ---- Arm the loader when the section approaches -------------------------
  useEffect(() => {
    if (reduce) return;
    const el = wrapRef.current;
    if (!el) return;

    // No IntersectionObserver (very old browsers): load immediately rather
    // than never.
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  // ---- Load the sequence -------------------------------------------------
  useEffect(() => {
    if (reduce || !near) return;

    let cancelled = false;
    const variant: "lg" | "sm" = window.innerWidth < SMALL_BP ? "sm" : "lg";
    framesRef.current = new Array(FRAME_COUNT).fill(null);

    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.src = frameUrl(variant, i);
        img
          .decode()
          .then(() => {
            if (!cancelled) framesRef.current[i] = img;
            resolve();
          })
          // A missing frame must not stall the chain — the nearest-loaded
          // fallback covers the gap.
          .catch(() => resolve());
      });

    (async () => {
      const coarse: number[] = [];
      for (let i = 0; i < FRAME_COUNT; i += COARSE_STRIDE) coarse.push(i);
      if (coarse[coarse.length - 1] !== FRAME_COUNT - 1) coarse.push(FRAME_COUNT - 1);

      await Promise.all(coarse.map(load));
      if (cancelled) return;
      setReady(true);
      draw(0);

      // The rest, in order, without blocking the scrub.
      const rest = Array.from({ length: FRAME_COUNT }, (_, i) => i).filter(
        (i) => !framesRef.current[i],
      );
      for (const i of rest) {
        if (cancelled) return;
        await load(i);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reduce, near, draw]);

  // ---- Scrub -------------------------------------------------------------
  useEffect(() => {
    if (reduce || !ready) return;

    let raf = 0;
    let current = 0;
    let target = 0;
    let lastDrawn = -1;

    const unsubscribe = scrollYProgress.on("change", (p) => {
      target = p * (FRAME_COUNT - 1);
      setProgress(p);
    });

    const tick = () => {
      // Chase, don't jump. 0.18 is the point where it still tracks the scroll
      // closely but loses the mechanical one-to-one feel.
      current += (target - current) * 0.18;
      const frame = Math.round(current);
      if (frame !== lastDrawn) {
        draw(frame);
        lastDrawn = frame;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => draw(lastDrawn < 0 ? 0 : lastDrawn);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      window.removeEventListener("resize", onResize);
    };
  }, [reduce, ready, scrollYProgress, draw]);

  // ---- Reduced motion ----------------------------------------------------
  if (reduce) {
    return (
      <section
        className="relative bg-ink py-section"
        aria-labelledby="reveal-heading"
        data-testid="bottle-reveal"
        data-reduced="true"
      >
        <div className="shell flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frameUrl("lg", FRAME_COUNT - 1)}
            alt="The Avenues bottle — black glass with the gold monogram engraved on the face."
            className="max-h-[60vh] w-auto"
          />
          <h2
            id="reveal-heading"
            className="mt-12 max-w-2xl font-display text-d3 font-light text-bone"
          >
            {BEATS[BEATS.length - 1].title}
          </h2>
          <Link href="#collection" className="btn btn-primary btn-lg mt-8">
            Explore the collection
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div
      id="reveal"
      ref={wrapRef}
      className="relative bg-ink"
      // Scroll runway. The sticky child is pinned for (height - 100dvh), so
      // 400vh gives three viewport-heights of scrub — enough for 120 frames
      // to advance without feeling either rushed or interminable.
      style={{ height: "400vh" }}
      data-testid="bottle-reveal"
    >
      <section
        className="sticky top-0 flex h-[100dvh] items-center justify-center overflow-hidden"
        aria-labelledby="reveal-heading"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-1000 ease-smoke",
            ready ? "opacity-100" : "opacity-0",
          )}
          // The canvas is decoration; the beats below carry the meaning.
          aria-hidden="true"
          data-testid="bottle-reveal-canvas"
        />

        {/*
          Bottom-weighted scrim. The beats sit in the lower third, and at the
          middle of the sequence the gold monogram fills the frame — white
          display type straight over it was unreadable. A radial vignette was
          the wrong instrument: it darkens the edges and leaves the centre lit,
          which is exactly backwards for bottom-anchored type. The soft edge
          vignette stays, at low strength, to keep the frame from feeling cut
          off.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,11,13,0.45) 0%, rgba(11,11,13,0) 26%, rgba(11,11,13,0.15) 48%, rgba(11,11,13,0.72) 74%, rgba(11,11,13,0.94) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 70% at 50% 45%, rgba(11,11,13,0) 40%, rgba(11,11,13,0.5) 100%)",
          }}
        />

        {/* Text beats. Only one is on screen at a time. */}
        <div className="relative z-[2] flex h-full w-full flex-col items-center justify-end pb-[12vh] text-center">
          <div className="shell">
            {BEATS.map((beat, i) => {
              const on = progress >= beat.at && progress < beat.until;
              const isLast = i === BEATS.length - 1;
              return (
                <motion.div
                  key={beat.title}
                  className={cn("absolute inset-x-0 bottom-[12vh] px-gutter", !on && "pointer-events-none")}
                  initial={false}
                  animate={{ opacity: on ? 1 : 0, y: on ? 0 : 18 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h2
                    {...(isLast ? { id: "reveal-heading" } : {})}
                    className="mx-auto max-w-2xl font-display text-d3 font-light text-bone"
                  >
                    {beat.title}
                  </h2>
                  {beat.body && (
                    <p className="mx-auto mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
                      {beat.body}
                    </p>
                  )}
                  {isLast && (
                    <Link href="#collection" className="btn btn-primary btn-lg mt-8">
                      Explore the collection
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Progress hairline — the same gauge device as the featured slider. */}
        <div
          aria-hidden="true"
          className="absolute bottom-6 left-1/2 h-px w-[7rem] -translate-x-1/2 bg-line-strong"
        >
          <div
            className="h-px bg-gold transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </section>
    </div>
  );
}
