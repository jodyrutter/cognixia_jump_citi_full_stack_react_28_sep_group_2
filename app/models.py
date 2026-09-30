from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


AccountType = Literal["checking", "savings"]
NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


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
    name: NonBlankString
    email: NonBlankString
    password: NonBlankString
    address: NonBlankString


class CustomerUpdate(BaseModel):
    name: NonBlankString | None = None
    email: NonBlankString | None = None
    password: NonBlankString | None = None
    address: NonBlankString | None = None


class AdminCreate(CustomerCreate):
    pass


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner_id: int
    account_type: AccountType
    account_number: str = Field(min_length=4, max_length=20)


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_type: AccountType | None = None
    balance: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class MoneyRequest(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)


class Account(AccountCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    balance: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)

class LoginRequest(BaseModel):
    email: str
    password: str
