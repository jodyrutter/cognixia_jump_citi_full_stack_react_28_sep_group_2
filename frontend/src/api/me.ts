import { api } from "./client";
import type { Account } from "../types/account";
import type { Customer, CustomerUpdate } from "../types/customer";
import type { Me } from "../types/me";

export const meApi = {
  get: () => api.get<Me>("/api/me"),
  update: (data: CustomerUpdate) => api.patch<Customer>("/api/me", data),
  listAccounts: () => api.get<Account[]>("/api/me/accounts"),
};
