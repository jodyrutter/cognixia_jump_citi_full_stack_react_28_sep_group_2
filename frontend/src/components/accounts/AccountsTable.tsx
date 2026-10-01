import type { Account } from "../../types/account";
import type { Customer } from "../../types/customer";

const AVATAR_COLORS = ["#003b70", "#e02020", "#059669", "#d97706", "#7c3aed", "#0ea5e9", "#db2777", "#0891b2"];

function ownerColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtMoney(n: string) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  accounts: Account[];
  customersById: Map<number, Customer>;
  loading: boolean;
  showOwner?: boolean;
  onEdit?: (a: Account) => void;
  onDelete?: (a: Account) => void;
  onDeposit?: (a: Account) => void;
  onWithdraw?: (a: Account) => void;
}

export function AccountsTable({ accounts, customersById, loading, showOwner = true, onEdit, onDelete, onDeposit, onWithdraw }: Props) {
  if (loading) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th style={{ width: 160 }}>Account #</th>
              {showOwner && <th>Owner</th>}
              <th style={{ width: 110 }}>Type</th>
              <th className="right" style={{ width: 140 }}>Balance</th>
              <th style={{ width: 180 }} />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                <td><span className="skel" style={{ width: 38 }} /></td>
                <td><span className="skel" style={{ width: 100 }} /></td>
                {showOwner && <td><span className="skel" style={{ width: 180 }} /></td>}
                <td><span className="skel" style={{ width: 70 }} /></td>
                <td className="balance"><span className="skel" style={{ width: 80 }} /></td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 60 }}>ID</th>
            <th style={{ width: 160 }}>Account #</th>
            {showOwner && <th>Owner</th>}
            <th style={{ width: 110 }}>Type</th>
            <th className="right" style={{ width: 140 }}>Balance</th>
            <th style={{ width: 180 }} />
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const owner = customersById.get(a.owner_id);
            const displayName = owner?.name ?? `Customer #${a.owner_id}`;
            const initials = owner ? initialsOf(owner.name) : `#${a.owner_id}`;
            return (
              <tr key={a.id}>
                <td className="id">#{String(a.id).padStart(4, "0")}</td>
                <td className="acct">{a.account_number}</td>
                {showOwner && (
                  <td className="owner">
                    <span className="avatar-sm" style={{ background: ownerColor(a.owner_id) }}>
                      {initials}
                    </span>
                    {displayName}
                    {owner && (
                      <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>
                        · {owner.email}
                      </span>
                    )}
                  </td>
                )}
                <td>
                  <span className={`type-badge type-${a.account_type}`}>
                    {a.account_type[0].toUpperCase() + a.account_type.slice(1)}
                  </span>
                </td>
                <td className="balance">{fmtMoney(a.balance)}</td>
                <td className="row-menu">
                  <span className="row-actions">
                    {onDeposit && (
                      <button className="row-icon-btn success" title="Deposit" onClick={() => onDeposit(a)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      </button>
                    )}
                    {onWithdraw && (
                      <button className="row-icon-btn" title="Withdraw" onClick={() => onWithdraw(a)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <polyline points="19 12 12 19 5 12" />
                        </svg>
                      </button>
                    )}
                    {onEdit && (
                      <button className="row-icon-btn" title="Edit" onClick={() => onEdit(a)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button className="row-icon-btn danger" title="Delete" onClick={() => onDelete(a)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
