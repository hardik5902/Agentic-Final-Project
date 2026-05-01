from pydantic import BaseModel, EmailStr, UUID4


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    org_name: str


class LoginRequest(BaseModel):
    username: str  # OAuth2 form field name
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: UUID4
    email: str
    name: str | None
    role: str
    org_id: UUID4
    org_name: str | None = None
    subscription_tier: str | None = None

    class Config:
        from_attributes = True


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
