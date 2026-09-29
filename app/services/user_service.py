from ..models import Admin, AdminCreate, Customer, CustomerCreate, CustomerUpdate
from ..store import AccountStore
from ..user_store import UserStore


class CustomerNotFoundError(Exception):
    pass


class CustomerHasAccountsError(Exception):
    pass


class UserService:
    def __init__(self, store: UserStore, account_store: AccountStore) -> None:
        self._store = store
        self._account_store = account_store

    def list_customers(self) -> list[Customer]:
        return self._store.list_customers()

    def list_admins(self) -> list[Admin]:
        return self._store.list_admins()

    def create_customer(self, user_data: CustomerCreate) -> Customer:
        return self._store.create_customer(user_data)

    def create_admin(self, user_data: AdminCreate) -> Admin:
        return self._store.create_admin(user_data)

    def get_customer(self, customer_id: int) -> Customer:
        customer = self._store.get_customer(customer_id)
        if customer is None:
            raise CustomerNotFoundError
        return customer

    def update_customer(self, customer_id: int, user_data: CustomerUpdate) -> Customer:
        customer = self._store.update_customer(customer_id, user_data)
        if customer is None:
            raise CustomerNotFoundError
        return customer

    def delete_customer(self, customer_id: int) -> None:
        self.get_customer(customer_id)
        if self._account_store.list_for_owner(customer_id):
            raise CustomerHasAccountsError
        if not self._store.delete_customer(customer_id):
            raise CustomerNotFoundError
