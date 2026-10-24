"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import PublicArrow from "@/components/PublicArrow";
import { productTour } from "@/lib/product-tour";
import "./ProductTour.css";

const media = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ""}/media`;

export default function ProductTour() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);

  async function play(at?: number) {
    const player = video.current;
    if (!player) return;
    if (at !== undefined) player.currentTime = at;
    try {
      await player.play();
      setStarted(true);
      setError(false);
    } catch {
      // Native controls remain available when the browser blocks scripted play.
      setStarted(true);
    }
  }

  return (
    <section
      id="watch"
      className="product-tour public-section"
      aria-labelledby="tour-title"
    >
      <header className="tour-heading">
        <div>
          <p className="public-kicker">SEE HOW IT WORKS</p>
          <h2 id="tour-title">
            A clearer workday.
            <br />
            From the first task to the finish.
          </h2>
        </div>
        <p>
          Take a two-minute tour. See how your team can plan the work, ask for
          help, balance workloads and review what gets delivered.
        </p>
      </header>
      <div className="tour-player">
        <video
          ref={video}
          controls
          playsInline
          preload="none"
          width="1920"
          height="1080"
          poster={`${media}/contrigraph-product-tour-en-v1.jpg`}
          aria-label="ContriGraph product tour in English"
          aria-describedby="tour-description"
          onPlay={() => setStarted(true)}
          onError={() => {
            setError(true);
            setStarted(true);
          }}
        >
          <source
            src={`${media}/contrigraph-product-tour-en-v1.mp4`}
            type="video/mp4"
          />
          <track
            kind="captions"
            src={`${media}/contrigraph-product-tour-en-v1.vtt`}
            srcLang="en"
            label="English"
            default
          />
          <p>
            Your browser cannot play this video.{" "}
            <a href={`${media}/contrigraph-product-tour-en-v1.mp4`}>
              Download the product tour
            </a>{" "}
            or read the transcript below.
          </p>
        </video>
        {!started && (
          <button
            className="tour-play"
            onClick={() => void play()}
            aria-label="Play the ContriGraph product tour, 2 minutes 12 seconds"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M7 4v16l14-8Z" fill="currentColor" />
            </svg>
            <span>
              Watch the product tour<small>2 min 12 sec · English</small>
            </span>
          </button>
        )}
      </div>
      <div className="tour-caption" id="tour-description">
        <p>
          English narration and optional captions. Illustrative team examples.
        </p>
        <a href={`${media}/contrigraph-product-tour-en-v1.mp4`} download>
          Download video <PublicArrow direction="right" />
        </a>
      </div>
      {error && (
        <p className="tour-error" role="status">
          The video could not load. You can download it above or read the full
          transcript below.
        </p>
      )}
      <nav className="tour-chapters" aria-label="Product tour chapters">
        {productTour.chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => void play(chapter.start)}
            aria-label={`Play ${chapter.title} at ${chapter.time}`}
          >
            <span>{chapter.time}</span>
            {chapter.title}
          </button>
        ))}
      </nav>
      <details className="tour-transcript">
        <summary>Read the full video transcript</summary>
        <div>
          {productTour.chapters.map((chapter) => (
            <article key={chapter.id}>
              <h3>{chapter.title}</h3>
              <p>{chapter.transcript}</p>
            </article>
          ))}
        </div>
      </details>
      <div className="tour-next">
        <p>Ready to try it with your team?</p>
        <Link className="public-button" href="/app?signup=1">
          Start your workspace <PublicArrow />
        </Link>
        <Link href="/help#getting-started">
          Read the getting-started guide <PublicArrow direction="right" />
        </Link>
      </div>
      <details className="tour-credits">
        <summary>Video credits</summary>
        <p>
          Music: “Happy Beats / Business Moves Vol. 1” by{" "}
          <a href="https://ende.app/en" target="_blank" rel="noreferrer">
            Sascha Ende
          </a>
          , licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
          . Excerpted, mixed and faded. Sound effects: Kenney, CC0. English
          narration synthesized with Kokoro.
        </p>
      </details>
    </section>
  );
}
