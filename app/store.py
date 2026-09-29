from copy import deepcopy
from decimal import Decimal

from .models import Account, AccountCreate, AccountUpdate


class AccountStore:
    def __init__(self) -> None:
        self._accounts: dict[int, Account] = {
            1: Account.model_validate(
                {
                    "id": 1,
                    "account_number": "10000001",
                    "owner_id": 1,
                    "account_type": "checking",
                    "balance": Decimal("1250.00"),
                }
            ),
            2: Account.model_validate(
                {
                    "id": 2,
                    "account_number": "10000002",
                    "owner_id": 2,
                    "account_type": "savings",
                    "balance": Decimal("4800.50"),
                }
            ),
        }
        self._next_id = 3

    def list_accounts(self) -> list[Account]:
        return deepcopy(list(self._accounts.values()))

    def list_for_owner(self, owner_id: int) -> list[Account]:
        return deepcopy([account for account in self._accounts.values() if account.owner_id == owner_id])

    def get(self, account_id: int) -> Account | None:
        account = self._accounts.get(account_id)
        return deepcopy(account) if account else None

    def create(self, account_data: AccountCreate) -> Account:
        account = Account.model_validate({"id": self._next_id, **account_data.model_dump()})
        self._accounts[account.id] = account
        self._next_id += 1
        return deepcopy(account)

    def update(self, account_id: int, account_data: AccountUpdate) -> Account | None:
        account = self._accounts.get(account_id)
        if account is None:
            return None

        updated_account = account.model_copy(update=account_data.model_dump(exclude_unset=True))
        self._accounts[account_id] = updated_account
        return deepcopy(updated_account)

    def save(self, account: Account) -> Account:
        self._accounts[account.id] = deepcopy(account)
        return deepcopy(account)

    def delete(self, account_id: int) -> bool:
        return self._accounts.pop(account_id, None) is not None
