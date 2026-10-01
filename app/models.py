import re
import string
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


AccountType = Literal["checking", "savings"]
NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

MIN_PASSWORD_LENGTH = 8
_ALPHANUMERIC = frozenset(string.ascii_letters + string.digits)

# Requires a letter before the @, a letter between the @ and the period, and a letter after the period.
_EMAIL_PATTERN = re.compile(r"^[^\s@]*[A-Za-z][^\s@]*@[^\s@]*[A-Za-z][^\s@]*\.[^\s@]*[A-Za-z][^\s@]*$")


def _validate_password_strength(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    if all(char in _ALPHANUMERIC for char in password):
        raise ValueError("Password must contain at least one special character")
    return password


def _validate_email_format(email: str) -> str:
    if not _EMAIL_PATTERN.match(email):
        raise ValueError("Must be a valid email address")
    return email


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

    @field_validator("email")
    @classmethod
    def _email_format(cls, value: str) -> str:
        return _validate_email_format(value)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class CustomerUpdate(BaseModel):
    name: NonBlankString | None = None
    email: NonBlankString | None = None
    password: NonBlankString | None = None
    address: NonBlankString | None = None

    @field_validator("email")
    @classmethod
    def _email_format(cls, value: str | None) -> str | None:
        return _validate_email_format(value) if value is not None else value

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str | None) -> str | None:
        return _validate_password_strength(value) if value is not None else value


class AdminCreate(CustomerCreate):
    pass


class Me(BaseModel):
    user_id: int
    name: str
    email: str
    address: str
    role: Literal["admin", "customer"]


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner_id: int
    account_type: AccountType


class AccountOpenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_type: AccountType


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_type: AccountType | None = None
    balance: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class MoneyRequest(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)


class TransferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_account_id: int
    to_account_number: NonBlankString
    amount: Decimal = Field(gt=0, decimal_places=2)


class Account(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_number: str
    owner_id: int
    account_type: AccountType
    balance: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)

TransactionType = Literal["deposit", "withdraw", "transfer_in", "transfer_out"]


class Transaction(BaseModel):
    id: int
    account_id: int
    account_number: str
    owner_id: int
    type: TransactionType
    amount: Decimal
    balance_after: Decimal
    counterparty_account_number: str | None = None
    created_at: datetime


class TransferResult(BaseModel):
    from_account: Account
    to_account: Account | None = None
    to_account_number: str
    to_owner_name: str


class LoginRequest(BaseModel):
    email: str
    password: str
