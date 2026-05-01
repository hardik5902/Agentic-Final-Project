from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from schemas.auth import RegisterRequest, RegisterResponse, TokenResponse, UserOut, UpdateProfileRequest
from services import auth_service

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    user, token = auth_service.register(db, body.email, body.password, body.name, body.org_name)
    org = auth_service.get_org(db, user.org_id)
    return RegisterResponse(
        access_token=token,
        user=UserOut(
            id=user.id, email=user.email, name=user.name,
            role=user.role, org_id=user.org_id,
            org_name=org.name if org else None,
            subscription_tier=org.subscription_tier if org else None,
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    _, token = auth_service.login(db, form.username, form.password)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(
    user=Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    org = auth_service.get_org(db, user.org_id)
    return UserOut(
        id=user.id, email=user.email, name=user.name,
        role=user.role, org_id=user.org_id,
        org_name=org.name if org else None,
        subscription_tier=org.subscription_tier if org else None,
    )


@router.put("/me", response_model=UserOut)
def update_me(
    body: UpdateProfileRequest,
    user=Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name
    if body.email is not None:
        user.email = body.email
    db.commit()
    db.refresh(user)
    org = auth_service.get_org(db, user.org_id)
    return UserOut(
        id=user.id, email=user.email, name=user.name,
        role=user.role, org_id=user.org_id,
        org_name=org.name if org else None,
        subscription_tier=org.subscription_tier if org else None,
    )
