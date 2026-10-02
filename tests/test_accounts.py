from datetime import datetime, timedelta, timezone
import os
from secrets import token_urlsafe

import pytest
from fastapi.testclient import TestClient
from pymongo.database import Database
import jwt
from bson.decimal128 import Decimal128


os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ["MONGODB_DATABASE"] = "banking_test"

from app import auth
from app.main import get_account_store
from app.mongo_store import MongoAccountStore, MongoUserStore, get_database
from app.models import AdminCreate, CustomerCreate
from app.mongo_store import get_user_store

from app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(app.state.limiter, "enabled", False)
    database: Database = get_database()
    database.client.drop_database(database.name)
    store = MongoAccountStore(database)
    user_store = MongoUserStore(database)
    user_store.create_admin(AdminCreate(
        name="Test Admin", email="test-admin@example.com", password="test-password", address="Test address",
    ))
    user_store.create_customer(CustomerCreate(
        name="Test Customer", email="customer@example.com", password="test-password", address="Test address",
    ))
    previous_overrides = app.dependency_overrides.copy()
    previous_sessions = auth.sessions.copy()
    app.dependency_overrides[get_account_store] = lambda: store
    app.dependency_overrides[get_user_store] = lambda: user_store
    auth.sessions.clear()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        auth.sessions.clear()
        auth.sessions.update(previous_sessions)


def login_headers(client, email="test-admin@example.com", password="test-password", *, admin=True):
    endpoint = "/api/login/admin" if admin else "/api/login/customer"
    response = client.post(endpoint, json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_list_accounts_returns_seed_data(client) -> None:
    response = client.get("/api/accounts", headers=login_headers(client))

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_account_crud_flow(client) -> None:
    customer_headers = login_headers(client, "customer@example.com", admin=False)
    admin_headers = login_headers(client)
    create_response = client.post(
        "/api/accounts",
        json={
            "account_type": "checking",
        },
        headers=customer_headers,
    )

    assert create_response.status_code == 201
    assert create_response.json()["owner_id"] == 4
    account_number = create_response.json()["account_number"]
    assert account_number.isdigit() and len(account_number) == 12
    assert account_number not in {"10000001", "10000002"}
    account_id = create_response.json()["id"]

    # Customers can no longer edit an account's type directly; only admins can.
    assert client.patch(
        f"/api/accounts/{account_id}",
        json={"account_type": "savings"},
        headers=customer_headers,
    ).status_code == 403

    update_response = client.patch(
        f"/api/accounts/{account_id}",
        json={"account_type": "savings"},
        headers=admin_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["account_type"] == "savings"

    delete_response = client.delete(f"/api/accounts/{account_id}", headers=admin_headers)
    assert delete_response.status_code == 204
    assert client.get(f"/api/accounts/{account_id}", headers=admin_headers).status_code == 404


def test_missing_account_returns_not_found(client) -> None:
    response = client.get("/api/accounts/999", headers=login_headers(client))

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found"}


def test_deposit_and_withdraw(client) -> None:
    client.headers.update(login_headers(client, "aarav@example.com", "password", admin=False))
    deposit_response = client.post(
        "/api/accounts/1/deposit",
        json={"amount": "100.00"},
    )
    assert deposit_response.status_code == 200
    assert deposit_response.json()["balance"] == "1350.00"

    withdraw_response = client.post(
        "/api/accounts/1/withdraw",
        json={"amount": "50.00"},
    )
    assert withdraw_response.status_code == 200
    assert withdraw_response.json()["balance"] == "1300.00"


def test_withdraw_rejects_insufficient_funds(client) -> None:
    client.headers.update(login_headers(client, "maya@example.com", "123", admin=False))
    response = client.post(
        "/api/accounts/2/withdraw",
        json={"amount": "10000.00"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Insufficient funds"}
    assert client.get("/api/me/transactions").json() == []


def test_my_transactions_lists_own_history_newest_first(client) -> None:
    aarav = login_headers(client, "aarav@example.com", "password", admin=False)
    maya = login_headers(client, "maya@example.com", "123", admin=False)
    assert client.get("/api/me/transactions", headers=aarav).json() == []

    client.post("/api/accounts/1/deposit", json={"amount": "100.00"}, headers=aarav)
    client.post("/api/accounts/1/withdraw", json={"amount": "25.50"}, headers=aarav)
    client.post("/api/accounts/2/deposit", json={"amount": "1.00"}, headers=maya)

    response = client.get("/api/me/transactions", headers=aarav)
    assert response.status_code == 200
    history = response.json()
    assert [(t["type"], t["amount"], t["balance_after"]) for t in history] == [
        ("withdraw", "25.50", "1324.50"),
        ("deposit", "100.00", "1350.00"),
    ]
    assert all(t["account_id"] == 1 and t["account_number"] == "10000001" for t in history)
    assert all(t["created_at"] for t in history)

    maya_history = client.get("/api/me/transactions", headers=maya).json()
    assert [(t["type"], t["account_id"]) for t in maya_history] == [("deposit", 2)]


def test_my_transactions_requires_customer(client) -> None:
    assert client.get("/api/me/transactions").status_code == 401
    response = client.get("/api/me/transactions", headers=login_headers(client))
    assert response.status_code == 403
    assert response.json() == {"detail": "Only customers have transactions"}


@pytest.mark.parametrize("method,path,payload", [
    ("DELETE", "/api/accounts/1", None),
    ("PATCH", "/api/accounts/1", {"balance": "0.00"}),
    ("POST", "/api/accounts/1/deposit", {"amount": "10.00"}),
    ("POST", "/api/accounts/1/withdraw", {"amount": "10.00"}),
])
def test_balance_mutations_and_deletion_require_admin(client, method, path, payload):
    admin_headers = login_headers(client)
    before = client.get("/api/accounts/1", headers=admin_headers).json()
    response = client.request(method, path, json=payload)
    assert response.status_code == 401
    headers = login_headers(client, "customer@example.com", admin=False)
    response = client.request(method, path, json=payload, headers=headers)
    assert response.status_code == 403
    assert client.get("/api/accounts/1", headers=admin_headers).json() == before


def test_admin_can_set_balance_to_zero(client):
    response = client.patch("/api/accounts/1", json={"balance": "0.00"}, headers=login_headers(client))
    assert response.status_code == 200
    assert response.json()["balance"] == "0.00"


@pytest.mark.parametrize("balance", [None, "-1.00", "1.001"])
def test_invalid_balance_does_not_change_account(client, balance):
    headers = login_headers(client)
    before = client.get("/api/accounts/1", headers=headers).json()
    response = client.patch("/api/accounts/1", json={"balance": balance}, headers=headers)
    assert response.status_code == 422
    assert client.get("/api/accounts/1", headers=headers).json() == before


def test_customer_cannot_update_account_type(client):
    response = client.patch(
        "/api/accounts/1",
        json={"account_type": "savings"},
        headers=login_headers(client, "aarav@example.com", "password", admin=False),
    )
    assert response.status_code == 403


@pytest.mark.parametrize("path", ["/api/accounts", "/api/customers", "/api/customers/1", "/api/admins"])
def test_administrative_reads_require_admin(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers=login_headers(client, "aarav@example.com", "password", admin=False)).status_code == 403
    assert client.get(path, headers=login_headers(client)).status_code == 200


def test_account_details_and_updates_require_admin(client):
    owner = login_headers(client, "aarav@example.com", "password", admin=False)
    other_customer = login_headers(client, "customer@example.com", admin=False)
    admin = login_headers(client)

    assert client.get("/api/accounts/1").status_code == 401
    assert client.get("/api/accounts/1", headers=owner).status_code == 403
    assert client.get("/api/accounts/1", headers=other_customer).status_code == 403
    assert client.get("/api/accounts/1", headers=admin).status_code == 200
    assert client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=owner).status_code == 403
    assert client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=other_customer).status_code == 403
    assert client.patch("/api/accounts/1", json={"balance": "0.00"}, headers=owner).status_code == 403
    assert client.get("/api/accounts/1", headers=admin).json()["balance"] == "1250.00"


@pytest.mark.parametrize("endpoint", ["/api/login/admin", "/api/login/customer"])
@pytest.mark.parametrize("email,password", [
    ("test-admin@example.com", "wrong-password"),
    ("missing@example.com", "test-password"),
])
def test_invalid_login(client, endpoint, email, password):
    response = client.post(endpoint, json={"email": email, "password": password})
    assert response.status_code == 401
    assert not auth.sessions


def test_role_mismatched_login_rejected(client):
    assert client.post("/api/login/customer", json={"email": "test-admin@example.com", "password": "test-password"}).status_code == 401
    assert client.post("/api/login/admin", json={"email": "customer@example.com", "password": "test-password"}).status_code == 401
    assert not auth.sessions


@pytest.mark.parametrize("failure", ["logged_out", "expired", "missing_user", "wrong_signature"])
def test_invalid_jwt_rejected(client, failure):
    headers = login_headers(client)
    original_token = headers["Authorization"].split(" ", 1)[1]

    payload = jwt.decode(original_token, auth.JWT_SECRET, algorithms=[auth.JWT_ALGORITHM])

    session_id = payload["sid"]

    if failure == "expired":
        payload["exp"] = (datetime.now(timezone.utc) - timedelta(minutes=1))

    elif failure == "missing_user":
        payload["sub"] = "999999"
        auth.sessions[session_id] = auth.LoginSession(user_id=999999, last_activity=datetime.now(timezone.utc),)

    elif failure == "logged_out":
        auth.sessions.pop(session_id)

    signing_key = (
        "different-test-signing-secret-at-least-32-bytes"
        if failure == "wrong_signature"
        else auth.JWT_SECRET
    )

    token = jwt.encode(payload, signing_key, algorithm=auth.JWT_ALGORITHM)

    response = client.delete("/api/accounts/1", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401

    assert client.get("/api/accounts/1", headers=login_headers(client)).status_code == 200

def test_login_returns_signed_jwt(client):
    response = client.post("/api/login/admin", json={"email": "test-admin@example.com", "password": "test-password"})

    assert response.status_code == 200

    body = response.json()
    assert body["token_type"] == "bearer"

    payload = jwt.decode(body["access_token"], auth.JWT_SECRET, algorithms=[auth.JWT_ALGORITHM],
        options={
            "require": ["sub", "username", "role", "sid", "exp", "jti"],
        },
    )

    assert payload["username"] == "test-admin@example.com"
    assert payload["role"] == "admin"
    assert int(payload["sub"]) > 0
    assert payload["exp"] > datetime.now(timezone.utc).timestamp()
    assert isinstance(payload["jti"], str)
    assert payload["jti"]

def test_creation_cannot_set_balance(client):
    headers = login_headers(client, "customer@example.com", admin=False)
    response = client.post("/api/accounts", json={"account_type": "checking", "balance": "1000.00"}, headers=headers)
    assert response.status_code == 422


def test_creation_cannot_set_account_number(client):
    headers = login_headers(client, "customer@example.com", admin=False)
    response = client.post("/api/accounts", json={"account_type": "checking", "account_number": "12345678"}, headers=headers)
    assert response.status_code == 422


def test_account_number_generation_retries_existing_number(client, monkeypatch):
    from app import mongo_store

    admin_headers = login_headers(client)
    assert client.get("/api/accounts", headers=admin_headers).status_code == 200

    database = get_database()
    result = database["accounts"].update_one({"id": 1}, {"$set": {"account_number": "100000000001"}})
    assert result.matched_count == 1

    customer_headers = login_headers(client, "customer@example.com", admin=False)

    candidates = iter([1, 9])
    monkeypatch.setattr(mongo_store.secrets, "randbelow", lambda _limit: next(candidates))

    response = client.post("/api/accounts", json={
        "account_type": "checking",
    }, headers=customer_headers)

    assert response.status_code == 201
    assert response.json()["account_number"] == "100000000009"
    assert len(client.get("/api/accounts", headers=admin_headers).json()) == 3


@pytest.mark.parametrize("operation", ["deposit", "withdraw"])
def test_transaction_validation_and_missing_account(client, operation):
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(f"/api/accounts/1/{operation}", json={"amount": "0"}, headers=headers)
    assert response.status_code == 422
    response = client.post(f"/api/accounts/999/{operation}", json={"amount": "1.00"}, headers=headers)
    assert response.status_code == 404


def test_create_customer_requires_admin(client):
    payload = {
        "name": "New Customer", "email": "blocked@example.com", "password": "test-password", "address": "Delhi",
    }
    assert client.post("/api/customers", json=payload).status_code == 401
    customer_headers = login_headers(client, "customer@example.com", admin=False)
    assert client.post("/api/customers", json=payload, headers=customer_headers).status_code == 403


def test_admin_created_customer_can_login_and_own_account(client):
    response = client.post("/api/customers", json={
        "name": "New Customer", "email": "new@example.com", "password": "test-password", "address": "Delhi",
    }, headers=login_headers(client))
    assert response.status_code == 201
    customer = response.json()
    assert "password" not in customer
    assert "password_hash" not in customer
    assert "admin" not in customer
    headers = login_headers(client, "new@example.com", admin=False)
    response = client.post("/api/accounts", json={
        "account_type": "checking",
    }, headers=headers)
    assert response.status_code == 201
    assert response.json()["owner_id"] == customer["user_id"]
    assert response.json()["account_number"].isdigit()
    assert len(response.json()["account_number"]) == 12
    assert response.json()["balance"] == "0.00"
    account_id = response.json()["id"]
    assert client.delete(f"/api/accounts/{account_id}", headers=headers).status_code == 403
    assert client.get(f"/api/accounts/{account_id}", headers=headers).status_code == 403
    assert client.get(f"/api/accounts/{account_id}", headers=login_headers(client)).status_code == 200
    assert any(user["user_id"] == customer["user_id"] for user in client.get("/api/customers", headers=login_headers(client)).json())


def test_only_admin_can_create_admin_and_new_admin_can_login(client):
    payload = {"name": "Second Admin", "email": "second-admin@example.com", "password": "test-password", "address": "Delhi"}
    assert client.post("/api/admins", json=payload).status_code == 401
    customer_headers = login_headers(client, "customer@example.com", admin=False)
    assert client.post("/api/admins", json=payload, headers=customer_headers).status_code == 403
    response = client.post("/api/admins", json=payload, headers=login_headers(client))
    assert response.status_code == 201
    assert response.json()["admin"] is True
    assert "password" not in response.json()
    new_admin_headers = login_headers(client, "second-admin@example.com")
    assert client.delete("/api/accounts/1", headers=new_admin_headers).status_code == 204
    assert any(user["user_id"] == response.json()["user_id"] for user in client.get("/api/admins", headers=new_admin_headers).json())


def test_account_creation_requires_customer_login(client):
    assert client.post("/api/accounts", json={"account_type": "checking"}).status_code == 401
    response = client.post("/api/accounts", json={
        "account_type": "checking",
    }, headers=login_headers(client))
    assert response.status_code == 403


def test_account_creation_rejects_client_selected_owner(client):
    response = client.post("/api/accounts", json={
        "owner_id": 1, "account_type": "checking",
    }, headers=login_headers(client, "customer@example.com", admin=False))
    assert response.status_code == 422


def test_seed_users_without_passwords_cannot_login(client):
    for email, endpoint in [
        ("aarav@example.com", "/api/login/customer"),
        ("maya@example.com", "/api/login/customer"),
    ]:
        response = client.post(endpoint, json={"email": email, "password": "test-password"})
        assert response.status_code == 401


def test_admin_can_view_update_and_delete_customer(client) -> None:
    create_response = client.post(
        "/api/customers",
        json={
            "name": "Delete Me",
            "email": "delete@example.com",
            "password": "training-password",
            "address": "Delhi",
        },
        headers=login_headers(client),
    )
    assert create_response.status_code == 201
    customer_id = create_response.json()["user_id"]
    get_response = client.get(f"/api/customers/{customer_id}", headers=login_headers(client))
    assert get_response.status_code == 200

    update_response = client.patch(
        f"/api/customers/{customer_id}",
        json={"address": "Bengaluru"},
        headers=login_headers(client),
    )
    assert update_response.status_code == 200
    assert update_response.json()["address"] == "Bengaluru"

    # Customers cannot update another profile through the admin endpoint, even their own.
    assert client.patch(
        f"/api/customers/{customer_id}",
        json={"address": "Mumbai"},
        headers=login_headers(client, "delete@example.com", "training-password", admin=False),
    ).status_code == 403

    assert client.delete(f"/api/customers/{customer_id}").status_code == 401
    assert client.delete(f"/api/customers/{customer_id}", headers=login_headers(client, "customer@example.com", admin=False)).status_code == 403
    assert client.delete(f"/api/customers/{customer_id}", headers=login_headers(client)).status_code == 204


def test_customer_with_accounts_cannot_be_deleted(client) -> None:
    response = client.delete("/api/customers/1", headers=login_headers(client))

    assert response.status_code == 409
    assert response.json() == {"detail": "Customer still owns accounts"}


def test_customer_accounts_endpoint(client) -> None:
    response = client.get("/api/customers/1/accounts", headers=login_headers(client))

    assert response.status_code == 200
    assert all(account["owner_id"] == 1 for account in response.json())


def test_customer_accounts_endpoint_rejects_unknown_customer(client) -> None:
    response = client.get("/api/customers/999/accounts", headers=login_headers(client))

    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}


@pytest.mark.parametrize("email,password", [("aarav@example.com", "password"), ("maya@example.com", "123")])
def test_customer_accounts_endpoint_rejects_customers(client, email, password) -> None:
    # The owner of account 1 is "aarav@example.com"; neither customer can use this admin endpoint.
    headers = login_headers(client, email, password, admin=False)
    response = client.get("/api/customers/1/accounts", headers=headers)

    assert response.status_code == 403
    assert response.json() == {"detail": "Administrator access required"}


def test_customer_accounts_endpoint_requires_authentication(client) -> None:
    response = client.get("/api/customers/1/accounts")

    assert response.status_code == 401


def test_transfer_to_another_customer(client) -> None:
    aarav = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "10000002", "amount": "100.00"},
        headers=aarav,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_account"]["id"] == 1
    assert body["from_account"]["balance"] == "1150.00"
    assert body["to_account"] is None
    assert body["to_account_number"] == "10000002"
    assert body["to_owner_name"] == "Maya Patel"

    admin = login_headers(client)
    assert client.get("/api/accounts/2", headers=admin).json()["balance"] == "4900.50"

    maya = login_headers(client, "maya@example.com", "123", admin=False)
    history = client.get("/api/me/transactions", headers=maya).json()
    assert history[0]["type"] == "transfer_in"
    assert history[0]["amount"] == "100.00"
    assert history[0]["counterparty_account_number"] == "10000001"
    assert history[0]["counterparty_name"] == "Aarav Sharma"

    sender_history = client.get("/api/me/transactions", headers=aarav).json()
    assert sender_history[0]["type"] == "transfer_out"
    assert sender_history[0]["counterparty_account_number"] == "10000002"
    assert sender_history[0]["counterparty_name"] == "Maya Patel"

    admin_history = client.get("/api/transactions", headers=admin).json()
    assert {entry["counterparty_name"] for entry in admin_history} == {"Aarav Sharma", "Maya Patel"}

    database = get_database()
    database["accounts"].delete_one({"id": 2})
    assert client.get("/api/me/transactions", headers=aarav).json()[0]["counterparty_name"] == "Maya Patel"
    database["accounts"].insert_one({
        "id": 2, "account_number": "10000002", "owner_id": 2, "account_type": "savings",
        "balance": Decimal128("4900.50"),
    })
    database["transactions"].update_many({}, {"$unset": {"counterparty_name": ""}})
    assert client.get("/api/me/transactions", headers=aarav).json()[0]["counterparty_name"] == "Maya Patel"
    assert client.get("/api/transactions", headers=admin).json()[0]["counterparty_name"] == "Aarav Sharma"

    database["accounts"].delete_one({"id": 2})
    assert client.get("/api/me/transactions", headers=aarav).json()[0]["counterparty_name"] is None


def test_transfer_between_own_accounts(client) -> None:
    aarav = login_headers(client, "aarav@example.com", "password", admin=False)
    second_account = client.post("/api/accounts", json={"account_type": "savings"}, headers=aarav).json()

    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": second_account["account_number"], "amount": "50.00"},
        headers=aarav,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_account"]["balance"] == "1200.00"
    assert body["to_account"]["id"] == second_account["id"]
    assert body["to_account"]["balance"] == "50.00"


def test_transfer_rejects_insufficient_funds(client) -> None:
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "10000002", "amount": "10000.00"},
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Insufficient funds"}


def test_transfer_rejects_unknown_recipient(client) -> None:
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "999999999999", "amount": "10.00"},
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Recipient account not found"}


def test_transfer_rejects_same_account(client) -> None:
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "10000001", "amount": "10.00"},
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Cannot transfer to the same account"}


def test_transfer_requires_ownership_of_source_account(client) -> None:
    headers = login_headers(client, "maya@example.com", "123", admin=False)
    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "10000002", "amount": "10.00"},
        headers=headers,
    )

    assert response.status_code == 403


def test_transfer_requires_customer_login(client) -> None:
    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "10000002", "amount": "10.00"},
    )
    assert response.status_code == 401

    response = client.post(
        "/api/transfers",
        json={"from_account_id": 1, "to_account_number": "10000002", "amount": "10.00"},
        headers=login_headers(client),
    )
    assert response.status_code == 403


def test_customer_delete_rejects_unverified_user_id_header(client):
    response = client.delete("/api/customers/4", headers={"X-User-Id": "3"})
    assert response.status_code == 401
    assert client.get("/api/customers/4", headers=login_headers(client)).status_code == 200


def test_customer_password_update_works_with_login(client):
    response = client.patch(
        "/api/me",
        json={"password": "updated-password"},
        headers=login_headers(client, "customer@example.com", admin=False),
    )
    assert response.status_code == 200
    assert "password" not in response.json()
    assert client.post("/api/login/customer", json={
        "email": "customer@example.com", "password": "test-password",
    }).status_code == 401
    response = client.post("/api/login/customer", json={
        "email": "customer@example.com", "password": "updated-password",
    })
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=headers).status_code == 403
    assert client.delete("/api/accounts/1", headers=headers).status_code == 403


def test_deleted_customer_cannot_reuse_session(client):
    headers = login_headers(client, "customer@example.com", admin=False)
    assert client.delete("/api/customers/4", headers=login_headers(client)).status_code == 204
    assert client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=headers).status_code == 401
    assert client.post("/api/login/customer", json={
        "email": "customer@example.com", "password": "test-password",
    }).status_code == 401

def test_signup_customer_can_login_but_cannot_create_admin(client):
    signup_data = {
        "name": "Signup Customer",
        "email": "signup@example.com",
        "password": "signup-test-password",
        "address": "Delhi",
    }

    response = client.post("/api/signup", json=signup_data)

    assert response.status_code == 201
    customer = response.json()
    assert customer["email"] == signup_data["email"]
    assert "password" not in customer
    assert "password_hash" not in customer
    assert "admin" not in customer

    headers = login_headers(
        client,
        email=signup_data["email"],
        password=signup_data["password"],
        admin=False,
    )

    response = client.patch(
        "/api/me",
        json={"address": "Mumbai"},
        headers=headers,
    )
    assert response.status_code == 200

    # Customers cannot manage profiles via the admin-only customers endpoint.
    response = client.patch(
        f"/api/customers/{customer['user_id']}",
        json={"address": "Pune"},
        headers=headers,
    )
    assert response.status_code == 403

    response = client.post(
        "/api/admins",
        json={
            "name": "Attempted Admin",
            "email": "attempted-admin@example.com",
            "password": "another-test-password",
            "address": "Delhi",
        },
        headers=headers,
    )
    assert response.status_code == 403

def test_signup_rejects_duplicate_email(client):
    data = {
        "name": "Signup Customer",
        "email": "unique@example.com",
        "password": "signup-test-password",
        "address": "Delhi",
    }

    assert client.post("/api/signup", json=data).status_code == 201

    data["email"] = "UNIQUE@example.com"
    response = client.post("/api/signup", json=data)

    assert response.status_code == 409

def test_logout_invalidates_only_current_session(client):
    first_session = login_headers(client)
    second_session = login_headers(client)

    response = client.post("/api/logout", headers=first_session)
    assert response.status_code == 204

    # The logged-out token can no longer authorize an update.
    response = client.patch(
        "/api/accounts/1",
        json={"account_type": "savings"},
        headers=first_session,
    )
    assert response.status_code == 401

    # Another login session still works.
    response = client.patch(
        "/api/accounts/1",
        json={"account_type": "savings"},
        headers=second_session,
    )
    assert response.status_code == 200

    # Logging out the same token again is harmless.
    response = client.post("/api/logout", headers=first_session)
    assert response.status_code == 204


def test_logout_requires_bearer_credentials(client):
    response = client.post("/api/logout")
    assert response.status_code == 401


@pytest.mark.parametrize("method", ["GET", "PATCH", "DELETE"])
def test_missing_customer_returns_not_found(client, method):
    response = client.request(method, "/api/customers/999", headers=login_headers(client),
                              json={"address": "Delhi"} if method == "PATCH" else None)
    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}


def test_me_requires_authentication(client):
    assert client.get("/api/me").status_code == 401


def test_me_returns_own_profile_for_customer(client):
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.get("/api/me", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body == {"user_id": 1, "name": "Aarav Sharma", "email": "aarav@example.com", "address": "Pune", "role": "customer"}


def test_me_returns_own_profile_for_admin(client):
    response = client.get("/api/me", headers=login_headers(client))

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["email"] == "test-admin@example.com"


def test_update_me_changes_own_profile_without_customer_id(client):
    headers = login_headers(client, "customer@example.com", admin=False)
    response = client.patch("/api/me", json={"address": "New Address"}, headers=headers)

    assert response.status_code == 200
    assert response.json()["address"] == "New Address"
    assert client.get("/api/customers/4", headers=login_headers(client)).json()["address"] == "New Address"


def test_update_me_rejects_admin(client):
    response = client.patch("/api/me", json={"address": "New Address"}, headers=login_headers(client))

    assert response.status_code == 403
    assert response.json() == {"detail": "Only customers can update their own profile here"}


def test_my_accounts_lists_only_own_accounts_without_customer_id(client):
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.get("/api/me/accounts", headers=headers)

    assert response.status_code == 200
    assert all(account["owner_id"] == 1 for account in response.json())
    assert len(response.json()) == 1


def test_my_accounts_requires_authentication(client):
    assert client.get("/api/me/accounts").status_code == 401


def test_my_accounts_rejects_admin(client):
    response = client.get("/api/me/accounts", headers=login_headers(client))

    assert response.status_code == 403
    assert response.json() == {"detail": "Only customers have accounts"}


def test_login_rate_limit(client, monkeypatch):
    limiter = app.state.limiter
    monkeypatch.setattr(limiter, "enabled", True)
    limiter.reset()

    credentials = {"email": "unknown@example.com", "password": "wrong-password"}

    try:
        for _ in range(5):
            response = client.post("/api/login/customer", json=credentials)
            assert response.status_code == 401

        response = client.post("/api/login/customer", json=credentials)
        assert response.status_code == 429
    finally:
        limiter.reset()


def test_signup_rate_limit(client, monkeypatch):
    limiter = app.state.limiter
    monkeypatch.setattr(limiter, "enabled", True)
    limiter.reset()

    try:
        for index in range(4):
            signup_data = {
                "name": "Signup Customer",
                "email": f"signup-{index}@example.com",
                "password": "Signup-test-password1!",
                "address": "Delhi",
            }

            response = client.post("/api/signup", json=signup_data)

            expected_status = 201 if index < 3 else 429
            assert response.status_code == expected_status, response.text
    finally:
        limiter.reset()

@pytest.mark.parametrize("operation", ["deposit", "withdraw"])
def test_customer_can_transact_on_own_account(client, operation):
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(f"/api/accounts/1/{operation}", json={"amount": "10.00"}, headers=headers)
    assert response.status_code == 200


@pytest.mark.parametrize("operation", ["deposit", "withdraw"])
def test_customer_cannot_transact_on_other_customer_account(client, operation):
    headers = login_headers(client, "aarav@example.com", "password", admin=False)
    response = client.post(f"/api/accounts/2/{operation}", json={"amount": "10.00"}, headers=headers)

    assert response.status_code == 403
    assert response.json() == {"detail": "You can only manage your own account"}


@pytest.mark.parametrize("operation", ["deposit", "withdraw"])
def test_admin_cannot_transact_on_any_account(client, operation):
    response = client.post(f"/api/accounts/1/{operation}", json={"amount": "10.00"}, headers=login_headers(client))
    assert response.status_code == 403
    assert response.json() == {"detail": "Only customers can deposit or withdraw funds"}


@pytest.mark.parametrize("operation", ["deposit", "withdraw"])
def test_transact_requires_authentication(client, operation):
    response = client.post(f"/api/accounts/1/{operation}", json={"amount": "10.00"})
    assert response.status_code == 401


def test_admin_can_create_account_for_customer_by_email(client):
    response = client.post(
        "/api/admin/accounts",
        json={"owner_email": "Aarav@Example.com", "account_type": "savings"},
        headers=login_headers(client),
    )
    assert response.status_code == 201
    assert response.json()["owner_id"] == 1
    assert response.json()["account_type"] == "savings"
    assert response.json()["balance"] == "0.00"


def test_admin_cannot_create_account_for_admin(client):
    response = client.post(
        "/api/admin/accounts",
        json={"owner_email": "test-admin@example.com", "account_type": "checking"},
        headers=login_headers(client),
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Accounts cannot be created for admins"}


def test_admin_create_account_unknown_email(client):
    response = client.post(
        "/api/admin/accounts",
        json={"owner_email": "nobody@example.com", "account_type": "checking"},
        headers=login_headers(client),
    )
    assert response.status_code == 404


def test_admin_create_account_requires_admin(client):
    payload = {"owner_email": "aarav@example.com", "account_type": "checking"}
    assert client.post("/api/admin/accounts", json=payload).status_code == 401
    customer_headers = login_headers(client, "aarav@example.com", "password", admin=False)
    assert client.post("/api/admin/accounts", json=payload, headers=customer_headers).status_code == 403


def test_admin_lists_all_transactions(client):
    aarav = login_headers(client, "aarav@example.com", "password", admin=False)
    maya = login_headers(client, "maya@example.com", "123", admin=False)
    assert client.post("/api/accounts/1/deposit", json={"amount": "5.00"}, headers=aarav).status_code == 200
    assert client.post("/api/accounts/2/withdraw", json={"amount": "3.00"}, headers=maya).status_code == 200

    response = client.get("/api/transactions", headers=login_headers(client))
    assert response.status_code == 200
    assert {t["owner_id"] for t in response.json()} == {1, 2}

    assert client.get("/api/transactions").status_code == 401
    assert client.get("/api/transactions", headers=aarav).status_code == 403

def decode_test_token(token):
    return jwt.decode(
        token,
        auth.JWT_SECRET,
        algorithms=[auth.JWT_ALGORITHM],
    )


def test_refresh_extends_token_and_logout_revokes_session(client):
    headers = login_headers(client)
    original_token = headers["Authorization"].split(" ", 1)[1]
    original_payload = decode_test_token(original_token)

    original_payload["exp"] = (
        datetime.now(timezone.utc) + timedelta(minutes=1)
    )
    short_token = jwt.encode(
        original_payload,
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM,
    )
    short_headers = {"Authorization": f"Bearer {short_token}"}

    response = client.post(
        "/api/auth/refresh",
        headers=short_headers,
    )

    assert response.status_code == 200

    renewed_token = response.json()["access_token"]
    renewed_payload = decode_test_token(renewed_token)

    assert renewed_payload["sid"] == original_payload["sid"]
    assert renewed_payload["jti"] != original_payload["jti"]
    assert renewed_payload["exp"] > decode_test_token(short_token)["exp"]

    renewed_headers = {
        "Authorization": f"Bearer {renewed_token}",
    }

    assert client.get(
        "/api/me", headers=renewed_headers
    ).status_code == 200

    assert client.post(
        "/api/logout", headers=renewed_headers
    ).status_code == 204

    for token_headers in (short_headers, renewed_headers):
        assert client.get(
            "/api/me", headers=token_headers
        ).status_code == 401


def test_idle_session_cannot_refresh(client):
    headers = login_headers(client)
    token = headers["Authorization"].split(" ", 1)[1]
    payload = decode_test_token(token)

    auth.sessions[payload["sid"]].last_activity = (
        datetime.now(timezone.utc)
        - auth.IDLE_TIMEOUT
        - timedelta(seconds=1)
    )

    response = client.post("/api/auth/refresh", headers=headers)

    assert response.status_code == 401
    assert payload["sid"] not in auth.sessions


def test_expired_token_cannot_refresh(client):
    headers = login_headers(client)
    token = headers["Authorization"].split(" ", 1)[1]
    payload = decode_test_token(token)

    payload["exp"] = (
        datetime.now(timezone.utc) - timedelta(seconds=1)
    )

    expired_token = jwt.encode(
        payload,
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM,
    )

    response = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


def test_refresh_requires_authentication(client):
    response = client.post("/api/auth/refresh")
    assert response.status_code == 401