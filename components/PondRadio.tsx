"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PondRadio.module.css";

type PondTrack = {
  title: string;
  src: string;
};

const TRACKS: PondTrack[] = [
  {
    title: "Toby With The Crown",
    src: "/audio/toby-with-the-crown.mp3",
  },
  {
    title: "Break On Through to Toby",
    src: "/audio/break-on-through-to-toby.mp3",
  },
  {
    title: "Toby",
    src: "/audio/toby.mp3",
  },
  {
    title: "The Forge",
    src: "/audio/the-forge.mp3",
  },
];

const CREATOR_URL = "https://toadvault.xyz/users/maxgains1000x";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function PondRadio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const track = TRACKS[trackIndex];

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  useEffect(() => {
    try {
      const savedMuted = window.localStorage.getItem("tobyworld:pond-radio-muted");
      setMuted(savedMuted === "1");
    } catch {
      // Local storage is optional; playback still works without it.
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = muted;

    try {
      window.localStorage.setItem(
        "tobyworld:pond-radio-muted",
        muted ? "1" : "0",
      );
    } catch {
      // Ignore private-mode/local-storage failures.
    }
  }, [muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(0);
    setDuration(0);

    if (!playing) {
      audio.load();
      return;
    }

    audio.load();
    void audio.play().catch(() => {
      setPlaying(false);
    });
  }, [trackIndex]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function previousTrack() {
    const audio = audioRef.current;

    // If the current song has been playing for a few seconds, "back" restarts it.
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    setTrackIndex((index) => (index - 1 + TRACKS.length) % TRACKS.length);
  }

  function nextTrack() {
    setTrackIndex((index) => (index + 1) % TRACKS.length);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const nextTime = (value / 100) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <section className={styles.radio} aria-label="Pond Radio">
      <audio
        ref={audioRef}
        src={track.src}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          );
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={nextTrack}
      />

      <div className={styles.ripples} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className={styles.header}>
        <div className={styles.badge} aria-hidden="true">
          <span>♪</span>
        </div>

        <div className={styles.heading}>
          <span className="land-section-kicker">POND RADIO</span>
          <h2>Sounds from the pond.</h2>
          <p>
            Four Tobyworld tracks by{" "}
            <a href={CREATOR_URL} target="_blank" rel="noreferrer">
              @maxgains1000x ↗
            </a>
          </p>
        </div>

        <button
          type="button"
          className={`${styles.sound} ${muted ? styles.soundOff : ""}`}
          onClick={() => setMuted((value) => !value)}
          aria-pressed={muted}
          aria-label={muted ? "Turn Pond Radio sound on" : "Mute Pond Radio"}
          title={muted ? "Sound on" : "Sound off"}
        >
          <span aria-hidden="true">{muted ? "×" : "•"}</span>
          {muted ? "SOUND OFF" : "SOUND ON"}
        </button>
      </header>

      <div className={styles.player}>
        <div className={styles.nowPlaying}>
          <span>NOW DRIFTING</span>
          <strong>{track.title}</strong>
          <small>
            {trackIndex + 1} / {TRACKS.length} · @maxgains1000x
          </small>
        </div>

        <div className={styles.controls} aria-label="Pond Radio playback controls">
          <button
            type="button"
            onClick={previousTrack}
            aria-label="Previous track"
            title="Previous track"
          >
            <span aria-hidden="true">‹‹</span>
          </button>

          <button
            type="button"
            className={styles.play}
            onClick={togglePlay}
            aria-label={playing ? "Pause Pond Radio" : "Play Pond Radio"}
            title={playing ? "Pause" : "Play"}
          >
            <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
          </button>

          <button
            type="button"
            onClick={nextTrack}
            aria-label="Next track"
            title="Next track"
          >
            <span aria-hidden="true">››</span>
          </button>
        </div>

        <div className={styles.timeline}>
          <span>{formatTime(currentTime)}</span>

          <label>
            <span className="sr-only">Track position</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={(event) => seek(Number(event.target.value))}
              style={{ "--pond-progress": `${progress}%` } as React.CSSProperties}
            />
          </label>

          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className={styles.trackDots} aria-label="Choose a Pond Radio track">
        {TRACKS.map((item, index) => (
          <button
            key={item.src}
            type="button"
            className={index === trackIndex ? styles.activeDot : ""}
            onClick={() => setTrackIndex(index)}
            aria-label={`Play ${item.title}`}
            aria-current={index === trackIndex ? "true" : undefined}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>

      <footer className={styles.footer}>
        <span>Music stays off until you press play.</span>
        <a href={CREATOR_URL} target="_blank" rel="noreferrer">
          Visit the creator on ToadVault ↗
        </a>
      </footer>
    </section>
  );
}
