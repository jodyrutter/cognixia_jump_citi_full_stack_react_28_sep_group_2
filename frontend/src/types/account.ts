export type AccountType = "checking" | "savings";

export interface Account {
  id: number;
  account_number: string;
  owner_id: number;
  account_type: AccountType;
  balance: string;
}

export interface AccountCreate {
  account_number: string;
  owner_id: number;
  account_type: AccountType;
}

export interface AccountUpdate {
  account_type?: AccountType;
}

export interface MoneyRequest {
  amount: string;
}
