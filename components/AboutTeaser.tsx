"use client";
import Link from "next/link";

export default function AboutTeaser() {
  return (
    <div className="glass rounded-3xl p-5 shadow-soft mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-inkSub">
          New here? Come see what this project is about and how the burn works.
        </p>
        <Link
          href="/about"
          className="pill pill-opaque hover:opacity-90 text-sm"
          aria-label="Go to About page"
        >
          Learn more on the About page →
        </Link>
      </div>
    </div>
  );
}
