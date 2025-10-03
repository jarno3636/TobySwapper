"use client";
import { useRouter } from "next/navigation";

export default function AboutTeaser() {
  const router = useRouter();
  return (
    <div className="glass rounded-3xl p-5 shadow-soft mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-inkSub">
          New here? Come see what this project is about and how the burn works.
        </p>
        <button
          type="button"
          onClick={() => router.push("/about")}
          className="pill pill-opaque hover:opacity-90 text-sm"
          aria-label="Go to About page"
        >
          Learn more on the About page →
        </button>
      </div>
    </div>
  );
}
