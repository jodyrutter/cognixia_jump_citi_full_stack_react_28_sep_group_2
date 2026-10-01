import type { Transaction } from "../../types/transaction";

export function transactionDetails(transaction: Transaction): string {
  if (transaction.type === "transfer_in") return `From ${transaction.counterparty_name || "Name unavailable"}`;
  if (transaction.type === "transfer_out") return `To ${transaction.counterparty_name || "Name unavailable"}`;
  return "—";
}
