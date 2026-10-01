import { useEffect, useMemo, useState } from "react";
import { accountsApi } from "../../api/accounts";
import { meApi } from "../../api/me";
import { transfersApi } from "../../api/transfers";
import { ApiError } from "../../api/client";
import type { Account, AccountCreate } from "../../types/account";
import type { Customer } from "../../types/customer";
import type { Me } from "../../types/me";
import { SummaryCards } from "./SummaryCards";
import { AccountsTable } from "./AccountsTable";
import { AccountDrawer } from "./AccountDrawer";
import { MoneyModal, type MoneyMode } from "./MoneyModal";
import { TransferModal } from "./TransferModal";
import { Toast, type ToastMessage } from "../ui/Toast";

// Only account creation is available to customers here; editing an existing
// account's type and viewing a single account by id are admin-only endpoints.
type DrawerMode = { kind: "create" } | null;
type MoneyState = { mode: MoneyMode; account: Account } | null;
type TransferState = { fromAccountId: number } | null;

interface Props {
  me: Me;
}

export function MyAccountsPage({ me }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [drawerError, setDrawerError] = useState<string | undefined>(undefined);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  const [money, setMoney] = useState<MoneyState>(null);
  const [moneyError, setMoneyError] = useState<string | undefined>(undefined);
  const [moneySubmitting, setMoneySubmitting] = useState(false);

  const [transfer, setTransfer] = useState<TransferState>(null);
  const [transferError, setTransferError] = useState<string | undefined>(undefined);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  // AccountDrawer expects a Customer lookup map; the only owner in this view is the signed-in customer.
  const customersById = useMemo(() => {
    const self: Customer = { user_id: me.user_id, name: me.name, email: me.email, address: me.address };
    return new Map<number, Customer>([[me.user_id, self]]);
  }, [me]);

  async function refresh() {
    setLoading(true);
    setListError(null);
    try {
      setAccounts(await meApi.listAccounts());
    } catch (err) {
      setListError(err instanceof ApiError ? err.detail ?? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.user_id]);

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

  async function handleTransfer(data: { fromAccountId: number; toAccountNumber: string; amount: string }) {
    setTransferSubmitting(true);
    setTransferError(undefined);
    try {
      const result = await transfersApi.create({
        from_account_id: data.fromAccountId,
        to_account_number: data.toAccountNumber,
        amount: data.amount,
      });
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === result.from_account.id) return result.from_account;
          if (result.to_account && a.id === result.to_account.id) return result.to_account;
          return a;
        }),
      );
      const money$ = `$${Number(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      showToast(`Sent ${money$} to ${result.to_owner_name} · ${result.to_account_number}`);
      setTransfer(null);
    } catch (err) {
      setTransferError(err instanceof ApiError ? err.detail ?? err.message : "Transfer failed");
    } finally {
      setTransferSubmitting(false);
    }
  }

  const overlayOpen = drawer !== null || money !== null || transfer !== null;

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">My Accounts</span></div>

      <div className="page-head">
        <div>
          <h1>My Accounts</h1>
          <div className="subtitle">Accounts you own. Deposit, withdraw, or open a new account any time.</div>
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
          {accounts.length > 0 && (
            <button className="btn btn-ghost" onClick={() => { setTransferError(undefined); setTransfer({ fromAccountId: accounts[0].id }); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              Transfer
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setDrawerError(undefined); setDrawer({ kind: "create" }); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Open New Account
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
          <div className="msg"><b>Couldn't load your accounts.</b> {listError}</div>
          <button className="btn-link" onClick={refresh}>Retry</button>
        </div>
      )}

      <SummaryCards accounts={accounts} />

      {!loading && !listError && accounts.length === 0 ? (
        <div className="empty">
          <div className="art">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3>No accounts yet</h3>
          <p>Open your first checking or savings account to get started.</p>
          <button className="btn btn-primary" onClick={() => { setDrawerError(undefined); setDrawer({ kind: "create" }); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Open New Account
          </button>
        </div>
      ) : (
        <AccountsTable
          accounts={accounts}
          customersById={customersById}
          loading={loading}
          showOwner={false}
          onDeposit={(a) => { setMoneyError(undefined); setMoney({ mode: "deposit", account: a }); }}
          onWithdraw={(a) => { setMoneyError(undefined); setMoney({ mode: "withdraw", account: a }); }}
          onTransfer={(a) => { setTransferError(undefined); setTransfer({ fromAccountId: a.id }); }}
        />
      )}

      <div className={`overlay${overlayOpen ? " open" : ""}`} onClick={() => { setDrawer(null); setMoney(null); setTransfer(null); }} />
      <AccountDrawer
        open={drawer !== null}
        mode={drawer ?? { kind: "create" }}
        customers={[customersById.get(me.user_id)!]}
        currentUserEmail={me.email}
        submitting={drawerSubmitting}
        errorDetail={drawerError}
        onClose={() => setDrawer(null)}
        onCreate={handleCreate}
        onUpdate={() => { /* customers cannot edit accounts; this drawer never enters edit mode */ }}
      />
      <MoneyModal
        open={money !== null}
        mode={money?.mode ?? "deposit"}
        account={money?.account ?? null}
        owner={customersById.get(me.user_id)}
        submitting={moneySubmitting}
        errorDetail={moneyError}
        onCancel={() => setMoney(null)}
        onConfirm={handleMoney}
      />
      <TransferModal
        open={transfer !== null}
        accounts={accounts}
        initialFromAccountId={transfer?.fromAccountId}
        submitting={transferSubmitting}
        errorDetail={transferError}
        onCancel={() => setTransfer(null)}
        onConfirm={handleTransfer}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
