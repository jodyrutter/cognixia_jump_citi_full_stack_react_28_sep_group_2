import { useEffect, useState } from "react";
import type { Account } from "../../types/account";
import type { Customer } from "../../types/customer";

export type MoneyMode = "deposit" | "withdraw";

interface Props {
  open: boolean;
  mode: MoneyMode;
  account: Account | null;
  owner?: Customer;
  submitting: boolean;
  errorDetail?: string;
  onCancel: () => void;
  onConfirm: (amount: string) => void;
}

function fmt(n: number | string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MoneyModal({ open, mode, account, owner, submitting, errorDetail, onCancel, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setTouched(false);
    }
  }, [open, account?.id]);

  const isDeposit = mode === "deposit";
  const parsed = Number(amount);
  const numericValid = amount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
  const decimalsValid = !/\.\d{3,}$/.test(amount);
  const wouldOverdraw = !isDeposit && account && numericValid && parsed > Number(account.balance);
  const err = !numericValid
    ? "Enter an amount greater than $0.00."
    : !decimalsValid
    ? "Maximum two decimal places."
    : wouldOverdraw
    ? `Insufficient funds. Available balance: ${fmt(account!.balance)}.`
    : "";

  return (
    <div className={`modal${open ? " open" : ""}`} role="dialog" aria-modal="true">
      <div className="modal-body">
        <div className={`icon-warn ${isDeposit ? "icon-money-in" : "icon-money-out"}`}>
          {isDeposit ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          )}
        </div>
        <h3>{isDeposit ? "Deposit funds" : "Withdraw funds"}</h3>
        {account && (
          <p>
            Account <b>{account.account_number}</b> · Owner <b>{owner ? owner.name : `Customer #${account.owner_id}`}</b> ·
            Current balance <b>{fmt(account.balance)}</b>.
          </p>
        )}

        <div className="form-group" style={{ marginTop: 18 }}>
          <label>Amount <span className="req">*</span></label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontWeight: 500 }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              autoFocus
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
        <button
          className={`btn ${isDeposit ? "btn-primary" : "btn-danger"}`}
          disabled={submitting || !!err || !numericValid}
          onClick={() => {
            setTouched(true);
            if (err || !numericValid) return;
            onConfirm(amount);
          }}
        >
          {submitting ? "Processing…" : isDeposit ? "Deposit" : "Withdraw"}
        </button>
      </div>
    </div>
  );
}
