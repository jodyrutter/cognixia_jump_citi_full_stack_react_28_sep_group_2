import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { Page } from "./components/layout/Sidebar";
import { AccountsPage } from "./components/accounts/AccountsPage";
import { CustomersPage } from "./components/users/CustomersPage";
import { AdminsPage } from "./components/users/AdminsPage";
import { LoginScreen } from "./components/auth/LoginScreen";
import { usersApi } from "./api/users";
import { actingAsStore } from "./auth/actingAsStore";
import { useAuth } from "./auth/useAuth";
import type { Admin, Customer } from "./types/customer";

export default function App() {
  const { session } = useAuth();
  const [page, setPage] = useState<Page>("accounts");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const refreshUsers = useCallback(async () => {
    try {
      const [nextAdmins, nextCustomers] = await Promise.all([
        usersApi.listAdmins(),
        usersApi.listCustomers(),
      ]);
      setAdmins(nextAdmins);
      setCustomers(nextCustomers);
      if (!actingAsStore.get() && nextAdmins.length > 0) {
        const first = nextAdmins[0];
        actingAsStore.set({ user_id: first.user_id, name: first.name, role: "admin" });
      }
    } catch {
      /* TopBar handles the empty case with a "Loading users…" placeholder */
    }
  }, []);

  useEffect(() => {
    if (session) refreshUsers();
  }, [refreshUsers, session]);

  if (!session) return <LoginScreen />;

  return (
    <AppShell page={page} onNavigate={setPage} admins={admins} customers={customers}>
      {page === "accounts" && <AccountsPage />}
      {page === "customers" && <CustomersPage onUsersChanged={refreshUsers} />}
      {page === "admins" && <AdminsPage onUsersChanged={refreshUsers} />}
    </AppShell>
  );
}
