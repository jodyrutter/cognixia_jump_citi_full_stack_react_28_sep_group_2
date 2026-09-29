from decimal import Decimal

from ..models import Account, AccountCreate, AccountUpdate
from ..storage_protocols import AccountStoreProtocol, UserStoreProtocol


class AccountNotFoundError(Exception):
    pass


class CustomerNotFoundError(Exception):
    pass


class InvalidAmountError(Exception):
    pass


class InsufficientFundsError(Exception):
    pass


class AccountService:
    def __init__(self, store: AccountStoreProtocol, user_store: UserStoreProtocol) -> None:
        self._store = store
        self._user_store = user_store

    def list_accounts(self) -> list[Account]:
        return self._store.list_accounts()

    def list_customer_accounts(self, customer_id: int) -> list[Account]:
        if self._user_store.get_customer(customer_id) is None:
            raise CustomerNotFoundError
        return [account for account in self._store.list_accounts() if account.owner_id == customer_id]

    def get_account(self, account_id: int) -> Account:
        account = self._store.get(account_id)
        if account is None:
            raise AccountNotFoundError
        return account

    def create_account(self, account_data: AccountCreate) -> Account:
        if self._user_store.get_customer(account_data.owner_id) is None:
            raise CustomerNotFoundError
        return self._store.create(account_data)

    def update_account(self, account_id: int, account_data: AccountUpdate) -> Account:
        account = self._store.update(account_id, account_data)
        if account is None:
            raise AccountNotFoundError
        return account

    def delete_account(self, account_id: int) -> None:
        if not self._store.delete(account_id):
            raise AccountNotFoundError

    def deposit(self, account_id: int, amount: Decimal) -> Account:
        account = self.get_account(account_id)
        self._validate_amount(amount)
        updated_account = account.model_copy(update={"balance": account.balance + amount})
        return self._store.save(updated_account)

    def withdraw(self, account_id: int, amount: Decimal) -> Account:
        account = self.get_account(account_id)
        self._validate_amount(amount)
        if amount > account.balance:
            raise InsufficientFundsError

        updated_account = account.model_copy(update={"balance": account.balance - amount})
        return self._store.save(updated_account)

    @staticmethod
    def _validate_amount(amount: Decimal) -> None:
        if amount <= 0:
            raise InvalidAmountError
