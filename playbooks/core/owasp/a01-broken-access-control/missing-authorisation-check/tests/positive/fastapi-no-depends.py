# Fixture: FastAPI POST with no Depends(). Should flag.
from fastapi import APIRouter

router = APIRouter()

@router.post("/accounts/{account_id}")
async def update_account(account_id: int, body: dict):
    db.accounts.update(account_id, body)
    return {"updated": True}
