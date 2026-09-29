import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar, type Page } from "./Sidebar";
import type { Admin, Customer } from "../../types/customer";

interface Props {
  children: ReactNode;
  page: Page;
  onNavigate: (page: Page) => void;
  admins: Admin[];
  customers: Customer[];
}

export function AppShell({ children, page, onNavigate, admins, customers }: Props) {
  return (
    <div className="app">
      <TopBar admins={admins} customers={customers} />
      <div className="body-split">
        <Sidebar current={page} onNavigate={onNavigate} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
