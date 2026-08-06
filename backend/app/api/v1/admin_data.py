import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import User
from app.services.data_transfer import export_bundle, import_bundle

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/export")
def export_data(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    """Download a full JSON dump of all domain data (admin only)."""
    bundle = export_bundle(db)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    filename = f"kostenpilot-backup-{stamp}.json"
    payload = json.dumps(bundle, ensure_ascii=False, indent=2).encode("utf-8")
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
def import_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Replace all domain data with the uploaded JSON backup (admin only)."""
    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Leere Datei")
    try:
        bundle = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Ungültige JSON-Datei") from exc

    try:
        counts = import_bundle(db, bundle)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import fehlgeschlagen: {exc}",
        ) from exc

    return {"status": "ok", "imported": counts}
