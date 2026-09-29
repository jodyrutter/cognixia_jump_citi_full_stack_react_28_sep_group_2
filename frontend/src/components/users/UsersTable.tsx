import type { Customer } from "../../types/customer";

const AVATAR_COLORS = ["#003b70", "#e02020", "#059669", "#d97706", "#7c3aed", "#0ea5e9", "#db2777", "#0891b2"];

function color(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  users: Customer[];
  loading: boolean;
  kind: "customer" | "admin";
  onEdit?: (u: Customer) => void;
  onDelete?: (u: Customer) => void;
}

export function UsersTable({ users, loading, kind, onEdit, onDelete }: Props) {
  const roleLabel = kind === "admin" ? "Admin" : "Customer";
  const badgeClass = kind === "admin" ? "type-checking" : "type-savings";
  const hasActions = !!onEdit || !!onDelete;

  if (loading) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Address</th>
              <th style={{ width: 100 }}>Role</th>
              {hasActions && <th style={{ width: 92 }} />}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                <td><span className="skel" style={{ width: 30 }} /></td>
                <td><span className="skel" style={{ width: 160 }} /></td>
                <td><span className="skel" style={{ width: 220 }} /></td>
                <td><span className="skel" style={{ width: 140 }} /></td>
                <td><span className="skel" style={{ width: 60 }} /></td>
                {hasActions && <td />}
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
            <th>Name</th>
            <th>Email</th>
            <th>Address</th>
            <th style={{ width: 100 }}>Role</th>
            {hasActions && <th style={{ width: 92 }} />}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td className="id">#{String(u.user_id).padStart(4, "0")}</td>
              <td className="owner">
                <span className="avatar-sm" style={{ background: color(u.user_id) }}>
                  {initialsOf(u.name)}
                </span>
                {u.name}
              </td>
              <td>{u.email}</td>
              <td style={{ color: "var(--muted)" }}>{u.address}</td>
              <td><span className={`type-badge ${badgeClass}`}>{roleLabel}</span></td>
              {hasActions && (
                <td className="row-menu">
                  <span className="row-actions">
                    {onEdit && (
                      <button className="row-icon-btn" title="Edit" onClick={() => onEdit(u)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button className="row-icon-btn danger" title="Delete (admin only)" onClick={() => onDelete(u)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    )}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
