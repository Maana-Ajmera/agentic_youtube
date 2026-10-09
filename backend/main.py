from fastapi import FastAPI , Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "AI Study Agent API is running"}

@app.get("/db-check")
def db_check(db: Annotated[Session, Depends(get_db)]):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}