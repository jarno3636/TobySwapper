"use client"

import { createContext, useContext, useMemo, useState, ReactNode } from "react"

type Toast = { id: number; title?: string; desc?: string }
type Ctx = {
  notify: (t: { title?: string; desc?: string }) => void
  success: (t: { title?: string; desc?: string }) => void
  error: (t: { title?: string; desc?: string }) => void
}
const ToastCtx = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<Toast & { kind: "default" | "success" | "error" }>>([])

  const api = useMemo<Ctx>(() => {
    let counter = 0
    const push = (kind: "default" | "success" | "error", t: { title?: string; desc?: string }) => {
      const id = ++counter
      setToasts((arr) => [...arr, { id, kind, ...t }])
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 4200)
    }
    return {
      notify: (t) => push("default", t),
      success: (t) => push("success", t),
      error: (t) => push("error", t),
    }
  }, [])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-viewport">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.title && <div className="toast-title">{t.title}</div>}
            {t.desc && <div className="toast-desc">{t.desc}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}
