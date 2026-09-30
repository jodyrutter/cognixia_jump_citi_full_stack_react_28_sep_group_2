import { useEffect, useMemo, useState } from "react";
import { accountsApi } from "../../api/accounts";
import { usersApi } from "../../api/users";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import type { Account, AccountCreate, AccountUpdate, AccountType } from "../../types/account";
import type { Customer } from "../../types/customer";
import { SummaryCards } from "./SummaryCards";
import { AccountsTable } from "./AccountsTable";
import { AccountDrawer } from "./AccountDrawer";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { MoneyModal, type MoneyMode } from "./MoneyModal";
import { Toast, type ToastMessage } from "../ui/Toast";

type DrawerMode = { kind: "create" } | { kind: "edit"; account: Account } | null;
type MoneyState = { mode: MoneyMode; account: Account } | null;

export function AccountsPage() {
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AccountType>("all");

  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [drawerError, setDrawerError] = useState<string | undefined>(undefined);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [money, setMoney] = useState<MoneyState>(null);
  const [moneyError, setMoneyError] = useState<string | undefined>(undefined);
  const [moneySubmitting, setMoneySubmitting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  const customersById = useMemo(() => {
    const map = new Map<number, Customer>();
    for (const c of customers) map.set(c.user_id, c);
    return map;
  }, [customers]);

  async function refresh() {
    setLoading(true);
    setListError(null);
    try {
      const [acctList, custList] = await Promise.all([accountsApi.list(), usersApi.listCustomers()]);
      setAccounts(acctList);
      setCustomers(custList);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail ?? err.message : "Unexpected error";
      setListError(detail);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCustomers() {
    try {
      setCustomers(await usersApi.listCustomers());
    } catch {
      /* ignore — table still usable with cached list */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (typeFilter !== "all" && a.account_type !== typeFilter) return false;
      if (!q) return true;
      const owner = customersById.get(a.owner_id);
      return (
        a.account_number.toLowerCase().includes(q) ||
        String(a.owner_id).includes(q) ||
        String(a.id).includes(q) ||
        (owner?.name.toLowerCase().includes(q) ?? false) ||
        (owner?.email.toLowerCase().includes(q) ?? false)
      );
    });
  }, [accounts, search, typeFilter, customersById]);

  async function handleCreate(data: AccountCreate) {
    setDrawerSubmitting(true);
    setDrawerError(undefined);
    try {
      const created = await accountsApi.create(data);
      setAccounts((prev) => [...prev, created]);
      setDrawer(null);
      showToast(`Account ${created.account_number} created`);
    } catch (err) {
      setDrawerError(err instanceof ApiError ? err.detail ?? err.message : "Create failed");
    } finally {
      setDrawerSubmitting(false);
    }
  }

  async function handleUpdate(id: number, data: AccountUpdate) {
    setDrawerSubmitting(true);
    setDrawerError(undefined);
    try {
      const updated = await accountsApi.update(id, data);
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setDrawer(null);
      showToast(`Account ${updated.account_number} updated`);
    } catch (err) {
      setDrawerError(err instanceof ApiError ? err.detail ?? err.message : "Update failed");
    } finally {
      setDrawerSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const acct = toDelete;
    try {
      await accountsApi.remove(acct.id);
      setAccounts((prev) => prev.filter((a) => a.id !== acct.id));
      showToast(`Account ${acct.account_number} deleted`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.detail ?? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  async function handleMoney(amount: string) {
    if (!money) return;
    setMoneySubmitting(true);
    setMoneyError(undefined);
    const { mode, account } = money;
    try {
      const updated =
        mode === "deposit"
          ? await accountsApi.deposit(account.id, { amount })
          : await accountsApi.withdraw(account.id, { amount });
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? updated : a)));
      const verb = mode === "deposit" ? "Deposited" : "Withdrew";
      const money$ = `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      showToast(`${verb} ${money$} · ${account.account_number}`);
      setMoney(null);
    } catch (err) {
      setMoneyError(err instanceof ApiError ? err.detail ?? err.message : "Transaction failed");
    } finally {
      setMoneySubmitting(false);
    }
  }

  const overlayOpen = drawer !== null || toDelete !== null || money !== null;

  return (
    <>
      <div className="crumbs">
        Home <span className="sep">/</span> <span className="now">Accounts</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Accounts</h1>
          <div className="subtitle">Manage customer bank accounts across the institution.</div>
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
          <button
            className="btn btn-primary"
            onClick={() => { setDrawerError(undefined); refreshCustomers(); setDrawer({ kind: "create" }); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Account
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
          <div className="msg"><b>Couldn't load accounts.</b> {listError}</div>
          <button className="btn-link" onClick={refresh}>Retry</button>
        </div>
      )}

      <SummaryCards accounts={accounts} />

      <div className="filter-bar">
        <div className="search">
          <svg className="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search account number, owner name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="chip-select">
          Type:
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | AccountType)}>
            <option value="all">All</option>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
          </select>
        </label>
        <div className="spacer" />
      </div>

      {!loading && !listError && filtered.length === 0 ? (
        accounts.length === 0 ? (
          <div className="empty">
            <div className="art">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3>No accounts yet</h3>
            <p>Get started by creating the first customer account.</p>
            <button
              className="btn btn-primary"
              onClick={() => { setDrawerError(undefined); refreshCustomers(); setDrawer({ kind: "create" }); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Account
            </button>
          </div>
        ) : (
          <div className="empty">
            <h3>No matching accounts</h3>
            <p>Try clearing the search or type filter.</p>
          </div>
        )
      ) : (
        <>
          <AccountsTable
            accounts={filtered}
            customersById={customersById}
            loading={loading}
            onEdit={(a) => setDrawer({ kind: "edit", account: a })}
            onDelete={(a) => setToDelete(a)}
            onDeposit={(a) => { setMoneyError(undefined); setMoney({ mode: "deposit", account: a }); }}
            onWithdraw={(a) => { setMoneyError(undefined); setMoney({ mode: "withdraw", account: a }); }}
          />
          {!loading && (
            <div className="paging">
              <div>
                Showing <b style={{ color: "var(--ink)" }}>{filtered.length}</b> of{" "}
                <b style={{ color: "var(--ink)" }}>{accounts.length}</b> accounts
              </div>
            </div>
          )}
        </>
      )}

      <div
        className={`overlay${overlayOpen ? " open" : ""}`}
        onClick={() => {
          setDrawer(null);
          setToDelete(null);
          setMoney(null);
        }}
      />
      <AccountDrawer
        open={drawer !== null}
        mode={drawer ?? { kind: "create" }}
        customers={customers}
        currentUserEmail={session?.email ?? ""}
        submitting={drawerSubmitting}
        errorDetail={drawerError}
        onClose={() => setDrawer(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
      <DeleteAccountModal
        open={toDelete !== null}
        account={toDelete}
        owner={toDelete ? customersById.get(toDelete.owner_id) : undefined}
        submitting={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
      <MoneyModal
        open={money !== null}
        mode={money?.mode ?? "deposit"}
        account={money?.account ?? null}
        owner={money ? customersById.get(money.account.owner_id) : undefined}
        submitting={moneySubmitting}
        errorDetail={moneyError}
        onCancel={() => setMoney(null)}
        onConfirm={handleMoney}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
