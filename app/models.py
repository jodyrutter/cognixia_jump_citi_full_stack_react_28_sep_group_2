from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AccountType = Literal["checking", "savings"]


class User(BaseModel):
    user_id: int
    name: str
    email: str
    address: str


class Customer(User):
    pass


class Admin(User):
    admin: bool = True


class CustomerCreate(BaseModel):
    name: str
    email: str
    password: str
    address: str


class AccountCreate(BaseModel):
    owner_id: int
    account_type: AccountType
    account_number: str = Field(min_length=4, max_length=20)


class AccountUpdate(BaseModel):
    account_type: AccountType | None = None


class Account(AccountCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    balance: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
