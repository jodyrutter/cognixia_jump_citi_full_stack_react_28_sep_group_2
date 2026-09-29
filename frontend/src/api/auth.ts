import { api } from "./client";
import type { LoginRequest, LoginResponse } from "../types/auth";

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>("/api/login", body),
};
