import { useEffect, useMemo, useState } from "react";
import { meApi } from "../../api/me";
import { transfersApi } from "../../api/transfers";
import { ApiError } from "../../api/client";
import type { Account } from "../../types/account";
import type { Me } from "../../types/me";
import type { Transaction } from "../../types/transaction";
import { Toast, type ToastMessage } from "../ui/Toast";

type Destination = "own" | "other";

function fmt(n: number | string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

interface Props {
  me: Me;
}

export function MyTransfersPage({ me }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [fromAccountId, setFromAccountId] = useState<number | "">("");
  const [destination, setDestination] = useState<Destination>("own");
  const [toOwnAccountId, setToOwnAccountId] = useState<number | "">("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  async function refresh() {
    setLoading(true);
    setListError(null);
    try {
      const [ownAccounts, transactions] = await Promise.all([meApi.listAccounts(), meApi.listTransactions()]);
      setAccounts(ownAccounts);
      setRecent(transactions.filter((t) => t.type === "transfer_in" || t.type === "transfer_out").slice(0, 8));
      setFromAccountId((current) => (current === "" ? ownAccounts[0]?.id ?? "" : current));
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

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const otherOwnAccounts = useMemo(
    () => accounts.filter((a) => a.id !== fromAccountId),
    [accounts, fromAccountId],
  );

  const resolvedToAccountNumber =
    destination === "own"
      ? accounts.find((a) => a.id === toOwnAccountId)?.account_number ?? ""
      : toAccountNumber.trim();

  const parsed = Number(amount);
  const numericValid = amount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
  const decimalsValid = !/\.\d{3,}$/.test(amount);
  const wouldOverdraw = fromAccount && numericValid && parsed > Number(fromAccount.balance);
  const destinationValid = destination === "own" ? toOwnAccountId !== "" : resolvedToAccountNumber !== "";

  const formErr = !fromAccount
    ? "Choose an account to send from."
    : !destinationValid
    ? destination === "own"
      ? "Choose a destination account."
      : "Enter the recipient's account number."
    : destination === "other" && fromAccount.account_number === resolvedToAccountNumber
    ? "Enter a different account number than the source account."
    : !numericValid
    ? "Enter an amount greater than $0.00."
    : !decimalsValid
    ? "Maximum two decimal places."
    : wouldOverdraw
    ? `Insufficient funds. Available balance: ${fmt(fromAccount!.balance)}.`
    : "";

  async function handleSubmit() {
    setTouched(true);
    if (formErr || !fromAccount) return;
    setSubmitting(true);
    setErrorDetail(undefined);
    try {
      const result = await transfersApi.create({
        from_account_id: fromAccount.id,
        to_account_number: resolvedToAccountNumber,
        amount,
      });
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === result.from_account.id) return result.from_account;
          if (result.to_account && a.id === result.to_account.id) return result.to_account;
          return a;
        }),
      );
      showToast(`Sent ${fmt(amount)} to ${result.to_owner_name} · ${result.to_account_number}`);
      setToOwnAccountId("");
      setToAccountNumber("");
      setAmount("");
      setTouched(false);
      refresh();
    } catch (err) {
      setErrorDetail(err instanceof ApiError ? err.detail ?? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">Transfers</span></div>

      <div className="page-head">
        <div>
          <h1>Transfers</h1>
          <div className="subtitle">Move money between your own accounts or send it to someone else.</div>
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

      {!loading && !listError && accounts.length === 0 ? (
        <div className="empty">
          <div className="art">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </div>
          <h3>No accounts yet</h3>
          <p>Open an account from My Accounts before you can send a transfer.</p>
        </div>
      ) : (
        <div className="form-card">
          <h2>New transfer</h2>

          <div className="form-group">
            <label>From <span className="req">*</span></label>
            <select
              value={fromAccountId}
              onChange={(e) => { setFromAccountId(Number(e.target.value)); setToOwnAccountId(""); }}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13.5, color: "var(--ink)", fontFamily: "inherit" }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number} · {a.account_type[0].toUpperCase() + a.account_type.slice(1)} · {fmt(a.balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Send to</label>
            <div className="radio-row">
              <div className={`radio-card${destination === "own" ? " selected" : ""}`} onClick={() => setDestination("own")}>
                <div className="dot" />
                <div>
                  <div className="lbl">One of my accounts</div>
                  <div className="desc">Move money between your own accounts</div>
                </div>
              </div>
              <div className={`radio-card${destination === "other" ? " selected" : ""}`} onClick={() => setDestination("other")}>
                <div className="dot" />
                <div>
                  <div className="lbl">Someone else</div>
                  <div className="desc">Send to another account number</div>
                </div>
              </div>
            </div>
          </div>

          {destination === "own" ? (
            <div className="form-group">
              <label>To account <span className="req">*</span></label>
              <select
                value={toOwnAccountId}
                onChange={(e) => setToOwnAccountId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13.5, color: "var(--ink)", fontFamily: "inherit" }}
              >
                <option value="">Select an account…</option>
                {otherOwnAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} · {a.account_type[0].toUpperCase() + a.account_type.slice(1)} · {fmt(a.balance)}
                  </option>
                ))}
              </select>
              {otherOwnAccounts.length === 0 && (
                <div className="help">You'll need a second account to transfer between your own accounts.</div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label>Recipient account number <span className="req">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                value={toAccountNumber}
                onChange={(e) => setToAccountNumber(e.target.value.replace(/\D/g, ""))}
                onBlur={() => setTouched(true)}
                placeholder="e.g. 10000002"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13.5, color: "var(--ink)", fontFamily: "inherit" }}
              />
            </div>
          )}

          <div className="form-group">
            <label>Amount <span className="req">*</span></label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontWeight: 500 }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                onBlur={() => setTouched(true)}
                placeholder="0.00"
                style={{ paddingLeft: 22, width: "100%", padding: "9px 12px 9px 22px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13.5, color: "var(--ink)", outline: "none", fontFamily: "inherit" }}
              />
            </div>
            {touched && formErr ? (
              <div className="field-error">{formErr}</div>
            ) : (
              <div className="help">Positive amount, up to 2 decimal places.</div>
            )}
          </div>

          {errorDetail && (
            <div className="err-banner" style={{ marginBottom: 16 }}>
              <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="msg">{errorDetail}</div>
            </div>
          )}

          <button className="btn btn-primary" disabled={submitting || !!formErr} onClick={handleSubmit}>
            {submitting ? "Sending…" : "Send Transfer"}
          </button>
        </div>
      )}

      <h2 style={{ fontFamily: "var(--serif)", fontSize: 16, margin: "0 0 12px", color: "var(--ink)" }}>Recent transfers</h2>
      {!loading && recent.length === 0 ? (
        <div className="empty">
          <h3>No transfers yet</h3>
          <p>Transfers you send or receive will appear here.</p>
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
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => {
                const isCredit = t.type === "transfer_in";
                const details = isCredit ? `From ${t.counterparty_account_number}` : `To ${t.counterparty_account_number}`;
                return (
                  <tr key={t.id}>
                    <td className="when">{fmtDate(t.created_at)}</td>
                    <td className="acct">{t.account_number}</td>
                    <td><span className={`type-badge type-${t.type}`}>{isCredit ? "Transfer In" : "Transfer Out"}</span></td>
                    <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{details}</td>
                    <td className={`amount ${isCredit ? "credit" : "debit"}`}>{isCredit ? "+" : "−"}{fmt(t.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
