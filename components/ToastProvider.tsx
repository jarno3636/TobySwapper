"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

type Kind = "default" | "success" | "error"
type ToastIn = { title?: string; desc?: string; durationMs?: number }
type Toast = {
  id: number
  kind: Kind
  title?: string
  desc?: string
  durationMs: number
  createdAt: number
}

/** Context API (compatible with your current usage) */
type Ctx = {
  notify: (t: ToastIn) => void
  success: (t: ToastIn) => void
  error: (t: ToastIn) => void
  /** Optional escape hatch if you ever need to clear all */
  clearAll: () => void
}
const ToastCtx = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idCounter = useRef(0)
  const timeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const remaining = useRef<Map<number, number>>(new Map())
  const pauseStartedAt = useRef<Map<number, number>>(new Map())
  const prefersReducedMotion = usePrefersReducedMotion()

  /** Remove toast & cleanup */
  const dismiss = useCallback((id: number) => {
    const t = timeouts.current.get(id)
    if (t) clearTimeout(t)
    timeouts.current.delete(id)
    remaining.current.delete(id)
    pauseStartedAt.current.delete(id)
    setToasts((arr) => arr.filter((x) => x.id !== id))
  }, [])

  /** Arm (or re-arm) a timer for a toast */
  const armTimer = useCallback(
    (toast: Toast, ms: number) => {
      const handle = setTimeout(() => dismiss(toast.id), ms)
      timeouts.current.set(toast.id, handle)
      remaining.current.set(toast.id, ms)
    },
    [dismiss]
  )

  /** Add a toast */
  const push = useCallback(
    (kind: Kind, t: ToastIn) => {
      const id = ++idCounter.current
      const durationMs =
        typeof t.durationMs === "number" ? Math.max(1200, t.durationMs) : 4200
      const item: Toast = {
        id,
        kind,
        title: t.title,
        desc: t.desc,
        durationMs,
        createdAt: Date.now(),
      }
      setToasts((arr) => [...arr, item])
      // don’t animate forever if reduced motion: still auto-dismiss, just no progress bar animation
      armTimer(item, durationMs)
    },
    [armTimer]
  )

  /** Public API */
  const api = useMemo<Ctx>(
    () => ({
      notify: (t) => push("default", t),
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      clearAll: () => {
        Array.from(timeouts.current.values()).forEach(clearTimeout)
        timeouts.current.clear()
        remaining.current.clear()
        pauseStartedAt.current.clear()
        setToasts([])
      },
    }),
    [push]
  )

  /** Pause/resume when user hovers a toast (so they can read it) */
  const onMouseEnter = (id: number) => {
    const tm = timeouts.current.get(id)
    if (!tm) return
    clearTimeout(tm)
    timeouts.current.delete(id)
    // mark when pause started
    pauseStartedAt.current.set(id, Date.now())
  }
  const onMouseLeave = (toast: Toast) => {
    // compute remaining
    const start = pauseStartedAt.current.get(toast.id)
    const lastRemaining = remaining.current.get(toast.id) ?? toast.durationMs
    if (!start) {
      // nothing to do; re-arm with last remaining to be safe
      armTimer(toast, lastRemaining)
      return
    }
    const pausedFor = Date.now() - start
    const next = Math.max(300, lastRemaining - pausedFor)
    pauseStartedAt.current.delete(toast.id)
    armTimer(toast, next)
  }

  /** ESC clears the most recent toast */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length) {
        const latest = toasts[toasts.length - 1]
        dismiss(latest.id)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toasts, dismiss])

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      Array.from(timeouts.current.values()).forEach(clearTimeout)
    }
  }, [])

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* A11y live region */}
      <div
        className="toast-viewport"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            toast={t}
            onClose={() => dismiss(t.id)}
            onPause={() => onMouseEnter(t.id)}
            onResume={() => onMouseLeave(t)}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function ToastCard({
  toast,
  onClose,
  onPause,
  onResume,
  prefersReducedMotion,
}: {
  toast: Toast
  onClose: () => void
  onPause: () => void
  onResume: () => void
  prefersReducedMotion: boolean
}) {
  // progress bar width via inline style; we pause with CSS on hover too
  const progressStyle: React.CSSProperties = prefersReducedMotion
    ? { width: "100%" }
    : {
        animation: "toastProgress linear forwards",
        animationDuration: `${toast.durationMs}ms`,
      }

  return (
    <div
      className={`toast ${toast.kind}`}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      role="status"
    >
      {/* Content */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="toast-title">{toast.title}</div>
          )}
          {toast.desc && <div className="toast-desc">{toast.desc}</div>}
        </div>

        {/* Close button – keyboard & screen-reader friendly */}
        <button
          className="pill pill--muted"
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>

      {/* Progress */}
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded"
        aria-hidden="true"
      >
        <div
          className="h-full bg-black/40"
          style={progressStyle}
        />
      </div>
      <style jsx>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}

/** Hook: prefers-reduced-motion */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const set = () => setReduced(!!mql.matches)
    set()
    mql.addEventListener?.("change", set)
    return () => mql.removeEventListener?.("change", set)
  }, [])
  return reduced
}
