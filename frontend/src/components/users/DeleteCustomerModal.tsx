import type { Customer } from "../../types/customer";

interface Props {
  open: boolean;
  customer: Customer | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteCustomerModal({ open, customer, submitting, onCancel, onConfirm }: Props) {
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
        <h3>Delete this customer?</h3>
        {customer && (
          <p>
            You are about to permanently delete <b>{customer.name}</b> ({customer.email}).
          </p>
        )}
        <div className="warn-line">
          Requires admin privileges. Blocked if the customer still owns any accounts —
          delete or reassign their accounts first.
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={submitting}>
          {submitting ? "Deleting…" : "Delete Customer"}
        </button>
      </div>
    </div>
  );
}
