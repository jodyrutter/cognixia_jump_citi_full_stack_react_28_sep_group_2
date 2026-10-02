import type { Account } from "./account";

export interface TransferRequest {
  from_account_id: number;
  to_account_number: string;
  amount: string;
}

export interface TransferResult {
  from_account: Account;
  to_account: Account | null;
  to_account_number: string;
  to_owner_name: string;
}
