import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { Page } from "./components/layout/Sidebar";
import { AccountsPage } from "./components/accounts/AccountsPage";
import { MyAccountsPage } from "./components/accounts/MyAccountsPage";
import { MyTransactionsPage } from "./components/accounts/MyTransactionsPage";
import { MyTransfersPage } from "./components/accounts/MyTransfersPage";
import { AllTransactionsPage } from "./components/accounts/AllTransactionsPage";
import { CustomersPage } from "./components/users/CustomersPage";
import { AdminsPage } from "./components/users/AdminsPage";
import { MyProfilePage } from "./components/users/MyProfilePage";
import { CustomerLoginScreen } from "./components/auth/CustomerLoginScreen";
import { AdminLoginScreen } from "./components/auth/AdminLoginScreen";
import { authApi } from "./api/auth";
import { useAuth } from "./auth/useAuth";
import { useCurrentUser } from "./auth/useCurrentUser";
import { usePathname } from "./auth/usePathname";
import { SignupScreen } from "./components/auth/SignupScreen";
import { useSessionExpiration } from "./auth/useSessionExpiration";
import { homePage, pageForPath, pathForPage } from "./routes";

export default function App() {
  const { session, logout } = useAuth();
  useSessionExpiration(session);
  const { me, loading, error: profileError, refresh } = useCurrentUser(session);
  const { path, navigate, replace } = usePathname();
  const page: Page | null = me ? pageForPath(path, me.role) : null;

  // Login URLs, unknown paths, and pages for the other role all fall back to the role's home page.
  useEffect(() => {
    if (me && page === null) replace(pathForPage(homePage(me.role)));
  }, [me, page, replace]);

  async function handleLogout() {
    await authApi.logout();
    sessionStorage.setItem("auth-notice", "You have successfully logged out.");
    navigate(me?.role === "admin" ? "/admin/login" : "/");
    logout();
  }

  if (!session) {
    if (path === "/signup") {
      return <SignupScreen onSignIn={() => navigate("/")} />;
    }


    return path.startsWith("/admin") ? (
      <AdminLoginScreen onSwitchToCustomer={() => navigate("/")} />
    ) : (
      <CustomerLoginScreen onSwitchToAdmin={() => navigate("/admin/login")} onSignup={() => navigate("/signup")} />
    );
  }

  if (!me || page === null) {
    return (
      <div className="login-page">
        <div className="login-card">
          {loading || !profileError ? (<p role="status">Loading your account…</p>) : (
            <>
              <h1 className="login-title">
                Couldn't load your account
              </h1>

              <p className="login-sub" role="alert">
                {profileError}
              </p>

              <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
                <button type="button" className="btn btn-primary" onClick={() => void refresh()}>
                  Retry
                </button>

                <button type="button" className="btn btn-ghost" onClick={() => {
                  if (window.confirm("Log out of your account?")) {
                    logout();
                    navigate("/");
                  }
                }}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppShell page={page} onNavigate={(p) => navigate(pathForPage(p))} me={me} onLogout={handleLogout}>
      {me.role === "admin" && page === "accounts" && <AccountsPage />}
      {me.role === "admin" && page === "customers" && <CustomersPage />}
      {me.role === "admin" && page === "admins" && <AdminsPage />}
      {me.role === "admin" && page === "transactions" && <AllTransactionsPage />}
      {me.role === "customer" && page === "my-accounts" && <MyAccountsPage me={me} />}
      {me.role === "customer" && page === "my-transactions" && <MyTransactionsPage />}
      {me.role === "customer" && page === "my-transfers" && <MyTransfersPage me={me} />}
      {me.role === "customer" && page === "my-profile" && <MyProfilePage me={me} onProfileUpdated={() => refresh()} />}
    </AppShell>
  );
}
