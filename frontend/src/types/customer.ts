export interface Customer {
  user_id: number;
  name: string;
  email: string;
  address: string;
}

export interface Admin extends Customer {
  admin: true;
}

export interface CustomerCreate {
  name: string;
  email: string;
  password: string;
  address: string;
}

export interface CustomerUpdate {
  name?: string;
  email?: string;
  password?: string;
  address?: string;
}

export type AdminCreate = CustomerCreate;
