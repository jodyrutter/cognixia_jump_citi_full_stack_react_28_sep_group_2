import { useEffect, useRef, useState } from "react";
import type { Me } from "../../types/me";

interface Props {
  me: Me | null;
  onLogout: () => void;
  onBrandClick: () => void;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function TopBar({ me, onLogout, onBrandClick }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = me?.name ?? "…";
  const roleLabel = me?.role === "admin" ? "Admin" : me?.role === "customer" ? "Customer" : "";

  return (
    <header className="topbar">
      <button className="brand" onClick={onBrandClick} aria-label="Go to home page">
        <div className="dot" title="Citi" />
        <div className="wordmark">citi</div>
        <div className="divider" />
        <div className="app-name">Banking Console</div>
      </button>
      <div className="spacer" />
      <div className="actions">
        <button className="icon-btn" title="Help">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <button className="icon-btn" title="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="badge" />
        </button>
        <div className="user-menu-wrap" ref={wrapRef}>
          <button className="user-chip" onClick={() => setOpen((v) => !v)}>
            <div className="avatar">{me ? initialsFor(me.name) : "?"}</div>
            <div className="who">
              <div className="name">{label}</div>
              <div className="role">{roleLabel}</div>
            </div>
            <svg className="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div className={`user-menu${open ? " open" : ""}`} role="menu">
            <div className="menu-header">
              <div className="who">{me?.name ?? "Signed in"}</div>
              <div className="em">{me?.email}</div>
            </div>
            <button
              className="menu-item"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span style={{ flex: 1, fontWeight: 600 }}>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
