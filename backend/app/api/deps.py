from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import get_subject
from app.db.session import get_db
from app.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    subject = get_subject(token, "access")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültige oder abgelaufene Anmeldung",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user: User | None = None
    if subject.isdigit():
        user = db.get(User, int(subject))
    if user is None:
        user = db.query(User).filter(User.username == subject).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Benutzer nicht gefunden oder deaktiviert",
        )
    return user


def require_editor(user: User = Depends(get_current_user)) -> User:
    """Admin or standard user may manage domain data."""
    if user.role not in (UserRole.admin, UserRole.user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung für Verwaltungsfunktionen",
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Only admins may manage users."""
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Administratoren dürfen Benutzer verwalten",
        )
    return user
