import { useEffect, useMemo, useState } from "react";
import { meApi } from "../../api/me";
import { ApiError } from "../../api/client";
import type { Transaction, TransactionType } from "../../types/transaction";
import { localDate } from "../../utils/transactionFilters";
import { DateRangeFilter } from "./DateRangeFilter";
import { transactionDetails } from "./transactionDetails";

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

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

  const visible = useMemo(() => {
    const from = localDate(fromDate, false);
    const to = localDate(toDate, true);
    const min = minAmount === "" ? null : Number(minAmount);
    const max = maxAmount === "" ? null : Number(maxAmount);
    return transactions.filter((t) => {
      const when = new Date(t.created_at);
      const amount = Number(t.amount);
      return (accountFilter === "all" || t.account_number === accountFilter) &&
        (typeFilter === "all" || t.type === typeFilter) &&
        (!from || when >= from) &&
        (!to || when <= to) &&
        (min === null || amount >= min) &&
        (max === null || amount <= max);
    });
  }, [transactions, accountFilter, typeFilter, fromDate, toDate, minAmount, maxAmount]);

  const hasFilters = accountFilter !== "all" || typeFilter !== "all" ||
    fromDate !== "" || toDate !== "" || minAmount !== "" || maxAmount !== "";

  function clearFilters() {
    setAccountFilter("all");
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
    setMinAmount("");
    setMaxAmount("");
  }

  const totals = useMemo(() => {
    let deposits = 0;
    let withdrawals = 0;
    for (const t of visible) {
      if (t.type === "deposit" || t.type === "transfer_in") deposits += Number(t.amount);
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
          <div className="subtitle">Every deposit, withdrawal, and transfer you've made across your accounts.</div>
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

      <div className="filter-bar" style={{ flexWrap: "wrap" }}>
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
            <option value="transfer_in">Transfers In</option>
            <option value="transfer_out">Transfers Out</option>
          </select>
        </label>
        <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} />
        <div className="chip-select">
          <span>Amount:</span>
          <input type="number" min="0" step="0.01" placeholder="Min" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} aria-label="Minimum amount" style={{ width: 80 }} />
          –
          <input type="number" min="0" step="0.01" placeholder="Max" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} aria-label="Maximum amount" style={{ width: 80 }} />
        </div>
        {hasFilters && <button className="btn-link" onClick={clearFilters}>Clear</button>}
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
              ? "Deposits, withdrawals, and transfers you make from My Accounts will appear here."
              : "Try clearing or changing the filters."}
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
                <th>Details</th>
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
                      <td><span className="skel" style={{ width: 90 }} /></td>
                      <td className="amount"><span className="skel" style={{ width: 70 }} /></td>
                      <td className="balance"><span className="skel" style={{ width: 80 }} /></td>
                    </tr>
                  ))
                : visible.map((t) => {
                    const isCredit = t.type === "deposit" || t.type === "transfer_in";
                    const labels: Record<string, string> = {
                      deposit: "Deposit",
                      withdraw: "Withdrawal",
                      transfer_in: "Transfer In",
                      transfer_out: "Transfer Out",
                    };
                    return (
                      <tr key={t.id}>
                        <td className="when">{fmtDate(t.created_at)}</td>
                        <td className="acct">{t.account_number}</td>
                        <td>
                          <span className={`type-badge type-${t.type}`}>{labels[t.type]}</span>
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{transactionDetails(t)}</td>
                        <td className={`amount ${isCredit ? "credit" : "debit"}`}>
                          {isCredit ? "+" : "−"}{fmtMoney(t.amount)}
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
