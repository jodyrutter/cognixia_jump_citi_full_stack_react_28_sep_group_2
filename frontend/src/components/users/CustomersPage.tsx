import { useEffect, useState } from "react";
import { usersApi } from "../../api/users";
import { ApiError } from "../../api/client";
import type { Customer, CustomerCreate, CustomerUpdate } from "../../types/customer";
import { UsersTable } from "./UsersTable";
import { UserDrawer, type UserDrawerMode } from "./UserDrawer";
import { DeleteCustomerModal } from "./DeleteCustomerModal";
import { Toast, type ToastMessage } from "../ui/Toast";

interface Props {
  onUsersChanged?: () => void;
}

export function CustomersPage({ onUsersChanged }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [drawer, setDrawer] = useState<UserDrawerMode | null>(null);
  const [drawerError, setDrawerError] = useState<string | undefined>(undefined);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  async function refresh() {
    setLoading(true);
    setListError(null);
    try {
      setCustomers(await usersApi.listCustomers());
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
      const created = await usersApi.createCustomer(data);
      setCustomers((prev) => [...prev, created]);
      setDrawer(null);
      onUsersChanged?.();
      showToast(`Customer ${created.name} created`);
    } catch (err) {
      setDrawerError(err instanceof ApiError ? err.detail ?? err.message : "Create failed");
    } finally {
      setDrawerSubmitting(false);
    }
  }

  async function handleUpdate(id: number, data: CustomerUpdate) {
    setDrawerSubmitting(true);
    setDrawerError(undefined);
    try {
      const updated = await usersApi.updateCustomer(id, data);
      setCustomers((prev) => prev.map((c) => (c.user_id === id ? updated : c)));
      setDrawer(null);
      onUsersChanged?.();
      showToast(`Customer ${updated.name} updated`);
    } catch (err) {
      setDrawerError(err instanceof ApiError ? err.detail ?? err.message : "Update failed");
    } finally {
      setDrawerSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const target = toDelete;
    try {
      await usersApi.deleteCustomer(target.user_id);
      setCustomers((prev) => prev.filter((c) => c.user_id !== target.user_id));
      onUsersChanged?.();
      showToast(`Customer ${target.name} deleted`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) showToast("Your session has expired. Please sign in again.");
        else if (err.status === 403) showToast("Admin access required.");
        else if (err.status === 409) showToast(`${target.name} still owns accounts. Delete or reassign them first.`);
        else showToast(err.detail ?? err.message);
      } else {
        showToast("Delete failed");
      }
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">Customers</span></div>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <div className="subtitle">Customers who can own bank accounts.</div>
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
          <button className="btn btn-primary" onClick={() => { setDrawerError(undefined); setDrawer({ kind: "create", role: "customer" }); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Customer
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
          <div className="msg"><b>Couldn't load customers.</b> {listError}</div>
          <button className="btn-link" onClick={refresh}>Retry</button>
        </div>
      )}

      <UsersTable
        users={customers}
        loading={loading}
        kind="customer"
        onEdit={(c) => { setDrawerError(undefined); setDrawer({ kind: "edit", customer: c }); }}
        onDelete={(c) => setToDelete(c)}
      />
      {!loading && (
        <div className="paging">
          <div>Showing <b style={{ color: "var(--ink)" }}>{customers.length}</b> customer{customers.length === 1 ? "" : "s"}</div>
        </div>
      )}

      <div
        className={`overlay${drawer !== null || toDelete !== null ? " open" : ""}`}
        onClick={() => { setDrawer(null); setToDelete(null); }}
      />
      <UserDrawer
        open={drawer !== null}
        mode={drawer ?? { kind: "create", role: "customer" }}
        submitting={drawerSubmitting}
        errorDetail={drawerError}
        onClose={() => setDrawer(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
      <DeleteCustomerModal
        open={toDelete !== null}
        customer={toDelete}
        submitting={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
