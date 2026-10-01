import type { ReactNode } from "react";

interface Props {
  role: "customer" | "admin";
  children: ReactNode;
}

export function AuthLayout({ role, children }: Props) {
  const isAdmin = role === "admin";
  return (
    <div className={`login-page login-page-${role}`}>
      <div className="auth-frame">
        <div className="auth-hero">
          <div className="login-brand">
            <div className="dot" title="Citi" />
            <div>
              <div className="wordmark">citi</div>
              <div className="app-name">Banking Console</div>
            </div>
          </div>
          <div className="auth-hero-content">
            <span className="auth-eyebrow">{isAdmin ? "ADMINISTRATOR ACCESS" : "PERSONAL BANKING"}</span>
            <h2>{isAdmin ? "Manage with confidence." : "Your money, at a glance."}</h2>
            <p>{isAdmin
              ? "This workspace is for authorized administrators managing customers, accounts and transaction records."
              : "A simple place to manage your accounts, move funds and keep track of every transaction."}</p>
            <div className="auth-hero-feature">
              <span className="auth-feature-icon">{isAdmin ? "A" : "$"}</span>
              <span>{isAdmin ? "Restricted staff workspace" : "Your personal account workspace"}</span>
            </div>
          </div>
          <span className="auth-hero-bottom">CITI BANKING CONSOLE</span>
        </div>
        <div className="login-card">{children}</div>
      </div>
    </div>
  );
}
