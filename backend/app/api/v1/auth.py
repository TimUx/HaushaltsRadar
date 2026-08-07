from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_remember_flag,
    get_subject,
    verify_password,
)
from app.db.session import get_db
from app.models import User
from app.schemas import (
    LoginRequest,
    PasswordResetAvailable,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    ProfileUpdate,
    RefreshRequest,
    TokenResponse,
    UserRead,
)
from app.services.email_validation import require_valid_email
from app.services.password_reset import (
    GENERIC_RESET_MESSAGE,
    consume_reset_token,
    create_reset_token,
    find_valid_reset_token,
    resolve_user_by_identifier,
    send_password_reset_email,
    smtp_password_reset_ready,
)
from app.services.reminders import get_or_create_smtp_settings

router = APIRouter(prefix="/auth", tags=["Auth"])


def _issue_tokens(user: User, *, remember: bool) -> TokenResponse:
    subject = str(user.id)
    return TokenResponse(
        access_token=create_access_token(subject, remember=remember),
        refresh_token=create_refresh_token(subject, remember=remember),
    )


def _authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Benutzername oder Passwort ungültig",
        )
    return user


def _user_from_subject(db: Session, subject: str) -> User | None:
    if subject.isdigit():
        user = db.get(User, int(subject))
        if user and user.is_active:
            return user
    return db.query(User).filter(User.username == subject, User.is_active.is_(True)).first()


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = _authenticate(db, form_data.username, form_data.password)
    # OAuth2 form has no remember_me; use short session for Swagger/docs clients
    return _issue_tokens(user, remember=False)


@router.post("/login/json", response_model=TokenResponse)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = _authenticate(db, payload.username, payload.password)
    return _issue_tokens(user, remember=bool(payload.remember_me))


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    subject = get_subject(payload.refresh_token, "refresh")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiger Refresh-Token")
    remember = get_remember_flag(payload.refresh_token, "refresh")
    user = _user_from_subject(db, subject)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzer nicht gefunden")
    return _issue_tokens(user, remember=remember)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    data = payload.model_dump(exclude_unset=True)
    changing_password = "new_password" in data and data["new_password"]

    if changing_password:
        current_password = data.get("current_password") or ""
        if not current_password or not verify_password(
            current_password, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aktuelles Passwort ist ungültig",
            )
        from app.core.security import hash_password

        current_user.password_hash = hash_password(data["new_password"])

    if "username" in data and data["username"] is not None:
        current_user.username = data["username"].strip()

    if "email" in data:
        try:
            current_user.email = require_valid_email(data["email"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Benutzername existiert bereits",
        ) from exc
    db.refresh(current_user)
    return current_user


@router.get("/password-reset/available", response_model=PasswordResetAvailable)
def password_reset_available(db: Session = Depends(get_db)) -> PasswordResetAvailable:
    smtp = get_or_create_smtp_settings(db)
    return PasswordResetAvailable(available=smtp_password_reset_ready(smtp))


@router.post("/password-reset/request", response_model=PasswordResetRequestResponse)
def password_reset_request(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> PasswordResetRequestResponse:
    smtp = get_or_create_smtp_settings(db)
    if not smtp_password_reset_ready(smtp):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Passwort-Zurücksetzen ist derzeit nicht verfügbar (SMTP nicht konfiguriert)",
        )

    user = resolve_user_by_identifier(db, payload.identifier)
    # Always return the same message to avoid user enumeration
    if user and user.is_active and user.email:
        try:
            raw = create_reset_token(db, user)
            send_password_reset_email(smtp, user=user, raw_token=raw)
        except Exception:
            # Do not leak send failures to callers
            pass

    return PasswordResetRequestResponse(detail=GENERIC_RESET_MESSAGE)


@router.post("/password-reset/confirm", response_model=PasswordResetRequestResponse)
def password_reset_confirm(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> PasswordResetRequestResponse:
    row = find_valid_reset_token(db, payload.token)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger oder abgelaufener Reset-Link",
        )
    user = row.user
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger oder abgelaufener Reset-Link",
        )
    consume_reset_token(db, row, payload.new_password)
    return PasswordResetRequestResponse(detail="Passwort wurde erfolgreich geändert")
