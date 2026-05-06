"""
Admin routes for Medrion.

All routes require role='admin'. Enforced via require_admin dependency.

Covers:
- Users / Pharmacies management (list, suspend, reactivate, delete)
- Stats (MRR / churn-friendly counts)
- Access logs
- Actives (clinical assets bank): CRUD + publish + discontinue + change log
- Active preview (test prescription with draft active)
- Protocol versions (CRUD + rollback)
- Urgent safety alerts (CRUD + dismissal)
- Active usage analytics
- CSV import / export of actives
- LGPD: export of doctor's own data
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, status

from app.database import db
from app.middleware.auth import require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_one(table: str, id: str) -> dict | None:
    res = db.table(table).select("*").eq("id", id).execute()
    return res.data[0] if res.data else None


def _log_active_change(
    *,
    active_id: str,
    user_id: str,
    change_type: str,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    change_reason: str | None = None,
) -> None:
    try:
        db.table("active_changes_log").insert({
            "active_id": active_id,
            "changed_by": user_id,
            "change_type": change_type,
            "field_changed": field_changed,
            "old_value": old_value,
            "new_value": new_value,
            "change_reason": change_reason,
        }).execute()
    except Exception:
        logger.exception("Failed to log active change")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users")
async def list_users(
    subscription_status: Optional[str] = Query(None),
    role_filter: Optional[str] = Query(None, alias="role"),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _admin: dict = Depends(require_admin),
) -> Any:
    query = db.table("users").select("*").order("created_at", desc=True).range(offset, offset + limit - 1)
    if subscription_status:
        query = query.eq("subscription_status", subscription_status)
    if role_filter:
        query = query.eq("role", role_filter)
    if search:
        query = query.or_(f"email.ilike.%{search}%,name.ilike.%{search}%,crm.ilike.%{search}%")
    result = query.execute()
    return result.data or []


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, _admin: dict = Depends(require_admin)) -> dict:
    db.table("users").update({"subscription_status": "suspended"}).eq("id", user_id).execute()
    return {"ok": True}


@router.post("/users/{user_id}/reactivate")
async def reactivate_user(user_id: str, _admin: dict = Depends(require_admin)) -> dict:
    db.table("users").update({"subscription_status": "active"}).eq("id", user_id).execute()
    return {"ok": True}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, _admin: dict = Depends(require_admin)) -> None:
    db.auth.admin.delete_user(user_id)


# ---------------------------------------------------------------------------
# Pharmacies
# ---------------------------------------------------------------------------


@router.get("/pharmacies")
async def list_pharmacies(_admin: dict = Depends(require_admin)) -> Any:
    pharmacies = db.table("pharmacies").select("*").order("name").execute().data or []
    if not pharmacies:
        return []
    pharmacy_ids = [p["id"] for p in pharmacies]
    links = db.table("pharmacy_doctors").select("pharmacy_id, doctor_id").eq("status", "active").in_("pharmacy_id", pharmacy_ids).execute().data or []
    seats_used: dict[str, int] = {}
    for link in links:
        pid = link["pharmacy_id"]
        seats_used[pid] = seats_used.get(pid, 0) + 1
    for p in pharmacies:
        p["seats_used"] = seats_used.get(p["id"], 0)
    return pharmacies


@router.post("/pharmacies/{pharmacy_id}/suspend")
async def suspend_pharmacy(pharmacy_id: str, _admin: dict = Depends(require_admin)) -> dict:
    db.table("pharmacies").update({"subscription_status": "suspended"}).eq("id", pharmacy_id).execute()
    return {"ok": True}


@router.post("/pharmacies/{pharmacy_id}/reactivate")
async def reactivate_pharmacy(pharmacy_id: str, _admin: dict = Depends(require_admin)) -> dict:
    db.table("pharmacies").update({"subscription_status": "active"}).eq("id", pharmacy_id).execute()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats")
async def get_stats(_admin: dict = Depends(require_admin)) -> dict:
    def _count(table: str, **filters) -> int:
        try:
            q = db.table(table).select("id", count="exact")
            for k, v in filters.items():
                q = q.eq(k, v)
            return q.execute().count or 0
        except Exception:
            return 0

    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    try:
        new_signups = db.table("users").select("id", count="exact").gte("created_at", thirty_days_ago).execute().count or 0
    except Exception:
        new_signups = 0

    return {
        "users": {
            "total": _count("users"),
            "trial": _count("users", subscription_status="trial"),
            "active": _count("users", subscription_status="active"),
            "suspended": _count("users", subscription_status="suspended"),
            "cancelled": _count("users", subscription_status="cancelled"),
            "new_30d": new_signups,
        },
        "pharmacies": {
            "total": _count("pharmacies"),
            "active": _count("pharmacies", subscription_status="active"),
            "suspended": _count("pharmacies", subscription_status="suspended"),
        },
        "prescriptions": {
            "total": _count("prescriptions"),
            "final": _count("prescriptions", status="final"),
        },
        "patients": _count("patients"),
    }


# ---------------------------------------------------------------------------
# Access logs
# ---------------------------------------------------------------------------


@router.get("/access-logs")
async def list_access_logs(
    user_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    _admin: dict = Depends(require_admin),
) -> Any:
    query = db.table("access_logs").select("*, users(email, name)").order("created_at", desc=True).limit(limit)
    if user_id:
        query = query.eq("user_id", user_id)
    return query.execute().data or []


# ---------------------------------------------------------------------------
# Actives — CRUD
# ---------------------------------------------------------------------------


_ACTIVE_FIELDS = {
    "commercial_name", "generic_name", "supplier", "category", "subcategory",
    "route", "tni_zone", "mechanism", "indications", "dose_min", "dose_max",
    "dose_usual", "posology", "safety_alerts", "contraindications",
    "interactions", "clinical_notes", "last_reviewed_at", "review_source",
    "allowed_professionals",
}


@router.get("/actives")
async def list_actives(
    status_filter: Optional[str] = Query(None, alias="status"),
    supplier: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    route: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    _admin: dict = Depends(require_admin),
) -> Any:
    query = db.table("actives").select("*").order("commercial_name")
    if status_filter:
        query = query.eq("status", status_filter)
    if supplier:
        query = query.eq("supplier", supplier)
    if category:
        query = query.eq("category", category)
    if route:
        query = query.eq("route", route)
    if search:
        query = query.or_(f"commercial_name.ilike.%{search}%,generic_name.ilike.%{search}%")
    return query.execute().data or []


@router.get("/actives/{active_id}")
async def get_active(active_id: str, _admin: dict = Depends(require_admin)) -> Any:
    active = _fetch_one("actives", active_id)
    if not active:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    return active


@router.post("/actives", status_code=status.HTTP_201_CREATED)
async def create_active(payload: dict[str, Any], admin: dict = Depends(require_admin)) -> Any:
    data = {k: v for k, v in payload.items() if k in _ACTIVE_FIELDS}
    if not data.get("commercial_name") or not data.get("supplier"):
        raise HTTPException(status_code=400, detail="commercial_name e supplier são obrigatórios")
    data["status"] = "draft"
    data["created_by"] = admin["user_id"]
    db.table("actives").insert(data).execute()
    created = db.table("actives").select("*").eq("commercial_name", data["commercial_name"]).order("created_at", desc=True).limit(1).execute()
    if created.data:
        _log_active_change(
            active_id=created.data[0]["id"],
            user_id=admin["user_id"],
            change_type="created",
        )
    return created.data[0] if created.data else {}


@router.put("/actives/{active_id}")
async def update_active(
    active_id: str,
    payload: dict[str, Any],
    admin: dict = Depends(require_admin),
) -> Any:
    existing = _fetch_one("actives", active_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    data = {k: v for k, v in payload.items() if k in _ACTIVE_FIELDS}
    change_reason = payload.get("change_reason")

    if not data:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    data["updated_at"] = _now_iso()

    db.table("actives").update(data).eq("id", active_id).execute()
    for field, new_value in data.items():
        if field in {"updated_at"}:
            continue
        old_value = existing.get(field)
        if str(old_value) != str(new_value):
            _log_active_change(
                active_id=active_id,
                user_id=admin["user_id"],
                change_type="updated",
                field_changed=field,
                old_value=str(old_value) if old_value is not None else None,
                new_value=str(new_value) if new_value is not None else None,
                change_reason=change_reason,
            )

    return _fetch_one("actives", active_id)


@router.post("/actives/{active_id}/publish")
async def publish_active(active_id: str, admin: dict = Depends(require_admin)) -> Any:
    existing = _fetch_one("actives", active_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    db.table("actives").update({"status": "active", "updated_at": _now_iso()}).eq("id", active_id).execute()
    _log_active_change(
        active_id=active_id,
        user_id=admin["user_id"],
        change_type="published",
        old_value=existing.get("status"),
        new_value="active",
    )
    return _fetch_one("actives", active_id)


@router.post("/actives/{active_id}/discontinue")
async def discontinue_active(
    active_id: str,
    payload: dict[str, Any],
    admin: dict = Depends(require_admin),
) -> Any:
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Motivo da descontinuação é obrigatório")
    existing = _fetch_one("actives", active_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    db.table("actives").update({
        "status": "discontinued",
        "discontinuation_reason": reason,
        "discontinued_at": _now_iso(),
        "updated_at": _now_iso(),
    }).eq("id", active_id).execute()
    _log_active_change(
        active_id=active_id,
        user_id=admin["user_id"],
        change_type="discontinued",
        change_reason=reason,
    )
    return _fetch_one("actives", active_id)


@router.get("/actives/{active_id}/changes")
async def list_active_changes(active_id: str, _admin: dict = Depends(require_admin)) -> Any:
    return (
        db.table("active_changes_log")
        .select("*, users(email, name)")
        .eq("active_id", active_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


@router.post("/actives/{active_id}/preview")
async def preview_active(
    active_id: str,
    payload: dict[str, Any],
    admin: dict = Depends(require_admin),
) -> Any:
    test_anamnesis = (payload.get("test_anamnesis") or "").strip()
    if not test_anamnesis:
        raise HTTPException(status_code=400, detail="test_anamnesis é obrigatório")
    active = _fetch_one("actives", active_id)
    if not active:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")

    # Build a minimal context that includes the (potentially draft) active
    # so the model treats it as available even if status='draft'.
    from app.services.anthropic_service import generate_prescription

    fake_patient = {
        "name": "Paciente de Teste",
        "birth_date": "1985-01-01",
        "gender": "M",
        "weight_kg": 75,
        "height_cm": 175,
        "main_complaints": test_anamnesis,
        "therapeutic_objective": "",
    }
    fake_prefs = {"pref_injectables": True, "pref_hormones": True, "pref_anabolics": False}
    output = await generate_prescription(
        patient=fake_patient,
        exams=[],
        history=[],
        preferences=fake_prefs,
        additional_context=f"PREVIEW DE ATIVO EM RASCUNHO:\n{json.dumps(active, default=str)}",
    )

    db.table("active_preview_sessions").insert({
        "active_id": active_id,
        "test_anamnesis": test_anamnesis,
        "api_response": output,
        "created_by": admin["user_id"],
    }).execute()

    return {"output": output}


@router.get("/actives/export/csv")
async def export_actives_csv(_admin: dict = Depends(require_admin)) -> Response:
    actives = db.table("actives").select("*").eq("status", "active").execute().data or []
    columns = [
        "commercial_name", "generic_name", "supplier", "category", "route",
        "tni_zone", "mechanism", "indications", "dose_min", "dose_max",
        "dose_usual", "posology", "safety_alerts", "contraindications", "interactions",
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for active in actives:
        writer.writerow(active)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=medrion_ativos_export_{today}.csv"},
    )


@router.post("/actives/import/csv")
async def import_actives_csv(
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
) -> dict:
    raw = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(raw))
    imported = 0
    skipped = 0
    duplicates = 0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for row in reader:
        name = (row.get("commercial_name") or "").strip()
        supplier = (row.get("supplier") or "").strip()
        if not name or not supplier:
            skipped += 1
            continue
        existing = db.table("actives").select("id").eq("commercial_name", name).execute().data or []
        record_name = name if not existing else f"{name} (importado {today})"
        record = {k: (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k in _ACTIVE_FIELDS}
        record["commercial_name"] = record_name
        record["status"] = "draft"
        record["created_by"] = admin["user_id"]
        db.table("actives").insert(record).execute()
        imported += 1
        if existing:
            duplicates += 1
    return {"imported": imported, "skipped": skipped, "duplicates": duplicates}


# ---------------------------------------------------------------------------
# Protocol versions
# ---------------------------------------------------------------------------


@router.get("/protocol-versions")
async def list_protocol_versions(_admin: dict = Depends(require_admin)) -> Any:
    return db.table("protocol_versions").select("*").order("created_at", desc=True).execute().data or []


@router.post("/protocol-versions", status_code=status.HTTP_201_CREATED)
async def create_protocol_version(
    payload: dict[str, Any],
    admin: dict = Depends(require_admin),
) -> Any:
    version_number = (payload.get("version_number") or "").strip()
    description = payload.get("description") or ""
    system_prompt_text = payload.get("system_prompt_text") or ""
    if not version_number or not system_prompt_text:
        raise HTTPException(status_code=400, detail="version_number e system_prompt_text obrigatórios")
    db.table("protocol_versions").insert({
        "version_number": version_number,
        "description": description,
        "system_prompt_text": system_prompt_text,
        "status": "draft",
        "is_current": False,
    }).execute()
    return (
        db.table("protocol_versions")
        .select("*")
        .eq("version_number", version_number)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data[0]
    )


@router.post("/protocol-versions/{version_id}/publish")
async def publish_protocol_version(version_id: str, admin: dict = Depends(require_admin)) -> Any:
    target = _fetch_one("protocol_versions", version_id)
    if not target:
        raise HTTPException(status_code=404, detail="Versão não encontrada")
    db.table("protocol_versions").update({"status": "archived", "is_current": False}).eq("is_current", True).execute()
    db.table("protocol_versions").update({
        "status": "active",
        "is_current": True,
        "published_at": _now_iso(),
        "published_by": admin["user_id"],
    }).eq("id", version_id).execute()
    return _fetch_one("protocol_versions", version_id)


@router.post("/protocol-versions/{version_id}/rollback")
async def rollback_protocol_version(
    version_id: str,
    payload: dict[str, Any],
    admin: dict = Depends(require_admin),
) -> Any:
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Motivo do rollback obrigatório")
    target = _fetch_one("protocol_versions", version_id)
    if not target:
        raise HTTPException(status_code=404, detail="Versão não encontrada")
    db.table("protocol_versions").update({"status": "archived", "is_current": False}).eq("is_current", True).execute()
    db.table("protocol_versions").update({
        "status": "active",
        "is_current": True,
        "rolled_back_at": _now_iso(),
        "rollback_reason": reason,
    }).eq("id", version_id).execute()
    return _fetch_one("protocol_versions", version_id)


# ---------------------------------------------------------------------------
# Urgent safety alerts
# ---------------------------------------------------------------------------


@router.get("/alerts")
async def list_alerts(
    alert_status: Optional[str] = Query(None, alias="status"),
    _admin: dict = Depends(require_admin),
) -> Any:
    query = db.table("safety_alerts_urgent").select("*, actives(commercial_name)").order("created_at", desc=True)
    if alert_status:
        query = query.eq("status", alert_status)
    return query.execute().data or []


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(payload: dict[str, Any], _admin: dict = Depends(require_admin)) -> Any:
    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    if not title or not description:
        raise HTTPException(status_code=400, detail="title e description obrigatórios")
    record = {
        "title": title,
        "description": description,
        "source": payload.get("source"),
        "severity": payload.get("severity"),
        "show_on_login": bool(payload.get("show_on_login", False)),
        "active_id": payload.get("active_id"),
        "status": "active",
    }
    db.table("safety_alerts_urgent").insert(record).execute()
    return (
        db.table("safety_alerts_urgent")
        .select("*")
        .eq("title", title)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data[0]
    )


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, admin: dict = Depends(require_admin)) -> Any:
    db.table("safety_alerts_urgent").update({
        "status": "resolved",
        "resolved_at": _now_iso(),
        "resolved_by": admin["user_id"],
        "show_on_login": False,
    }).eq("id", alert_id).execute()
    return _fetch_one("safety_alerts_urgent", alert_id)


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: str, _admin: dict = Depends(require_admin)) -> None:
    db.table("safety_alerts_urgent").delete().eq("id", alert_id).execute()


# ---------------------------------------------------------------------------
# Active usage analytics
# ---------------------------------------------------------------------------


@router.get("/analytics/actives")
async def actives_analytics(
    days: int = Query(30, ge=1, le=365),
    _admin: dict = Depends(require_admin),
) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = (
        db.table("active_usage_stats")
        .select("active_id, actives(commercial_name, supplier, category)")
        .gte("created_at", since)
        .execute()
        .data
        or []
    )
    counts: dict[str, dict[str, Any]] = {}
    by_supplier: dict[str, int] = {}
    by_category: dict[str, int] = {}
    total = 0
    for row in rows:
        total += 1
        active = row.get("actives") or {}
        aid = row["active_id"]
        if aid not in counts:
            counts[aid] = {
                "active_id": aid,
                "commercial_name": active.get("commercial_name", "—"),
                "supplier": active.get("supplier"),
                "category": active.get("category"),
                "count": 0,
            }
        counts[aid]["count"] += 1
        if active.get("supplier"):
            by_supplier[active["supplier"]] = by_supplier.get(active["supplier"], 0) + 1
        if active.get("category"):
            by_category[active["category"]] = by_category.get(active["category"], 0) + 1

    top = sorted(counts.values(), key=lambda x: x["count"], reverse=True)[:20]

    all_actives = db.table("actives").select("id, commercial_name").eq("status", "active").execute().data or []
    used_ids = {row["active_id"] for row in rows}
    never_prescribed = [{"id": a["id"], "commercial_name": a["commercial_name"]} for a in all_actives if a["id"] not in used_ids]

    return {
        "period_days": days,
        "total_uses": total,
        "top": top,
        "by_supplier": [{"supplier": k, "count": v} for k, v in sorted(by_supplier.items(), key=lambda x: x[1], reverse=True)],
        "by_category": [{"category": k, "count": v} for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)],
        "never_prescribed": never_prescribed,
    }


# ---------------------------------------------------------------------------
# CSV export — users / pharmacies (admin)
# ---------------------------------------------------------------------------


@router.get("/users/export/csv")
async def export_users_csv(_admin: dict = Depends(require_admin)) -> Response:
    users = db.table("users").select("*").execute().data or []
    columns = ["id", "email", "name", "role", "crm", "crm_state", "specialty", "subscription_status", "created_at", "last_login_at", "trial_ends_at"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for u in users:
        writer.writerow(u)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=medrion_users_{today}.csv"},
    )


@router.get("/pharmacies/export/csv")
async def export_pharmacies_csv(_admin: dict = Depends(require_admin)) -> Response:
    pharmacies = db.table("pharmacies").select("*").execute().data or []
    columns = ["id", "name", "cnpj", "responsible_name", "responsible_email", "phone", "plan_seats", "subscription_status", "created_at"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for p in pharmacies:
        writer.writerow(p)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=medrion_pharmacies_{today}.csv"},
    )
