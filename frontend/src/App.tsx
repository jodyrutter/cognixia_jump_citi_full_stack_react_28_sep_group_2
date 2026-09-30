import { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { Page } from "./components/layout/Sidebar";
import { AccountsPage } from "./components/accounts/AccountsPage";
import { MyAccountsPage } from "./components/accounts/MyAccountsPage";
import { CustomersPage } from "./components/users/CustomersPage";
import { AdminsPage } from "./components/users/AdminsPage";
import { MyProfilePage } from "./components/users/MyProfilePage";
import { LoginScreen } from "./components/auth/LoginScreen";
import { authApi } from "./api/auth";
import { useAuth } from "./auth/useAuth";
import { useCurrentUser } from "./auth/useCurrentUser";

export default function App() {
  const { session, logout } = useAuth();
  const { me, loading, refresh } = useCurrentUser(session);
  const [page, setPage] = useState<Page | null>(null);

  useEffect(() => {
    if (me) setPage((current) => current ?? (me.role === "admin" ? "accounts" : "my-accounts"));
    if (!me) setPage(null);
  }, [me]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      /* best effort — clear the local session regardless */
    } finally {
      logout();
    }
  }

  if (!session) return <LoginScreen />;

  if (!me || page === null) {
    return (
      <div className="app">
        <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          {loading ? "Loading your account…" : "Couldn't load your account."}
        </div>
      </div>
    );
  }

  return (
    <AppShell page={page} onNavigate={setPage} me={me} onLogout={handleLogout}>
      {me.role === "admin" && page === "accounts" && <AccountsPage />}
      {me.role === "admin" && page === "customers" && <CustomersPage />}
      {me.role === "admin" && page === "admins" && <AdminsPage />}
      {me.role === "customer" && page === "my-accounts" && <MyAccountsPage me={me} />}
      {me.role === "customer" && page === "my-profile" && <MyProfilePage me={me} onProfileUpdated={() => refresh()} />}
    </AppShell>
  );
}
