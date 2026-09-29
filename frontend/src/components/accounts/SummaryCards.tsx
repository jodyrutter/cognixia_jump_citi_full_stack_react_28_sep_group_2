import type { Account } from "../../types/account";

function fmt(n: number): { whole: string; cents: string } {
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [w, c] = s.split(".");
  return { whole: w, cents: `.${c}` };
}

export function SummaryCards({ accounts }: { accounts: Account[] }) {
  const total = accounts.length;
  const checking = accounts.filter((a) => a.account_type === "checking");
  const savings = accounts.filter((a) => a.account_type === "savings");
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const checkingBalance = checking.reduce((sum, a) => sum + Number(a.balance), 0);
  const savingsBalance = savings.reduce((sum, a) => sum + Number(a.balance), 0);

  const t = fmt(totalBalance);
  const avgChecking = checking.length ? checkingBalance / checking.length : 0;
  const avgSavings = savings.length ? savingsBalance / savings.length : 0;

  return (
    <div className="stat-row">
      <div className="stat">
        <span className="accent" />
        <div className="cap">Total Accounts</div>
        <div className="value">{total}</div>
        <div className="sub">
          <span>{checking.length} checking · {savings.length} savings</span>
        </div>
      </div>
      <div className="stat stat-red">
        <span className="accent" />
        <div className="cap">Assets Under Management</div>
        <div className="value">
          ${t.whole}<span className="cents">{t.cents}</span>
        </div>
        <div className="sub">
          <span>across {total} account{total === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="stat">
        <span className="accent" />
        <div className="cap">Checking</div>
        <div className="value">{checking.length}</div>
        <div className="sub">
          <span className="lead">${checkingBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          {checking.length > 0 && (
            <span>· avg ${avgChecking.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          )}
        </div>
      </div>
      <div className="stat stat-green">
        <span className="accent" />
        <div className="cap">Savings</div>
        <div className="value">{savings.length}</div>
        <div className="sub">
          <span className="lead">${savingsBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          {savings.length > 0 && (
            <span>· avg ${avgSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          )}
        </div>
      </div>
    </div>
  );
}
