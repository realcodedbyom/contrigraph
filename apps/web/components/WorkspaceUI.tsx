"use client";
import { useEffect, useRef, ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { Project } from "@/lib/types";
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const old = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".cg-dialog button:not(:disabled),.cg-dialog input:not(:disabled),.cg-dialog select:not(:disabled),.cg-dialog textarea:not(:disabled),.cg-dialog a",
          ),
        );
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", f);
    document.querySelector<HTMLElement>(".cg-dialog button")?.focus();
    return () => {
      document.body.style.overflow = old;
      opener?.focus();
      document.removeEventListener("keydown", f);
    };
  }, []);
  return (
    <div
      className="cg-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="cg-dialog"
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={close}>
            <X size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="cg-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function LoadTable({ project: p }: { project: Project }) {
  return (
    <div className="cg-scroll">
      <table>
        <thead>
          <tr>
            <th>Teammate</th>
            <th>Due in 7 days</th>
            <th>Available</th>
            <th>Utilization</th>
            <th>Blocked effort</th>
          </tr>
        </thead>
        <tbody>
          {p.analysis.workload.map((m) => (
            <tr key={m.id}>
              <td>
                <b>{m.name}</b>
                <small>{m.skills.join(" · ")}</small>
              </td>
              <td>{m.dueEffort}h</td>
              <td>{m.available}h</td>
              <td>
                <div className="cg-load">
                  <progress
                    max={100}
                    value={Math.min(m.utilization ?? 100, 100)}
                  />
                  <span>
                    {m.utilization === null
                      ? "No capacity"
                      : m.utilization + "%"}
                  </span>
                </div>
              </td>
              <td>{m.blocked}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
