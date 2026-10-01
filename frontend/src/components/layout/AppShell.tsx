import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar, type Page } from "./Sidebar";
import type { Me } from "../../types/me";

interface Props {
  children: ReactNode;
  page: Page;
  onNavigate: (page: Page) => void;
  me: Me;
  onLogout: () => void;
}

export function AppShell({ children, page, onNavigate, me, onLogout }: Props) {
  const homePage: Page = me.role === "admin" ? "customers" : "my-accounts";
  return (
    <div className="app">
      <TopBar me={me} onLogout={onLogout} onBrandClick={() => onNavigate(homePage)} />
      <div className="body-split">
        <Sidebar role={me.role} current={page} onNavigate={onNavigate} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
