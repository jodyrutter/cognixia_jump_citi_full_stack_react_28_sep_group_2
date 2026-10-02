import { api } from "./client";
import type { Admin, AdminCreate, Customer, CustomerCreate, CustomerUpdate } from "../types/customer";

export const usersApi = {
  listCustomers: () => api.get<Customer[]>("/api/customers"),
  createCustomer: (data: CustomerCreate) => api.post<Customer>("/api/customers", data),
  updateCustomer: (id: number, data: CustomerUpdate) => api.patch<Customer>(`/api/customers/${id}`, data),
  deleteCustomer: (id: number) => api.del(`/api/customers/${id}`),
  listAdmins: () => api.get<Admin[]>("/api/admins"),
  createAdmin: (data: AdminCreate) => api.post<Admin>("/api/admins", data),
};
