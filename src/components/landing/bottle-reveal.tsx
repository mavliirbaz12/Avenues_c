"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The bottle film — a full-bleed video that plays itself.
 *
 * This used to be a scroll-scrubbed frame sequence: 120 WebP stills drawn to a
 * canvas, with a 400vh runway pinning a sticky stage so the scrollbar acted as
 * a transport control. It was replaced by the film it was cut from.
 *
 * WHY THE VIDEO IS BETTER HERE, not just simpler:
 *
 * - The scrub made the reveal conditional on the visitor scrolling at roughly
 *   the right speed. Scroll fast and the camera move is a blur; stop halfway
 *   and the bottle is frozen mid-pull-back. A film plays at the speed it was
 *   cut at, which is the speed it was cut at for a reason.
 * - It cost 400vh of page. Three viewport-heights of scrolling bought one
 *   six-second move, and everything below the fold was that much further away.
 * - 7.3MB of committed frames and a decode budget that had already caused one
 *   round of memory work become a single 1.3MB h264 file the browser decodes
 *   on its own hardware path.
 *
 * WHAT WAS KEPT
 *
 * The three text beats, and their timing. They now ride the video's clock
 * instead of the scrollbar's — same copy, same in and out points, driven by
 * `timeupdate` rather than scroll progress. The narrative was the point; the
 * scrollbar was only ever the thing that happened to be driving it.
 *
 * FULL BLEED, AND THE CROP THAT COMES WITH IT
 *
 * The film is 16:9. `object-cover` fills the width edge to edge and takes the
 * difference out of the sides, so the stage height decides how much is lost:
 *
 *   phones    62vh — about 0.87:1, inside the 4:5 centre crop the sequence
 *                    generator had already verified keeps the bottle in shot
 *                    across the whole clip
 *   sm and up 100dvh — roughly 1.6:1 against a 1.78:1 source, a few percent
 *                    off the sides and nothing near the subject
 *
 * A full-height stage on a phone would be ~0.46:1, which crops 16:9 down to a
 * quarter of its width and loses the bottle entirely. That is the reason for
 * the breakpoint, and it is not a taste call.
 */

const BEATS = [
  { at: 0, until: 0.3, title: "It starts as detail.", body: "Gold, pressed into black glass." },
  { at: 0.38, until: 0.62, title: "Then it becomes form.", body: "Weight you notice before you open it." },
  { at: 0.72, until: 1.01, title: "Then it becomes yours.", body: null },
] as const;

const POSTER = "/hero-reveal-poster.webp";
const FILM = "/hero-reveal.mp4";

export function BottleReveal() {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const beatRefs = useRef<Array<HTMLDivElement | null>>([]);
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * True when the film is not going to play on its own — reduced motion, Data
   * Saver, or an autoplay the browser refused. All three land in the same
   * place: the poster, with the final beat and the CTA pinned over it. No play
   * button anywhere — someone on reduced motion has said they do not want this
   * moving, and a control offering to move it anyway is the wrong answer.
   */
  const [manual, setManual] = useState(false);

  /**
   * The film loops forever. The COPY does not.
   *
   * These are two different clocks on purpose. A hero that stops moving reads
   * as a broken video, so the film runs continuously and there are no controls
   * over it — nothing to press, nothing to dismiss.
   *
   * But the beats ride the film's clock, and tying them to the loop as well
   * meant that every six seconds the headline snapped back to "It starts as
   * detail." and the Explore the collection button under the final beat
   * disappeared with it. A call to action that blinks out of existence on a
   * timer costs more than the motion is worth.
   *
   * So the narrative plays once — detail, form, yours — and then settles. The
   * film keeps rolling underneath it. `narrated` is the flag for "the story
   * has been told"; after it flips, the clock still drives the picture and
   * stops driving the type.
   */
  const [narrated, setNarrated] = useState(false);
  const narratedRef = useRef(false);
  const lastProgress = useRef(0);

  /**
   * Save-Data is a real signal on this store's primary market, and a hero
   * video is exactly the kind of thing it is asking us not to send. Checked on
   * the client only — it is a browser hint, and reading it during render would
   * mismatch the server's HTML.
   */
  useEffect(() => {
    if (reduce) {
      setManual(true);
      return;
    }
    const conn = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (conn?.saveData) setManual(true);
  }, [reduce]);

  /** Paint the beats and the progress hairline for a given 0..1 position. */
  const paint = useCallback((progress: number) => {
    for (let i = 0; i < BEATS.length; i++) {
      const el = beatRefs.current[i];
      if (!el) continue;
      const beat = BEATS[i]!;
      const on = progress >= beat.at && progress < beat.until;
      el.style.opacity = on ? "1" : "0";
      el.style.transform = on ? "translateY(0)" : "translateY(18px)";
    }
    if (barRef.current) barRef.current.style.width = `${Math.min(1, progress) * 100}%`;
  }, []);

  /**
   * Play only while on screen.
   *
   * A looping video left running under the footer burns battery and data for
   * nobody, and on a phone that is the difference between a hero and a
   * complaint. `play()` returns a promise that REJECTS when autoplay is
   * blocked — iOS Low Power Mode is the common case — and an unhandled
   * rejection there would leave the poster up with no way to start it.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || manual) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          video.play().catch(() => setManual(true));
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(video);

    const onVisibility = () => {
      if (document.hidden) video.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [manual]);

  /**
   * The beats, on the film's clock.
   *
   * `timeupdate` fires roughly four times a second, which is far too coarse to
   * animate with — but it is not animating anything. It flips three elements
   * between two declared states and lets the CSS transition cover the gap, the
   * same trick the scroll version used. No rAF loop, nothing running when the
   * video is paused.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (!video.duration || Number.isNaN(video.duration)) return;
      if (narratedRef.current) return;

      const progress = video.currentTime / video.duration;

      /*
        `loop` restarts the film without firing `ended`, so the wrap is what
        marks the end of the first pass: progress jumping backwards by more
        than a fifth of the film cannot be ordinary playback at any rate a
        browser reports. A plain `progress < last` would also fire on the tiny
        backwards jitter `timeupdate` sometimes reports between frames.
      */
      if (progress < lastProgress.current - 0.2) {
        narratedRef.current = true;
        setNarrated(true);
        paint(1);
        return;
      }
      lastProgress.current = progress;
      paint(progress);
    };
    onTime();
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onTime);
    video.addEventListener("seeked", onTime);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onTime);
      video.removeEventListener("seeked", onTime);
    };
  }, [paint]);

  /**
   * With no clock driving them the beats would all sit at opacity 0 and the
   * section would have a headline nobody can see. Pin the last one — the beat
   * carrying the heading id and the CTA — both when the story has been told
   * and when it is never going to be: reduced motion, Data Saver, or an
   * autoplay the browser refused. In those three cases the section is simply a
   * still hero — poster, headline, button — which is a perfectly good thing
   * for it to be and needs no control offered over it.
   */
  useEffect(() => {
    if (manual || narrated) paint(1);
  }, [manual, narrated, paint]);

  return (
    <section
      id="reveal"
      className="relative overflow-hidden bg-ink"
      aria-labelledby="reveal-heading"
      data-testid="bottle-reveal"
      data-manual={manual ? "true" : undefined}
      data-narrated={narrated ? "true" : undefined}
    >
      {/*
        Full bleed. No `shell`, no gutter — the film runs edge to edge and the
        only thing inside the container is the type sitting on top of it.
      */}
      <div className="relative h-[62vh] w-full sm:h-[100dvh]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={POSTER}
          muted
          loop
          playsInline
          // `none`, not `metadata`: the poster is 32KB and already tells the
          // browser what shape to reserve, so there is nothing to gain from
          // touching the 1.3MB file before the section is anywhere near view.
          preload="none"
          // Decoration. The beats below carry the meaning, and a video element
          // announcing itself as a media player adds a control surface a
          // screen-reader user has no reason to want.
          aria-hidden="true"
          tabIndex={-1}
          data-testid="bottle-reveal-video"
        >
          <source src={FILM} type="video/mp4" />
        </video>

        {/*
          Bottom-weighted scrim. The beats sit in the lower third, and at the
          middle of the film the gold monogram fills the frame — display type
          straight over it was unreadable. A radial vignette was the wrong
          instrument: it darkens the edges and leaves the centre lit, which is
          exactly backwards for bottom-anchored type.
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

        {/*
          Extra weight under the type on phones only.
          The scrim above was tuned against a 100dvh stage. A 62vh stage crops
          the same 16:9 frame harder, which pushes the lit body of the bottle
          straight into the band the beats sit in — bone display type over
          backlit glass, at the size a phone renders it. This is the difference
          between reading the line and guessing at it.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 sm:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,11,13,0) 0%, rgba(11,11,13,0.62) 42%, rgba(11,11,13,0.92) 100%)",
          }}
        />

        {/* Text beats. Only one is on screen at a time. */}
        <div className="relative z-[2] flex h-full w-full flex-col items-center justify-end pb-[10vh] text-center sm:pb-[12vh]">
          {BEATS.map((beat, i) => {
            const isLast = i === BEATS.length - 1;
            return (
              <div
                key={beat.title}
                ref={(el) => {
                  beatRefs.current[i] = el;
                }}
                className="absolute inset-x-0 bottom-[10vh] px-gutter sm:bottom-[12vh]"
                style={{
                  opacity: 0,
                  transform: "translateY(18px)",
                  pointerEvents: isLast ? "auto" : "none",
                  transition:
                    "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1)",
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

        {/* Progress hairline — the same gauge device as the featured slider. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute bottom-6 left-1/2 h-px w-[7rem] -translate-x-1/2 bg-line-strong transition-opacity duration-500",
            // The gauge tracks the narrative, not the film. Once the story has
            // been told it is a line that would fill and reset forever under a
            // CTA that is not going anywhere.
            manual || narrated ? "opacity-0" : "opacity-100",
          )}
        >
          <div ref={barRef} className="h-px w-0 bg-gold" />
        </div>
      </div>
    </section>
  );
}
