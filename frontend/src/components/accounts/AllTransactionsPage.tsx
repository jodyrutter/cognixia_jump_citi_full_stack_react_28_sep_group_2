import { useEffect, useMemo, useState } from "react";
import { accountsApi } from "../../api/accounts";
import { usersApi } from "../../api/users";
import { ApiError } from "../../api/client";
import type { Customer } from "../../types/customer";
import type { Transaction } from "../../types/transaction";

function fmtMoney(n: string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// Parses a yyyy-mm-dd input value as a local-time date.
function localDate(value: string, endOfDay: boolean) {
  const [y, m, d] = value.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

export function AllTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [txList, custList] = await Promise.all([accountsApi.listTransactions(), usersApi.listCustomers()]);
      setTransactions(txList);
      setCustomers(custList);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail ?? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const customersById = useMemo(() => new Map(customers.map((c) => [c.user_id, c])), [customers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? localDate(fromDate, false) : null;
    const to = toDate ? localDate(toDate, true) : null;
    const min = minAmount === "" ? null : Number(minAmount);
    const max = maxAmount === "" ? null : Number(maxAmount);
    return transactions.filter((t) => {
      const when = new Date(t.created_at);
      if (from && when < from) return false;
      if (to && when > to) return false;
      const amount = Number(t.amount);
      if (min !== null && amount < min) return false;
      if (max !== null && amount > max) return false;
      if (!q) return true;
      const owner = customersById.get(t.owner_id);
      return (
        t.account_number.toLowerCase().includes(q) ||
        (owner?.name.toLowerCase().includes(q) ?? false) ||
        (owner?.email.toLowerCase().includes(q) ?? false)
      );
    });
  }, [transactions, customersById, search, fromDate, toDate, minAmount, maxAmount]);

  const hasFilters = search !== "" || fromDate !== "" || toDate !== "" || minAmount !== "" || maxAmount !== "";

  function clearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setMinAmount("");
    setMaxAmount("");
  }

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">Transactions</span></div>

      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <div className="subtitle">Every deposit and withdrawal across all customer accounts.</div>
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
        </div>
      </div>

      {error && (
        <div className="err-banner">
          <svg className="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="msg"><b>Couldn't load transactions.</b> {error}</div>
          <button className="btn-link" onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="filter-bar" style={{ flexWrap: "wrap" }}>
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
          Date:
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
          –
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
        </label>
        <label className="chip-select">
          Amount:
          <input type="number" min="0" step="0.01" placeholder="Min" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} aria-label="Minimum amount" style={{ width: 80 }} />
          –
          <input type="number" min="0" step="0.01" placeholder="Max" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} aria-label="Maximum amount" style={{ width: 80 }} />
        </label>
        {hasFilters && <button className="btn-link" onClick={clearFilters}>Clear</button>}
      </div>

      {!loading && !error && visible.length === 0 ? (
        <div className="empty">
          <h3>{transactions.length === 0 ? "No transactions yet" : "No matching transactions"}</h3>
          <p>
            {transactions.length === 0
              ? "Customer deposits and withdrawals will appear here."
              : "Try clearing the search or filters."}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Date</th>
                  <th style={{ width: 160 }}>Account #</th>
                  <th>Owner</th>
                  <th style={{ width: 120 }}>Type</th>
                  <th className="right" style={{ width: 150 }}>Amount</th>
                  <th className="right" style={{ width: 160 }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="skeleton-row">
                        <td><span className="skel" style={{ width: 130 }} /></td>
                        <td><span className="skel" style={{ width: 100 }} /></td>
                        <td><span className="skel" style={{ width: 160 }} /></td>
                        <td><span className="skel" style={{ width: 70 }} /></td>
                        <td className="amount"><span className="skel" style={{ width: 70 }} /></td>
                        <td className="balance"><span className="skel" style={{ width: 80 }} /></td>
                      </tr>
                    ))
                  : visible.map((t) => {
                      const isDeposit = t.type === "deposit";
                      const owner = customersById.get(t.owner_id);
                      return (
                        <tr key={t.id}>
                          <td className="when">{fmtDate(t.created_at)}</td>
                          <td className="acct">{t.account_number}</td>
                          <td className="owner">
                            {owner?.name ?? `Customer #${t.owner_id}`}
                            {owner && (
                              <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>· {owner.email}</span>
                            )}
                          </td>
                          <td>
                            <span className={`type-badge type-${t.type}`}>{isDeposit ? "Deposit" : "Withdrawal"}</span>
                          </td>
                          <td className={`amount ${isDeposit ? "credit" : "debit"}`}>
                            {isDeposit ? "+" : "−"}{fmtMoney(t.amount)}
                          </td>
                          <td className="balance">{fmtMoney(t.balance_after)}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="paging">
              <div>
                Showing <b style={{ color: "var(--ink)" }}>{visible.length}</b> of{" "}
                <b style={{ color: "var(--ink)" }}>{transactions.length}</b> transactions
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
