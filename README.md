# Banking API

A simple FastAPI banking service with in-memory dummy data. It currently supports CRUD operations for bank accounts and does not require a database or frontend.

## Run locally

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive documentation is at `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /api/accounts` - list accounts
- `GET /api/accounts/{account_id}` - get one account
- `POST /api/accounts` - create an account
- `PATCH /api/accounts/{account_id}` - update an account
- `DELETE /api/accounts/{account_id}` - delete an account
- `POST /api/accounts/{account_id}/deposit` - deposit money
- `POST /api/accounts/{account_id}/withdraw` - withdraw money

Run the tests with:

```powershell
pytest
```
