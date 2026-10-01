import type { Role } from "../../types/me";

export type Page = "accounts" | "customers" | "admins" | "transactions" | "my-accounts" | "my-transactions" | "my-transfers" | "my-profile";

interface Props {
  role: Role;
  current: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ role, current, onNavigate }: Props) {
  const transactionsPage: Page = role === "admin" ? "transactions" : "my-transactions";
  return (
    <aside className="sidebar">
      <div className="side-group">
        <h4>Navigation</h4>
        {role === "admin" && (
          <button className={`side-item${current === "customers" ? " active" : ""}`} onClick={() => onNavigate("customers")}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="lbl">Customers</span>
          </button>
        )}
        {role === "admin" ? (
          <button className={`side-item${current === "accounts" ? " active" : ""}`} onClick={() => onNavigate("accounts")}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="lbl">Accounts</span>
          </button>
        ) : (
          <button className={`side-item${current === "my-accounts" ? " active" : ""}`} onClick={() => onNavigate("my-accounts")}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="lbl">My Accounts</span>
          </button>
        )}
        <button className={`side-item${current === transactionsPage ? " active" : ""}`} onClick={() => onNavigate(transactionsPage)}>
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
            <line x1="10" y1="3" x2="8" y2="21" />
            <line x1="16" y1="3" x2="14" y2="21" />
          </svg>
          <span className="lbl">Transactions</span>
        </button>
        {role === "customer" ? (
          <button className={`side-item${current === "my-transfers" ? " active" : ""}`} onClick={() => onNavigate("my-transfers")}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="lbl">Transfers</span>
          </button>
        ) : (
          <button className="side-item disabled" title="Administrators cannot transact on accounts">
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="lbl">Transfers</span>
          </button>
        )}
        {role === "customer" && (
          <button className={`side-item${current === "my-profile" ? " active" : ""}`} onClick={() => onNavigate("my-profile")}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="lbl">My Profile</span>
          </button>
        )}
        <button className="side-item disabled" title="Statements module planned">
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="lbl">Statements</span>
          <span className="pill">Soon</span>
        </button>
      </div>
      {role === "admin" && (
        <div className="side-group">
          <h4>Administration</h4>
          <button className={`side-item${current === "admins" ? " active" : ""}`} onClick={() => onNavigate("admins")}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="lbl">Users &amp; Roles</span>
          </button>
          <button className="side-item disabled" title="Audit log planned">
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
            </svg>
            <span className="lbl">Audit Log</span>
          </button>
          <button className="side-item disabled" title="System settings planned">
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.24.578.842 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="lbl">System Settings</span>
          </button>
        </div>
      )}
      <div className="side-footer-card">

        <div className="sub">All services operational.</div>
      </div>
    </aside>
  );
}
