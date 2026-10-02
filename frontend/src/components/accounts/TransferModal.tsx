import { useEffect, useMemo, useState } from "react";
import type { Account } from "../../types/account";

type Destination = "own" | "other";

interface Props {
  open: boolean;
  accounts: Account[];
  initialFromAccountId?: number;
  submitting: boolean;
  errorDetail?: string;
  onCancel: () => void;
  onConfirm: (data: { fromAccountId: number; toAccountNumber: string; amount: string }) => void;
}

function fmt(n: number | string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TransferModal({ open, accounts, initialFromAccountId, submitting, errorDetail, onCancel, onConfirm }: Props) {
  const [fromAccountId, setFromAccountId] = useState<number | "">("");
  const [destination, setDestination] = useState<Destination>("own");
  const [toOwnAccountId, setToOwnAccountId] = useState<number | "">("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromAccountId(initialFromAccountId ?? (accounts[0]?.id ?? ""));
    setDestination("own");
    setToOwnAccountId("");
    setToAccountNumber("");
    setAmount("");
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFromAccountId]);

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
  const destinationValid =
    destination === "own" ? toOwnAccountId !== "" : resolvedToAccountNumber !== "";

  const err = !fromAccount
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

  function handleSubmit() {
    setTouched(true);
    if (err || !fromAccount) return;
    onConfirm({ fromAccountId: fromAccount.id, toAccountNumber: resolvedToAccountNumber, amount });
  }

  return (
    <div className={`modal${open ? " open" : ""}`} role="dialog" aria-modal="true">
      <div className="modal-body">
        <div className="icon-warn icon-money-in">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>
        <h3>Transfer funds</h3>

        <div className="form-group" style={{ marginTop: 18 }}>
          <label>From <span className="req">*</span></label>
          <select
            className="bank-select"
            value={fromAccountId}
            onChange={(e) => {
              setFromAccountId(Number(e.target.value));
              setToOwnAccountId("");
            }}
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
            <div
              className={`radio-card${destination === "own" ? " selected" : ""}`}
              onClick={() => setDestination("own")}
            >
              <div className="dot" />
              <div>
                <div className="lbl">One of my accounts</div>
                <div className="desc">Move money between your own accounts</div>
              </div>
            </div>
            <div
              className={`radio-card${destination === "other" ? " selected" : ""}`}
              onClick={() => setDestination("other")}
            >
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
              className="bank-select"
              value={toOwnAccountId}
              onChange={(e) => setToOwnAccountId(e.target.value === "" ? "" : Number(e.target.value))}
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
          {touched && err ? (
            <div className="field-error">{err}</div>
          ) : (
            <div className="help">Positive amount, up to 2 decimal places.</div>
          )}
        </div>

        {errorDetail && (
          <div className="err-banner" style={{ marginBottom: 4 }}>
            <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="msg">{errorDetail}</div>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary" disabled={submitting || !!err} onClick={handleSubmit}>
          {submitting ? "Sending…" : "Send Transfer"}
        </button>
      </div>
    </div>
  );
}
