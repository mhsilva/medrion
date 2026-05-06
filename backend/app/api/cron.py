"""
Cron-style endpoints. Protected by a shared CRON_SECRET via the
X-Cron-Secret header. Schedule on Railway Cron (or any external scheduler):

  GET /cron/trial-reminders   → daily, sends day-6 and day-7 trial emails
  GET /cron/weekly-backup     → weekly Sunday 03:00 UTC, exports active CSV
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, status

from app.config import settings
from app.database import db
from app.services.email_service import _send

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cron", tags=["cron"])


def _ensure_secret(provided: str) -> None:
    if not settings.CRON_SECRET or provided != settings.CRON_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")


@router.get("/trial-reminders")
async def trial_reminders(x_cron_secret: str = Header(default="")) -> dict:
    _ensure_secret(x_cron_secret)
    now = datetime.now(timezone.utc)
    day_6_start = (now + timedelta(days=1)).date()
    day_6_end = day_6_start + timedelta(days=1)
    day_7_start = now.date()
    day_7_end = day_7_start + timedelta(days=1)

    rows = (
        db.table("users")
        .select("email, trial_ends_at")
        .eq("subscription_status", "trial")
        .execute()
        .data
        or []
    )
    sent_d6 = 0
    sent_d7 = 0
    for user in rows:
        ends_at = user.get("trial_ends_at")
        email = user.get("email")
        if not ends_at or not email:
            continue
        try:
            ends_dt = datetime.fromisoformat(str(ends_at).replace("Z", "+00:00")).date()
        except Exception:
            continue
        if day_6_start <= ends_dt < day_6_end:
            _send(email, "Seu trial encerra amanhã — Medrion", "<p>Seu trial encerra amanhã. Ative seu plano para continuar gerando prescrições sem interrupção.</p>")
            sent_d6 += 1
        elif day_7_start <= ends_dt < day_7_end:
            _send(email, "Seu trial encerra hoje — Medrion", "<p>Seu trial encerra hoje. Ative seu plano para manter o acesso ao Medrion.</p>")
            sent_d7 += 1

    return {"sent_day_6": sent_d6, "sent_day_7": sent_d7}


@router.get("/weekly-backup")
async def weekly_backup(x_cron_secret: str = Header(default="")) -> dict:
    _ensure_secret(x_cron_secret)
    actives = db.table("actives").select("*").eq("status", "active").execute().data or []
    columns = [
        "commercial_name", "generic_name", "supplier", "category", "route",
        "tni_zone", "mechanism", "indications", "dose_min", "dose_max",
        "dose_usual", "posology", "safety_alerts", "contraindications", "interactions",
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for a in actives:
        writer.writerow(a)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"backups/ativos_{today}.csv"
    try:
        db.storage.from_("backups").upload(
            path=filename,
            file=buf.getvalue().encode("utf-8"),
            file_options={"content-type": "text/csv", "upsert": "true"},
        )
    except Exception as exc:
        logger.exception("Failed to upload weekly backup: %s", exc)
        raise HTTPException(status_code=500, detail="Backup upload failed")

    # Retain 12 most recent
    try:
        files = db.storage.from_("backups").list("backups") or []
        files_sorted = sorted(files, key=lambda f: f.get("created_at", ""), reverse=True)
        for old in files_sorted[12:]:
            db.storage.from_("backups").remove([f"backups/{old['name']}"])
    except Exception:
        logger.exception("Failed to prune old backups")

    return {"file": filename, "actives_count": len(actives)}
