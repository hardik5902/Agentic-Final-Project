from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings


def _build_engine():
    db_url = settings.DATABASE_URL
    if "?host=" in db_url:
        base_url, socket_path = db_url.split("?host=", 1)
        return create_engine(
            base_url,
            connect_args={"host": socket_path},
            pool_pre_ping=True,
        )
    return create_engine(db_url, pool_pre_ping=True)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
