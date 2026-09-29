import { useEffect, useRef, useState } from "react";
import { useActingAs } from "../../auth/useActingAs";
import type { Admin, Customer } from "../../types/customer";

interface Props {
  admins: Admin[];
  customers: Customer[];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function TopBar({ admins, customers }: Props) {
  const { actingAs, setActingAs } = useActingAs();
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

  const label = actingAs?.name ?? "No user";
  const roleLabel = actingAs?.role === "admin" ? "Admin" : actingAs?.role === "customer" ? "Customer" : "None";

  return (
    <header className="topbar">
      <div className="brand">
        <div className="dot" title="Citi" />
        <div className="wordmark">citi</div>
        <div className="divider" />
        <div className="app-name">Banking Console</div>
      </div>
      <div className="topbar-search">
        <svg className="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input type="text" placeholder="Search accounts, customers, transactions…" />
      </div>
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
            <div className="avatar">{actingAs ? initialsFor(actingAs.name) : "?"}</div>
            <div className="who">
              <div className="name">{label}</div>
              <div className="role">Acting as · {roleLabel}</div>
            </div>
            <svg className="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div className={`user-menu${open ? " open" : ""}`} role="menu">
            <div className="menu-header">
              <div className="who">Impersonate user</div>
              <div className="em">Sent as X-User-Id on requests</div>
            </div>
            {admins.length === 0 && customers.length === 0 && (
              <div className="menu-item" style={{ color: "var(--muted)" }}>Loading users…</div>
            )}
            {admins.length > 0 && (
              <>
                <div className="menu-section">Admins</div>
                {admins.map((a) => (
                  <button
                    key={`admin-${a.user_id}`}
                    className={`menu-item${actingAs?.user_id === a.user_id ? " selected" : ""}`}
                    onClick={() => {
                      setActingAs({ user_id: a.user_id, name: a.name, role: "admin" });
                      setOpen(false);
                    }}
                  >
                    <span className="menu-avatar" style={{ background: "#003b70" }}>{initialsFor(a.name)}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{a.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{a.email}</span>
                    </span>
                    {actingAs?.user_id === a.user_id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}
            {customers.length > 0 && (
              <>
                <div className="menu-section">Customers</div>
                {customers.map((c) => (
                  <button
                    key={`customer-${c.user_id}`}
                    className={`menu-item${actingAs?.user_id === c.user_id ? " selected" : ""}`}
                    onClick={() => {
                      setActingAs({ user_id: c.user_id, name: c.name, role: "customer" });
                      setOpen(false);
                    }}
                  >
                    <span className="menu-avatar" style={{ background: "#e02020" }}>{initialsFor(c.name)}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{c.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{c.email}</span>
                    </span>
                    {actingAs?.user_id === c.user_id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
