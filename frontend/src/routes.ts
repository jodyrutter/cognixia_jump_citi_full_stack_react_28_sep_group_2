import type { Page } from "./components/layout/Sidebar";
import type { Role } from "./types/me";

const PAGE_PATHS: Record<Page, string> = {
  customers: "/admin/customers",
  accounts: "/admin/accounts",
  transactions: "/admin/transactions",
  admins: "/admin/users",
  "my-accounts": "/accounts",
  "my-transactions": "/transactions",
  "my-transfers": "/transfers",
  "my-profile": "/profile",
};

const ADMIN_PAGES = new Set<Page>(["customers", "accounts", "transactions", "admins"]);

export function pathForPage(page: Page): string {
  return PAGE_PATHS[page];
}

export function homePage(role: Role): Page {
  return role === "admin" ? "customers" : "my-accounts";
}

export function pageForPath(path: string, role: Role): Page | null {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  for (const [page, pagePath] of Object.entries(PAGE_PATHS) as [Page, string][]) {
    if (pagePath === normalized && ADMIN_PAGES.has(page) === (role === "admin")) return page;
  }
  return null;
}
