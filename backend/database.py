from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings


def _build_engine():
    db_url = settings.DATABASE_URL
    pool_kwargs = dict(
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )
    if "?host=" in db_url:
        base_url, socket_path = db_url.split("?host=", 1)
        return create_engine(
            base_url,
            connect_args={"host": socket_path},
            **pool_kwargs,
        )
    return create_engine(db_url, **pool_kwargs)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
