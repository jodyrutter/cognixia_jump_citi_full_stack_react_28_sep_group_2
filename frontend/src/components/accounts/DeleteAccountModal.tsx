import type { Account } from "../../types/account";
import type { Customer } from "../../types/customer";

interface Props {
  open: boolean;
  account: Account | null;
  owner?: Customer;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({ open, account, owner, submitting, onCancel, onConfirm }: Props) {
  const ownerLabel = owner ? owner.name : account ? `Customer #${account.owner_id}` : "";
  return (
    <div className={`modal${open ? " open" : ""}`} role="dialog" aria-modal="true">
      <div className="modal-body">
        <div className="icon-warn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3>Delete this account?</h3>
        {account && (
          <p>
            You are about to permanently delete the <b>{account.account_type}</b> account{" "}
            <b>{account.account_number}</b> owned by <b>{ownerLabel}</b> (current balance{" "}
            <b>${Number(account.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>).
          </p>
        )}
        <div className="warn-line">This action cannot be undone.</div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={submitting}>
          {submitting ? "Deleting…" : "Delete Account"}
        </button>
      </div>
    </div>
  );
}
