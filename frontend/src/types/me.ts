export type Role = "admin" | "customer";

export interface Me {
  user_id: number;
  name: string;
  email: string;
  address: string;
  role: Role;
}
