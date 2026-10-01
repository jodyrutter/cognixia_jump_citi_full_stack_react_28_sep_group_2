export type TransactionType = "deposit" | "withdraw";

export interface Transaction {
  id: number;
  account_id: number;
  account_number: string;
  owner_id: number;
  type: TransactionType;
  amount: string;
  balance_after: string;
  created_at: string;
}
