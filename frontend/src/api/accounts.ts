import { api } from "./client";
import type { Account, AccountCreate, AccountUpdate, AdminAccountCreate, MoneyRequest } from "../types/account";
import type { Transaction } from "../types/transaction";

export const accountsApi = {
  list: () => api.get<Account[]>("/api/accounts"),
  get: (id: number) => api.get<Account>(`/api/accounts/${id}`),
  create: (data: AccountCreate) => api.post<Account>("/api/accounts", data),
  adminCreate: (data: AdminAccountCreate) => api.post<Account>("/api/admin/accounts", data),
  listForCustomer: (customerId: number) => api.get<Account[]>(`/api/customers/${customerId}/accounts`),
  listTransactions: () => api.get<Transaction[]>("/api/transactions"),
  update: (id: number, data: AccountUpdate) => api.patch<Account>(`/api/accounts/${id}`, data),
  remove: (id: number) => api.del(`/api/accounts/${id}`),
  deposit: (id: number, data: MoneyRequest) => api.post<Account>(`/api/accounts/${id}/deposit`, data),
  withdraw: (id: number, data: MoneyRequest) => api.post<Account>(`/api/accounts/${id}/withdraw`, data),
};
