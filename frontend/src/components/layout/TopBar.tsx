import { useEffect, useRef, useState } from "react";
import type { Me } from "../../types/me";
import { ApiError } from "../../api/client";
import { BrandMark } from "../ui/BrandMark";

interface Props {
  me: Me | null;
  onLogout: () => Promise<void>;
  onBrandClick: () => void;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function TopBar({ me, onLogout, onBrandClick }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
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
        <BrandMark />
        <div className="wordmark">Polis</div>
        <div className="divider" />
        <div className="app-name">Banking Console</div>
      </button>
      <div className="spacer" />
      <div className="actions">
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
                setLogoutError(null);
                setConfirmLogout(true);
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
      {confirmLogout && (
        <div className="logout-backdrop">
          <div className="logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description">
            <h2 id="logout-title">Log out of your account?</h2>
            <p id="logout-description">You'll need to sign in again to access your {roleLabel.toLowerCase()} account.</p>
            {logoutError && <div className="err-banner" role="alert"><div className="msg">{logoutError}</div></div>}
            <div className="logout-actions">
              <button className="btn btn-ghost" disabled={loggingOut} onClick={() => setConfirmLogout(false)}>Stay signed in</button>
              <button className="btn btn-danger" disabled={loggingOut} onClick={async () => {
                setLoggingOut(true);
                setLogoutError(null);
                try {
                  await onLogout();
                } catch (err) {
                  setLogoutError(err instanceof ApiError ? err.detail ?? err.message : "Could not log out. Please try again.");
                  setLoggingOut(false);
                }
              }}>{loggingOut ? "Logging out…" : "Log out"}</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
