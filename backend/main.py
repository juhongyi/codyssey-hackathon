from contextlib import asynccontextmanager
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from models.database import connection, initialize
from routers.api import router


@asynccontextmanager
async def lifespan(app):
    await initialize()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(router)


@app.middleware("http")
async def anonymous_session(request: Request, call_next):
    cookie = request.cookies.get("odyssey_session")
    try:
        session = UUID(cookie) if cookie else uuid4()
        fresh = cookie is None
    except ValueError:
        session, fresh = uuid4(), True
    request.state.session_id = session
    response = await call_next(request)
    if fresh:
        response.set_cookie(
            "odyssey_session",
            str(session),
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 365,
            path="/",
        )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(status_code=400, content={"detail": "Invalid request"})


@app.get("/health")
async def health():
    async with connection() as conn:
        await conn.execute("SELECT 1")
    return {"status": "ok"}
