from decimal import Decimal

from ..models import Account, AccountCreate, AccountType, AccountUpdate, Admin, Transaction, TransferResult
from ..storage_protocols import AccountStoreProtocol, UserStoreProtocol


class AccountNotFoundError(Exception):
    pass


class CustomerNotFoundError(Exception):
    pass


class InvalidAmountError(Exception):
    pass


class InsufficientFundsError(Exception):
    pass


class RecipientNotFoundError(Exception):
    pass


class SameAccountTransferError(Exception):
    pass


class OwnerIsAdminError(Exception):
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
        return self._store.list_for_owner(customer_id)

    def list_customer_transactions(self, customer_id: int) -> list[Transaction]:
        if self._user_store.get_customer(customer_id) is None:
            raise CustomerNotFoundError
        return self._with_counterparty_names(self._store.list_transactions_for_owner(customer_id))

    def list_transactions(self) -> list[Transaction]:
        return self._with_counterparty_names(self._store.list_transactions())

    def _with_counterparty_names(self, transactions: list[Transaction]) -> list[Transaction]:
        names: dict[str, str | None] = {}
        result: list[Transaction] = []
        for transaction in transactions:
            number = transaction.counterparty_account_number
            if not number or transaction.counterparty_name:
                result.append(transaction)
                continue
            if number not in names:
                account = self._store.get_by_account_number(number)
                owner = self._user_store.get(account.owner_id) if account else None
                names[number] = owner.name if owner else None
            result.append(transaction.model_copy(update={"counterparty_name": names[number]}))
        return result

    def get_account(self, account_id: int) -> Account:
        account = self._store.get(account_id)
        if account is None:
            raise AccountNotFoundError
        return account

    def create_account(self, account_data: AccountCreate) -> Account:
        if self._user_store.get_customer(account_data.owner_id) is None:
            raise CustomerNotFoundError
        return self._store.create(account_data)

    def create_account_for_email(self, owner_email: str, account_type: AccountType) -> Account:
        owner = self._user_store.get_by_email(owner_email)
        if owner is None:
            raise CustomerNotFoundError
        if isinstance(owner, Admin):
            raise OwnerIsAdminError
        return self._store.create(AccountCreate(owner_id=owner.user_id, account_type=account_type))

    def update_account(self, account_id: int, account_data: AccountUpdate) -> Account:
        account = self._store.update(account_id, account_data)
        if account is None:
            raise AccountNotFoundError
        return account

    def delete_account(self, account_id: int) -> None:
        if not self._store.delete(account_id):
            raise AccountNotFoundError

    def deposit(self, account_id: int, amount: Decimal) -> Account:
        self._validate_amount(amount)

        account = self._store.deposit(account_id, amount)

        if account is None:
            raise AccountNotFoundError

        return account

    def withdraw(self, account_id: int, amount: Decimal) -> Account:
        self._validate_amount(amount)
        
        account = self._store.withdraw(account_id, amount)
        
        if account is None:
            if self._store.get(account_id) is None:
                raise AccountNotFoundError

            raise InsufficientFundsError

        return account

    def transfer(self, from_account_id: int, to_account_number: str, amount: Decimal) -> TransferResult:
        self._validate_amount(amount)

        from_account = self.get_account(from_account_id)

        to_account = self._store.get_by_account_number(to_account_number)
        if to_account is None:
            raise RecipientNotFoundError
        if to_account.id == from_account.id:
            raise SameAccountTransferError

        sender = self._user_store.get(from_account.owner_id)
        recipient = self._user_store.get(to_account.owner_id)
        result = self._store.transfer(
            from_account.id, to_account.id, amount,
            from_owner_name=sender.name if sender else None,
            to_owner_name=recipient.name if recipient else None,
        )
        if result is None:
            raise InsufficientFundsError
        updated_from, updated_to = result

        same_owner = updated_to.owner_id == updated_from.owner_id
        return TransferResult(
            from_account=updated_from,
            to_account=updated_to if same_owner else None,
            to_account_number=updated_to.account_number,
            to_owner_name=recipient.name if recipient else "Unknown",
        )

    @staticmethod
    def _validate_amount(amount: Decimal) -> None:
        if amount <= 0:
            raise InvalidAmountError
