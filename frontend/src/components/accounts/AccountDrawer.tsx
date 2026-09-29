import { useEffect, useState } from "react";
import type { Account, AccountCreate, AccountType, AccountUpdate } from "../../types/account";
import type { Customer } from "../../types/customer";

type Mode = { kind: "create" } | { kind: "edit"; account: Account };

interface Props {
  open: boolean;
  mode: Mode;
  customers: Customer[];
  submitting: boolean;
  errorDetail?: string;
  onClose: () => void;
  onCreate: (data: AccountCreate) => void;
  onUpdate: (id: number, data: AccountUpdate) => void;
}

export function AccountDrawer({ open, mode, customers, submitting, errorDetail, onClose, onCreate, onUpdate }: Props) {
  const [accountNumber, setAccountNumber] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (mode.kind === "edit") {
      setAccountNumber(mode.account.account_number);
      setOwnerId(String(mode.account.owner_id));
      setAccountType(mode.account.account_type);
    } else {
      setAccountNumber("");
      setOwnerId(customers[0] ? String(customers[0].user_id) : "");
      setAccountType("checking");
    }
  }, [open, mode, customers]);

  const acctErr =
    accountNumber.length < 4
      ? "Must be at least 4 characters."
      : accountNumber.length > 20
      ? "Must be 20 characters or fewer."
      : "";
  const ownerErr = ownerId === "" ? "Select a customer." : "";

  const isCreate = mode.kind === "create";
  const canSubmit = isCreate ? !acctErr && !ownerErr && !submitting : !submitting;

  function handleSubmit() {
    setTouched(true);
    if (isCreate) {
      if (!canSubmit) return;
      onCreate({ account_number: accountNumber, owner_id: Number(ownerId), account_type: accountType });
    } else if (mode.kind === "edit") {
      onUpdate(mode.account.id, { account_type: accountType });
    }
  }

  const currentOwner =
    mode.kind === "edit" ? customers.find((c) => c.user_id === mode.account.owner_id) : undefined;

  return (
    <div className={`drawer${open ? " open" : ""}`} role="dialog" aria-modal="true">
      <div className="drawer-head">
        <h3>{isCreate ? "Create Account" : "Edit Account"}</h3>
        <button className="close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="drawer-body">
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

        {!isCreate && mode.kind === "edit" && (
          <div className="readonly-box">
            <div className="row">
              <span className="k">Account ID</span>
              <span className="v">#{String(mode.account.id).padStart(4, "0")}</span>
            </div>
            <div className="row">
              <span className="k">Account Number</span>
              <span className="v">{mode.account.account_number}</span>
            </div>
            <div className="row">
              <span className="k">Owner</span>
              <span className="v">{currentOwner ? currentOwner.name : `Customer #${mode.account.owner_id}`}</span>
            </div>
            <div className="row">
              <span className="k">Current Balance</span>
              <span className="v">${Number(mode.account.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {isCreate && (
          <>
            <div className="form-group">
              <label>Account Number <span className="req">*</span></label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="e.g. 10000003"
              />
              {touched && acctErr ? (
                <div className="field-error">{acctErr}</div>
              ) : (
                <div className="help">4–20 characters. Must be unique across the institution.</div>
              )}
            </div>
            <div className="form-group">
              <label>Owner <span className="req">*</span></label>
              {customers.length === 0 ? (
                <>
                  <input type="text" value="No customers available" disabled />
                  <div className="field-error">Create a customer first (Customers page) before opening an account.</div>
                </>
              ) : (
                <>
                  <select
                    className="select-input"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    onBlur={() => setTouched(true)}
                  >
                    {customers.map((c) => (
                      <option key={c.user_id} value={c.user_id}>
                        {c.name} — {c.email} (#{c.user_id})
                      </option>
                    ))}
                  </select>
                  {touched && ownerErr ? (
                    <div className="field-error">{ownerErr}</div>
                  ) : (
                    <div className="help">Only existing customers can own an account.</div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <div className="form-group">
          <label>Account Type <span className="req">*</span></label>
          <div className="radio-row">
            <div
              className={`radio-card${accountType === "checking" ? " selected" : ""}`}
              onClick={() => setAccountType("checking")}
            >
              <div className="dot" />
              <div>
                <div className="lbl">Checking</div>
                <div className="desc">Everyday spending</div>
              </div>
            </div>
            <div
              className={`radio-card${accountType === "savings" ? " selected" : ""}`}
              onClick={() => setAccountType("savings")}
            >
              <div className="dot" />
              <div>
                <div className="lbl">Savings</div>
                <div className="desc">Interest-bearing</div>
              </div>
            </div>
          </div>
        </div>

        {isCreate && (
          <div className="form-group">
            <label>Opening Balance</label>
            <input type="text" value="$0.00" disabled />
            <div className="help">Balance starts at $0.00. Use Deposit to fund the account after creation.</div>
          </div>
        )}
      </div>
      <div className="drawer-foot">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || (isCreate && customers.length === 0)}>
          {submitting ? "Saving…" : isCreate ? "Create Account" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
