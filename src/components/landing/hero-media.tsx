"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { BrandMark } from "@/components/brand/brand-mark";

/**
 * The hero backdrop, and its fallback chain.
 *
 * There is never a black void and never a grey box — the same philosophy the
 * product placeholder follows. In order:
 *
 *  1. video URL + motion allowed + decent connection → looping muted video,
 *     with the poster carrying the first frame until `canplay`.
 *  2. video fails to load (dead URL, blocked host) → falls to 3, not a black
 *     rectangle.
 *  3. poster only, or reduced motion, or a data-saver/2g connection → the
 *     still image, with no <video> element mounted at all.
 *  4. neither configured — TODAY'S STATE → a designed void: warm grain, a
 *     vignette, a single gold light source and the monogram at low opacity.
 *     This must look deliberate, because it is what ships until footage exists.
 *
 * Reduced motion is checked in JS, not CSS: globals.css can clamp animation
 * but cannot stop a video from playing.
 */
export function HeroMedia({
  videoUrl,
  posterUrl,
}: {
  videoUrl: string | null;
  posterUrl: string | null;
}) {
  const reduce = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Don't burn a metered connection on decorative footage.
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData || /^(slow-)?2g$/.test(conn?.effectiveType ?? "")) {
      setSaveData(true);
    }
  }, []);

  // Pause when the tab is hidden — a background tab decoding video is pure waste.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onVisibility = () => {
      if (document.hidden) el.pause();
      else void el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [videoUrl, videoFailed]);

  const useVideo = Boolean(videoUrl) && !videoFailed && !reduce && !saveData;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {useVideo ? (
        <video
          ref={videoRef}
          src={videoUrl!}
          poster={posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : posterUrl ? (
        <Image src={posterUrl} alt="" fill priority className="object-cover" />
      ) : (
        /* The designed void. */
        <div className="absolute inset-0 grain">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60rem 46rem at 72% 38%, rgba(201,162,75,0.12), transparent 62%)",
            }}
          />
          {/*
            Desktop only, deliberately.

            This is a composition for a hero with the type held left and the
            mark ghosted into the space on the right. On a phone that space
            does not exist: the hero stacks into copy, CTA, then the product
            photograph, so `items-center` drops the mark into the gap between
            the button and the picture, and `justify-end` pushes it past the
            right edge where `overflow-hidden` cuts it in half. What is left is
            a faint arc floating in dead space above the photograph — read as a
            rendering artefact, which is fair, because it is one.

            At 46vh it is also ~390px tall on a phone, so it is not subtle
            enough to ignore either.
          */}
          <div className="absolute inset-0 hidden items-center justify-end pr-[8vw] lg:flex">
            <BrandMark className="h-[46vh] w-auto opacity-[0.11]" />
          </div>
        </div>
      )}

      {/* Always: vignette + a bottom-weighted scrim, so headline contrast
          survives whatever frame the video happens to be on. */}
      <div className="absolute inset-0 vignette" />
      {/*
        The scrim runs whichever way the type does.

        Horizontally (90deg) it protects a left-held headline against media on
        the right — the desktop arrangement. On a phone the copy is full width
        and the photograph is BELOW it, so a left-to-right ramp darkens the
        wrong edge and does nothing for the text it is supposed to be backing.
        Vertical is the mobile equivalent: heaviest at the top, under the
        headline, easing off toward the photograph.
      */}
      <div
        className="absolute inset-0 lg:hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,11,13,0.92) 0%, rgba(11,11,13,0.7) 42%, rgba(11,11,13,0.4) 72%, rgba(11,11,13,0.6) 100%)",
        }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(11,11,13,0.92) 0%, rgba(11,11,13,0.72) 38%, rgba(11,11,13,0.35) 70%, rgba(11,11,13,0.55) 100%)",
        }}
      />
    </div>
  );
}
