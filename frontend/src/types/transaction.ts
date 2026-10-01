export type TransactionType = "deposit" | "withdraw" | "transfer_in" | "transfer_out";

export interface Transaction {
  id: number;
  account_id: number;
  account_number: string;
  owner_id: number;
  type: TransactionType;
  amount: string;
  balance_after: string;
  counterparty_account_number?: string | null;
  created_at: string;
}
