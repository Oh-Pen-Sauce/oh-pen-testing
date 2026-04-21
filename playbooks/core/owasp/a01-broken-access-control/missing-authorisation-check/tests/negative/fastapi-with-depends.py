# Fixture: FastAPI with Depends(get_current_user). Must NOT flag.
from fastapi import APIRouter, Depends
from .auth import get_current_user

router = APIRouter()

@router.post("/accounts/{account_id}")
async def update_account(account_id: int, body: dict, user=Depends(get_current_user)):
    if user.id != account_id:
        raise HTTPException(403)
    db.accounts.update(account_id, body)
    return {"updated": True}
