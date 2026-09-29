import { useEffect, useState } from "react";
import { usersApi } from "../../api/users";
import { ApiError } from "../../api/client";
import type { Admin, CustomerCreate } from "../../types/customer";
import { UsersTable } from "./UsersTable";
import { UserDrawer } from "./UserDrawer";
import { Toast, type ToastMessage } from "../ui/Toast";

interface Props {
  onUsersChanged?: () => void;
}

export function AdminsPage({ onUsersChanged }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerError, setDrawerError] = useState<string | undefined>(undefined);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  async function refresh() {
    setLoading(true);
    setListError(null);
    try {
      setAdmins(await usersApi.listAdmins());
    } catch (err) {
      setListError(err instanceof ApiError ? err.detail ?? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate(data: CustomerCreate) {
    setDrawerSubmitting(true);
    setDrawerError(undefined);
    try {
      const created = await usersApi.createAdmin(data);
      setAdmins((prev) => [...prev, created]);
      setDrawerOpen(false);
      onUsersChanged?.();
      setToast({ id: Date.now(), message: `Admin ${created.name} created` });
    } catch (err) {
      setDrawerError(err instanceof ApiError ? err.detail ?? err.message : "Create failed");
    } finally {
      setDrawerSubmitting(false);
    }
  }

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">Users &amp; Roles</span></div>
      <div className="page-head">
        <div>
          <h1>Users &amp; Roles</h1>
          <div className="subtitle">Administrators with elevated permissions.</div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={refresh} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => { setDrawerError(undefined); setDrawerOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Admin
          </button>
        </div>
      </div>

      {listError && (
        <div className="err-banner">
          <svg className="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="msg"><b>Couldn't load admins.</b> {listError}</div>
          <button className="btn-link" onClick={refresh}>Retry</button>
        </div>
      )}

      <UsersTable users={admins} loading={loading} kind="admin" />
      {!loading && (
        <div className="paging">
          <div>Showing <b style={{ color: "var(--ink)" }}>{admins.length}</b> admin{admins.length === 1 ? "" : "s"}</div>
        </div>
      )}

      <div className={`overlay${drawerOpen ? " open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <UserDrawer
        open={drawerOpen}
        mode={{ kind: "create", role: "admin" }}
        submitting={drawerSubmitting}
        errorDetail={drawerError}
        onClose={() => setDrawerOpen(false)}
        onCreate={handleCreate}
        onUpdate={() => { /* admin edit not supported by backend */ }}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
