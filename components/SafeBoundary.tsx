// components/SafeBoundary.tsx
"use client";
import { Component, type ReactNode } from "react";

export class SafeBoundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state = { err: undefined as Error | undefined };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="glass rounded-3xl p-5 shadow-soft">
        <h3 className="font-semibold mb-2">Something went wrong</h3>
        <p className="text-sm text-[var(--ink-sub)]">{this.state.err.message}</p>
      </div>
    );
  }
}
