import { useEffect, useState } from "react";
import { accountsApi } from "../../api/accounts";
import { ApiError } from "../../api/client";
import type { Account } from "../../types/account";
import type { Customer } from "../../types/customer";

function fmtMoney(n: string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  customer: Customer | null;
  onClose: () => void;
}

export function CustomerAccountsDrawer({ customer, onClose }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setAccounts([]);
    setError(null);
    setLoading(true);
    accountsApi
      .listForCustomer(customer.user_id)
      .then((list) => { if (!cancelled) setAccounts(list); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.detail ?? err.message : "Unexpected error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customer]);

  const total = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className={`drawer${customer ? " open" : ""}`} role="dialog" aria-modal="true">
      <div className="drawer-head">
        <h3>{customer ? `${customer.name}'s Accounts` : "Accounts"}</h3>
        <button className="close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="drawer-body">
        {customer && (
          <div className="readonly-box">
            <div className="row"><span className="k">Email</span><span className="v">{customer.email}</span></div>
            <div className="row"><span className="k">Address</span><span className="v">{customer.address}</span></div>
            {!loading && !error && (
              <div className="row"><span className="k">Total Balance</span><span className="v">{fmtMoney(String(total))}</span></div>
            )}
          </div>
        )}

        {error && (
          <div className="err-banner" style={{ marginTop: 16 }}>
            <div className="msg">{error}</div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading accounts…</p>
        ) : !error && accounts.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>This customer has no accounts.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Type</th>
                  <th className="right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="acct">{a.account_number}</td>
                    <td>
                      <span className={`type-badge type-${a.account_type}`}>
                        {a.account_type[0].toUpperCase() + a.account_type.slice(1)}
                      </span>
                    </td>
                    <td className="balance">{fmtMoney(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="drawer-foot">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
