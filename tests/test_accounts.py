from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_list_accounts_returns_seed_data() -> None:
    response = client.get("/api/accounts")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_account_crud_flow() -> None:
    create_response = client.post(
        "/api/accounts",
        json={
            "account_number": "10000003",
            "owner_name": "Rohan Mehta",
            "account_type": "checking",
            "balance": "900.00",
        },
    )

    assert create_response.status_code == 201
    account_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/accounts/{account_id}",
        json={"balance": "1100.00"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["balance"] == "1100.00"

    delete_response = client.delete(f"/api/accounts/{account_id}")
    assert delete_response.status_code == 204
    assert client.get(f"/api/accounts/{account_id}").status_code == 404


def test_missing_account_returns_not_found() -> None:
    response = client.get("/api/accounts/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found"}
