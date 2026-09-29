import { api } from "./client";
import type { Account, AccountCreate, AccountUpdate, MoneyRequest } from "../types/account";

export const accountsApi = {
  list: () => api.get<Account[]>("/api/accounts"),
  get: (id: number) => api.get<Account>(`/api/accounts/${id}`),
  create: (data: AccountCreate) => api.post<Account>("/api/accounts", data),
  update: (id: number, data: AccountUpdate) => api.patch<Account>(`/api/accounts/${id}`, data),
  remove: (id: number) => api.del(`/api/accounts/${id}`),
  deposit: (id: number, data: MoneyRequest) => api.post<Account>(`/api/accounts/${id}/deposit`, data),
  withdraw: (id: number, data: MoneyRequest) => api.post<Account>(`/api/accounts/${id}/withdraw`, data),
};
