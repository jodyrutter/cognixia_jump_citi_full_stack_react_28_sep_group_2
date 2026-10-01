import { api } from "./client";
import type { TransferRequest, TransferResult } from "../types/transfer";

export const transfersApi = {
  create: (data: TransferRequest) => api.post<TransferResult>("/api/transfers", data),
};
