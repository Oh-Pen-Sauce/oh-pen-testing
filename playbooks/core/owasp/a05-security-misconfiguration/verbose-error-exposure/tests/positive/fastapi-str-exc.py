# Fixture: FastAPI returning str(exc). Should flag.
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(Exception)
async def handler(request: Request, exc: Exception):
    return JSONResponse({"error": str(exc)}, status_code=500)
