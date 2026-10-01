import { useEffect, useMemo, useState } from "react";
import { meApi } from "../../api/me";
import { ApiError } from "../../api/client";
import type { Transaction, TransactionType } from "../../types/transaction";

function fmtMoney(n: string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function MyTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setTransactions(await meApi.listTransactions());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail ?? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const accountNumbers = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.account_number))).sort(),
    [transactions],
  );

  const visible = transactions.filter(
    (t) =>
      (accountFilter === "all" || t.account_number === accountFilter) &&
      (typeFilter === "all" || t.type === typeFilter),
  );

  const totals = useMemo(() => {
    let deposits = 0;
    let withdrawals = 0;
    for (const t of visible) {
      if (t.type === "deposit") deposits += Number(t.amount);
      else withdrawals += Number(t.amount);
    }
    return { deposits, withdrawals };
  }, [visible]);

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">Transactions</span></div>

      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <div className="subtitle">Every deposit and withdrawal you've made across your accounts.</div>
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
          <div className="msg"><b>Couldn't load your transactions.</b> {error}</div>
          <button className="btn-link" onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="filter-bar">
        <label className="chip-select">
          Account:
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="all">All</option>
            {accountNumbers.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="chip-select">
          Type:
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | TransactionType)}>
            <option value="all">All</option>
            <option value="deposit">Deposits</option>
            <option value="withdraw">Withdrawals</option>
          </select>
        </label>
        <div className="spacer" />
        {!loading && visible.length > 0 && (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            In <b style={{ color: "var(--success)" }}>{fmtMoney(String(totals.deposits))}</b>
            {" · "}
            Out <b style={{ color: "var(--ink)" }}>{fmtMoney(String(totals.withdrawals))}</b>
          </span>
        )}
      </div>

      {!loading && !error && visible.length === 0 ? (
        <div className="empty">
          <div className="art">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="9" x2="20" y2="9" />
              <line x1="4" y1="15" x2="20" y2="15" />
              <line x1="10" y1="3" x2="8" y2="21" />
              <line x1="16" y1="3" x2="14" y2="21" />
            </svg>
          </div>
          <h3>{transactions.length === 0 ? "No transactions yet" : "No matching transactions"}</h3>
          <p>
            {transactions.length === 0
              ? "Deposits and withdrawals you make from My Accounts will appear here."
              : "Try a different account or type filter."}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 200 }}>Date</th>
                <th style={{ width: 160 }}>Account #</th>
                <th>Type</th>
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
                      <td><span className="skel" style={{ width: 70 }} /></td>
                      <td className="amount"><span className="skel" style={{ width: 70 }} /></td>
                      <td className="balance"><span className="skel" style={{ width: 80 }} /></td>
                    </tr>
                  ))
                : visible.map((t) => {
                    const isDeposit = t.type === "deposit";
                    return (
                      <tr key={t.id}>
                        <td className="when">{fmtDate(t.created_at)}</td>
                        <td className="acct">{t.account_number}</td>
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
      )}
    </>
  );
}
