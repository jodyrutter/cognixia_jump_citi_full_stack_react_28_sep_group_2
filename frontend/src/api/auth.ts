import { api } from "./client";
import type { LoginRequest, LoginResponse } from "../types/auth";
import type { Customer, CustomerCreate } from "../types/customer";

export const authApi = {
  loginCustomer: (body: LoginRequest) => api.post<LoginResponse>("/api/login/customer", body),
  loginAdmin: (body: LoginRequest) => api.post<LoginResponse>("/api/login/admin", body),
  logout: () => api.post<void>("/api/logout", undefined),
  signup: (body: CustomerCreate) => api.post<Customer>("/api/signup", body),
  refresh: () => api.post<LoginResponse>("/api/auth/refresh", undefined),
};
