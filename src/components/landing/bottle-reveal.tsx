"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion, useScroll } from "motion/react";
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
 * Smoothed, not snapped. `currentFrame` chases `targetFrame` through a lerp on
 * rAF. Mapping scroll straight to a frame index feels mechanical; the easing
 * is what makes it read as a camera move.
 *
 * Reduced motion mounts none of this — no canvas, no rAF, and critically no
 * sequence request at all. It renders one final frame and the text beats as
 * ordinary content, which matches how every other motion component here
 * degrades.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS WAS REWRITTEN — three faults that compounded into "the page lags"
 *
 * 1. MEMORY. The old version decoded all 120 frames and held every one for the
 *    life of the page. Decoded size is what counts, not file size, and it is
 *    invisible in a network tab: the phone frames are 460x576, so
 *    460 x 576 x 4 bytes = 1.06MB each = ~127MB resident. Desktop frames are
 *    1024x576, so ~283MB. On a mid-range Android that is GC thrash, scroll
 *    stutter across the WHOLE page, and sometimes a tab reload. The 2.7MB of
 *    WebP everyone looks at was never the problem.
 *
 *    Now: ImageBitmaps, not HTMLImageElements, because a bitmap can be
 *    explicitly close()d — an <img> is released whenever the GC feels like it,
 *    which is not a policy. A coarse every-8th set stays resident as the
 *    fallback layer, plus a sliding window around the current frame. Peak is
 *    ~32 frames instead of 120.
 *
 * 2. THE rAF LOOP NEVER STOPPED. It started once `ready` and ran until the
 *    page was unloaded — redrawing a full-screen canvas while you read the
 *    footer, and while the tab sat in the background. Now it is gated on the
 *    section actually being on screen and the tab being visible, and the
 *    IntersectionObserver stays connected instead of disconnecting after the
 *    first hit.
 *
 * 3. REACT RE-RENDERED ON EVERY SCROLL FRAME. `scrollYProgress.on("change")`
 *    called setProgress, so the component and its three motion.div beats
 *    re-rendered on every scroll tick. The beats are now plain elements driven
 *    by direct style writes inside the existing rAF tick — the same work the
 *    canvas draw already does, with no reconciliation behind it.
 * ---------------------------------------------------------------------------
 */

/** Must match FRAMES in scripts/gen-bottle-sequence.mjs. */
const FRAME_COUNT = 120;
/**
 * Every Nth frame is loaded first AND kept forever.
 *
 * Fifteen frames is a small permanent cost (~16MB on a phone) that guarantees
 * `nearestLoaded` always has something within four frames to draw, so a fast
 * flick never shows a blank stage while the window catches up.
 */
const COARSE_STRIDE = 8;
/**
 * Frames kept either side of the current one.
 *
 * Eight covers about a viewport of scrolling at normal speed, which is far
 * more than the lerp can traverse between two loads. Raising it costs ~1MB per
 * frame per side on a phone.
 */
const WINDOW_RADIUS = 8;
/**
 * How much of the frame's height may be cropped to reach full width.
 *
 * 15% is the most that can come off the top and bottom of these frames before
 * it starts taking the cap of the bottle.
 */
const MAX_CROP = 0.15;

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

/** The frames that must be resident for a given centre. */
function windowFor(center: number) {
  const keep = new Set<number>();
  for (let i = 0; i < FRAME_COUNT; i += COARSE_STRIDE) keep.add(i);
  keep.add(FRAME_COUNT - 1);
  const lo = Math.max(0, center - WINDOW_RADIUS);
  const hi = Math.min(FRAME_COUNT - 1, center + WINDOW_RADIUS);
  for (let i = lo; i <= hi; i++) keep.add(i);
  return keep;
}

export function BottleReveal() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const beatRefs = useRef<Array<HTMLDivElement | null>>([]);

  const framesRef = useRef<Array<ImageBitmap | null>>([]);
  const inflightRef = useRef<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  /**
   * Whether the section is close enough to be worth downloading.
   *
   * The sequence is several megabytes. Fetching it the moment the page mounts
   * made every arrival at the homepage — including someone who only wanted the
   * nav — pull it down whether or not they ever scrolled, competing with the
   * requests for whatever page they clicked next.
   */
  const [near, setNear] = useState(false);

  /**
   * Whether the stage is actually on screen.
   *
   * Separate from `near`, and the distinction is the point: `near` arms the
   * loader a viewport early and stays true, while this goes false again the
   * moment the section leaves, which is what stops the rAF loop.
   */
  const onScreenRef = useRef(false);

  /**
   * The second gate: the page must have finished loading first.
   *
   * The hero is about 790px tall and a laptop viewport is about 800px, so the
   * wrapper's top edge is ALREADY on screen at scroll zero — every rootMargin
   * fires on mount and the observer buys nothing on its own. Frame requests
   * then opened while the hero image, the fonts and the route JS were still in
   * flight, and because the browser counts them as part of the initial load,
   * the tab kept its spinner running for as long as the sequence took to
   * stream — which reads as a page that never finishes.
   */
  const [afterLoad, setAfterLoad] = useState(false);

  /**
   * Which frame set to draw — and it has to be able to CHANGE.
   *
   * This was read once, from `window.innerWidth`, when the loader first ran.
   * Any viewport change after that left the wrong set decoded: open devtools
   * on a laptop, or rotate a tablet, and the phone frames (460x576, portrait)
   * stayed on a wide canvas, where `contain` letterboxed them with black down
   * both sides.
   */
  const [variant, setVariant] = useState<"lg" | "sm">("lg");

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${SMALL_BP - 1}px)`);
    const sync = () => setVariant(mq.matches ? "sm" : "lg");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (document.readyState === "complete") {
      setAfterLoad(true);
      return;
    }
    const on = () => setAfterLoad(true);
    window.addEventListener("load", on, { once: true });
    return () => window.removeEventListener("load", on);
  }, []);

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

      // FILL THE WIDTH, and allow a bounded crop of the height to do it.
      //
      // Plain `contain` guarantees the subject is never cut, but on a phone
      // that means the frame is fitted to whichever edge runs out first, and
      // the section stops reaching the sides of the screen. A full-bleed image
      // is most of the point of this section.
      //
      // Plain `cover` is the other extreme and was tried first: on a short
      // wide window it sliced the top and bottom off the bottle.
      const scale = Math.min(cw / img.width, (ch / img.height) * (1 + MAX_CROP));
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    },
    [nearestLoaded],
  );

  // ---- Observe the section ------------------------------------------------
  // One observer, two jobs, and it stays connected. The old one disconnected
  // after the first intersection, which is why nothing was ever able to tell
  // the rAF loop that the section had left again.
  useEffect(() => {
    if (reduce) return;
    const el = wrapRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      onScreenRef.current = true;
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        onScreenRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setNear(true);
      },
      // A viewport of lead-in, so loading starts before the stage arrives.
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  /** Set by the loader effect; called by the scrub to slide the resident window. */
  const reconcileRef = useRef<((center: number) => void) | null>(null);

  // ---- Load the sequence --------------------------------------------------
  useEffect(() => {
    if (reduce || !near || !afterLoad) return;

    let cancelled = false;
    const frames: Array<ImageBitmap | null> = new Array(FRAME_COUNT).fill(null);
    framesRef.current = frames;
    inflightRef.current = new Set();

    /**
     * Decode straight to an ImageBitmap.
     *
     * `createImageBitmap` hands back an object we can free on demand, which is
     * the whole reason this is not an <img>: releasing 120 HTMLImageElements
     * means dropping references and hoping, and the old code did not even do
     * that — it held all of them deliberately.
     */
    const load = async (i: number) => {
      if (frames[i] || inflightRef.current.has(i)) return;
      inflightRef.current.add(i);
      try {
        const res = await fetch(frameUrl(variant, i));
        if (!res.ok) return;
        const bitmap = await createImageBitmap(await res.blob());
        // The variant may have flipped, or the component unmounted, while this
        // was in flight — dropping the reference would leak the bitmap.
        if (cancelled || framesRef.current !== frames) {
          bitmap.close();
          return;
        }
        frames[i] = bitmap;
      } catch {
        // A missing or undecodable frame must not stall anything; the
        // nearest-loaded fallback covers the gap.
      } finally {
        inflightRef.current.delete(i);
      }
    };

    /** Load what the window needs and free what it does not. */
    const reconcile = (center: number) => {
      if (cancelled) return;
      const keep = windowFor(center);
      for (let i = 0; i < FRAME_COUNT; i++) {
        if (keep.has(i)) {
          void load(i);
        } else if (frames[i]) {
          frames[i]!.close();
          frames[i] = null;
        }
      }
    };
    reconcileRef.current = reconcile;

    (async () => {
      // Priority pass: the coarse set makes the scrub usable almost at once.
      const coarse: number[] = [];
      for (let i = 0; i < FRAME_COUNT; i += COARSE_STRIDE) coarse.push(i);
      if (coarse[coarse.length - 1] !== FRAME_COUNT - 1) coarse.push(FRAME_COUNT - 1);
      await Promise.all(coarse.map(load));
      if (cancelled) return;

      setReady(true);
      draw(0);
      reconcile(0);
    })();

    return () => {
      cancelled = true;
      reconcileRef.current = null;
      for (let i = 0; i < FRAME_COUNT; i++) {
        frames[i]?.close();
        frames[i] = null;
      }
    };
  }, [reduce, near, afterLoad, variant, draw]);


  // ---- Scrub --------------------------------------------------------------
  useEffect(() => {
    if (reduce || !ready) return;

    let raf = 0;
    let current = 0;
    let target = 0;
    let lastDrawn = -1;
    let lastWindow = -1;
    let progress = 0;

    /**
     * The beats, written directly.
     *
     * This used to be React state plus three motion.div animations, which
     * meant a render pass per scroll tick. The transition lives in CSS now, so
     * a write here is a style change the compositor handles — no diffing, no
     * reconciliation, and the same easing on screen.
     */
    const paintBeats = () => {
      for (let i = 0; i < BEATS.length; i++) {
        const el = beatRefs.current[i];
        if (!el) continue;
        const beat = BEATS[i]!;
        const on = progress >= beat.at && progress < beat.until;
        el.style.opacity = on ? "1" : "0";
        el.style.transform = on ? "translateY(0)" : "translateY(18px)";
        el.style.pointerEvents = on ? "auto" : "none";
      }
      if (barRef.current) {
        barRef.current.style.width = `${Math.round(progress * 100)}%`;
      }
    };

    const unsubscribe = scrollYProgress.on("change", (p) => {
      target = p * (FRAME_COUNT - 1);
      progress = p;
    });

    const tick = () => {
      // Stop burning frames when nobody can see the result. The loop used to
      // run for the life of the page; on a long homepage that is a full-screen
      // canvas redraw behind every other section.
      if (!onScreenRef.current || document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // Chase, don't jump. 0.18 is the point where it still tracks the scroll
      // closely but loses the mechanical one-to-one feel.
      current += (target - current) * 0.18;
      const frame = Math.round(current);
      if (frame !== lastDrawn) {
        draw(frame);
        paintBeats();
        lastDrawn = frame;

        // Slide the resident window, but not on every single frame — moving it
        // costs a pass over 120 slots, and four frames of travel is well
        // inside the radius.
        if (lastWindow < 0 || Math.abs(frame - lastWindow) >= 4) {
          reconcileRef.current?.(frame);
          lastWindow = frame;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    paintBeats();
    raf = requestAnimationFrame(tick);

    const onResize = () => draw(lastDrawn < 0 ? 0 : lastDrawn);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      window.removeEventListener("resize", onResize);
    };
  }, [reduce, ready, scrollYProgress, draw]);

  // ---- Reduced motion -----------------------------------------------------
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
          which is exactly backwards for bottom-anchored type.
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
              const isLast = i === BEATS.length - 1;
              return (
                <div
                  key={beat.title}
                  ref={(el) => {
                    beatRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 bottom-[12vh] px-gutter"
                  // Opacity and transform are written by the rAF tick; the
                  // easing is declared here so the compositor owns it.
                  style={{
                    opacity: 0,
                    transform: "translateY(18px)",
                    pointerEvents: "none",
                    transition: "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1)",
                  }}
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress hairline — the same gauge device as the featured slider. */}
        <div
          aria-hidden="true"
          className="absolute bottom-6 left-1/2 h-px w-[7rem] -translate-x-1/2 bg-line-strong"
        >
          <div ref={barRef} className="h-px w-0 bg-gold" />
        </div>
      </section>
    </div>
  );
}
