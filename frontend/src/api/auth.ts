import { api } from "./client";
import type { LoginRequest, LoginResponse } from "../types/auth";

export const authApi = {
  loginCustomer: (body: LoginRequest) => api.post<LoginResponse>("/api/login/customer", body),
  loginAdmin: (body: LoginRequest) => api.post<LoginResponse>("/api/login/admin", body),
  logout: () => api.post<void>("/api/logout", undefined),
};
