from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_list_accounts_returns_seed_data() -> None:
    response = client.get("/api/accounts")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_customer_and_admin_endpoints() -> None:
    customer_response = client.post(
        "/api/customers",
        json={
            "name": "Rohan Mehta",
            "email": "rohan@example.com",
            "password": "training-password",
            "address": "Delhi",
        },
    )
    assert customer_response.status_code == 201
    assert customer_response.json()["name"] == "Rohan Mehta"
    assert "password" not in customer_response.json()

    admin_response = client.post(
        "/api/admins",
        json={
            "name": "Second Admin",
            "email": "admin2@example.com",
            "password": "training-password",
            "address": "Delhi",
        },
    )
    assert admin_response.status_code == 201
    assert admin_response.json()["admin"] is True


def test_customer_view_update_and_admin_delete() -> None:
    create_response = client.post(
        "/api/customers",
        json={
            "name": "Delete Me",
            "email": "delete@example.com",
            "password": "training-password",
            "address": "Delhi",
        },
    )
    customer_id = create_response.json()["user_id"]

    get_response = client.get(f"/api/customers/{customer_id}")
    assert get_response.status_code == 200

    update_response = client.patch(
        f"/api/customers/{customer_id}",
        json={"address": "Bengaluru"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["address"] == "Bengaluru"

    assert client.delete(f"/api/customers/{customer_id}").status_code == 401
    assert client.delete(f"/api/customers/{customer_id}", headers={"X-User-Id": "1"}).status_code == 403
    assert client.delete(f"/api/customers/{customer_id}", headers={"X-User-Id": "3"}).status_code == 204


def test_customer_with_accounts_cannot_be_deleted() -> None:
    response = client.delete("/api/customers/1", headers={"X-User-Id": "3"})

    assert response.status_code == 409
    assert response.json() == {"detail": "Customer still owns accounts"}


def test_account_crud_flow() -> None:
    create_response = client.post(
        "/api/accounts",
        json={
            "account_number": "10000003",
            "owner_id": 1,
            "account_type": "checking",
        },
    )

    assert create_response.status_code == 201
    account_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/accounts/{account_id}",
        json={"account_type": "savings"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["account_type"] == "savings"

    delete_response = client.delete(f"/api/accounts/{account_id}")
    assert delete_response.status_code == 204
    assert client.get(f"/api/accounts/{account_id}").status_code == 404


def test_missing_account_returns_not_found() -> None:
    response = client.get("/api/accounts/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found"}


def test_account_requires_existing_customer() -> None:
    response = client.post(
        "/api/accounts",
        json={
            "account_number": "10000099",
            "owner_id": 999,
            "account_type": "checking",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}


def test_customer_accounts_endpoint() -> None:
    response = client.get("/api/customers/1/accounts")

    assert response.status_code == 200
    assert all(account["owner_id"] == 1 for account in response.json())


def test_customer_accounts_endpoint_rejects_unknown_customer() -> None:
    response = client.get("/api/customers/999/accounts")

    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}


def test_deposit_and_withdraw() -> None:
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


def test_withdraw_rejects_insufficient_funds() -> None:
    response = client.post(
        "/api/accounts/2/withdraw",
        json={"amount": "10000.00"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Insufficient funds"}
