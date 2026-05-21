"""
Billing routes for Medrion.

- POST /billing/doctor/checkout: starts a Stripe Checkout session for the direct doctor plan
- POST /billing/pharmacy/checkout: starts a Stripe Checkout session for a pharmacy seat package
- POST /billing/portal: opens the Stripe Customer Portal for the current user/pharmacy
- POST /billing/webhook: handles Stripe webhook events (no auth — verified by signature)
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.config import settings
from app.database import db
from app.middleware.auth import get_current_user
from app.services import stripe_service
from app.services.email_service import (
    send_payment_failed_email,
    send_pharmacy_suspended_email,
    send_subscription_reactivated_email,
    send_subscription_suspended_email,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])
webhook_router = APIRouter(prefix="/billing", tags=["billing"])


# ---------------------------------------------------------------------------
# Doctor checkout
# ---------------------------------------------------------------------------


@router.post("/doctor/checkout")
async def doctor_checkout(current_user: dict = Depends(get_current_user)) -> dict:
    user_id = current_user["user_id"]
    user_row = current_user.get("db_row") or {}
    if user_row.get("role") not in ("doctor", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas médicos diretos podem assinar")

    user_full = db.table("users").select("email, name, stripe_customer_id, pharmacy_id").eq("id", user_id).single().execute().data
    if not user_full:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    if user_full.get("pharmacy_id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seu acesso já é coberto pela farmácia vinculada. Sem necessidade de assinatura individual.",
        )

    success_url = f"{settings.FRONTEND_URL}/dashboard?checkout=success"
    cancel_url = f"{settings.FRONTEND_URL}/checkout?status=cancelled"

    try:
        session = stripe_service.create_doctor_checkout_session(
            user_id=user_id,
            email=user_full["email"],
            name=user_full.get("name"),
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    db.table("users").update({"stripe_customer_id": session["customer_id"]}).eq("id", user_id).execute()
    return {"url": session["url"], "session_id": session["id"]}


# ---------------------------------------------------------------------------
# Pharmacy checkout
# ---------------------------------------------------------------------------


@router.post("/pharmacy/checkout")
async def pharmacy_checkout(
    payload: dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role") not in ("pharmacy_admin", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores de farmácia")

    plan_seats = payload.get("plan_seats")
    if plan_seats not in (10, 20, 30):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pacote inválido (10/20/30)")

    user_id = current_user["user_id"]
    user_row = db.table("users").select("email, name, pharmacy_id").eq("id", user_id).single().execute().data
    pharmacy_id = user_row and user_row.get("pharmacy_id")
    if not pharmacy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")

    pharmacy = db.table("pharmacies").select("name, responsible_email").eq("id", pharmacy_id).single().execute().data
    if not pharmacy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")

    success_url = f"{settings.FRONTEND_URL}/farmacia/dashboard?checkout=success"
    cancel_url = f"{settings.FRONTEND_URL}/onboarding/farmacia?status=cancelled"

    try:
        session = stripe_service.create_pharmacy_checkout_session(
            pharmacy_id=pharmacy_id,
            email=pharmacy.get("responsible_email") or user_row["email"],
            name=pharmacy.get("name"),
            plan_seats=plan_seats,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    db.table("pharmacies").update(
        {"stripe_customer_id": session["customer_id"], "plan_seats": plan_seats}
    ).eq("id", pharmacy_id).execute()
    return {"url": session["url"], "session_id": session["id"]}


# ---------------------------------------------------------------------------
# Customer Portal
# ---------------------------------------------------------------------------


@router.post("/portal")
async def billing_portal(current_user: dict = Depends(get_current_user)) -> dict:
    user_id = current_user["user_id"]
    role = current_user.get("role")

    if role == "pharmacy_admin":
        user_row = db.table("users").select("pharmacy_id").eq("id", user_id).single().execute().data
        pharmacy_id = user_row and user_row.get("pharmacy_id")
        if not pharmacy_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")
        pharmacy = db.table("pharmacies").select("stripe_customer_id").eq("id", pharmacy_id).single().execute().data
        customer_id = pharmacy and pharmacy.get("stripe_customer_id")
        return_url = f"{settings.FRONTEND_URL}/farmacia/dashboard"
    else:
        user_full = db.table("users").select("stripe_customer_id").eq("id", user_id).single().execute().data
        customer_id = user_full and user_full.get("stripe_customer_id")
        return_url = f"{settings.FRONTEND_URL}/perfil"

    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nenhuma assinatura ativa — comece o checkout antes de gerenciar.",
        )

    try:
        portal = stripe_service.create_billing_portal_session(customer_id=customer_id, return_url=return_url)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    return {"url": portal["url"]}


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------


def _user_id_from_subscription(subscription: dict) -> str | None:
    metadata = subscription.get("metadata") or {}
    if metadata.get("medrion_user_id"):
        return metadata["medrion_user_id"]
    return None


def _pharmacy_id_from_subscription(subscription: dict) -> str | None:
    metadata = subscription.get("metadata") or {}
    if metadata.get("medrion_pharmacy_id"):
        return metadata["medrion_pharmacy_id"]
    return None


def _suspend_pharmacy_doctors(pharmacy_id: str, pharmacy_name: str) -> None:
    """Suspend all doctors linked to a pharmacy and notify each by email + in-app."""
    links = db.table("pharmacy_doctors").select("doctor_id").eq("pharmacy_id", pharmacy_id).eq("status", "active").execute()
    doctor_ids = [r["doctor_id"] for r in (links.data or [])]
    if not doctor_ids:
        return
    db.table("users").update({"subscription_status": "suspended"}).in_("id", doctor_ids).execute()
    doctors = db.table("users").select("id, email").in_("id", doctor_ids).execute().data or []
    for doc in doctors:
        if doc.get("email"):
            try:
                send_pharmacy_suspended_email(doc["email"], pharmacy_name)
            except Exception:
                logger.exception("Failed pharmacy suspended email to %s", doc.get("email"))
        try:
            db.table("notifications").insert({
                "user_id": doc["id"],
                "type": "access_suspended",
                "message": json.dumps({"text": f"Acesso via {pharmacy_name} suspenso por falta de pagamento."}),
                "read": False,
            }).execute()
        except Exception:
            logger.exception("Failed in-app notification for %s", doc.get("id"))


def _reactivate_pharmacy_doctors(pharmacy_id: str) -> None:
    links = db.table("pharmacy_doctors").select("doctor_id").eq("pharmacy_id", pharmacy_id).eq("status", "active").execute()
    doctor_ids = [r["doctor_id"] for r in (links.data or [])]
    if not doctor_ids:
        return
    db.table("users").update({"subscription_status": "active"}).in_("id", doctor_ids).execute()


def _handle_checkout_completed(session: dict) -> None:
    """Called when a Checkout Session completes successfully — links subscription to user/pharmacy."""
    metadata_subscription_id = session.get("subscription")
    customer_id = session.get("customer")
    client_reference_id = session.get("client_reference_id")
    mode = session.get("mode")
    if mode != "subscription" or not metadata_subscription_id:
        return

    # Doctor or pharmacy?
    is_pharmacy = bool(
        db.table("pharmacies").select("id").eq("id", client_reference_id).execute().data
    ) if client_reference_id else False

    if is_pharmacy:
        db.table("pharmacies").update({
            "stripe_subscription_id": metadata_subscription_id,
            "stripe_customer_id": customer_id,
            "subscription_status": "active",
        }).eq("id", client_reference_id).execute()
        # Activate the pharmacy admin user
        db.table("users").update({"subscription_status": "active"}).eq("pharmacy_id", client_reference_id).eq("role", "pharmacy_admin").execute()
    elif client_reference_id:
        db.table("users").update({
            "stripe_subscription_id": metadata_subscription_id,
            "stripe_customer_id": customer_id,
            "subscription_status": "active",
        }).eq("id", client_reference_id).execute()


def _handle_subscription_updated(subscription: dict) -> None:
    """Maps Stripe subscription status → users/pharmacies.subscription_status."""
    sub_status = subscription.get("status")
    sub_id = subscription.get("id")
    if not sub_id or not sub_status:
        return

    # Stripe statuses: trialing, active, past_due, unpaid, canceled, incomplete, incomplete_expired
    if sub_status in ("active", "trialing"):
        local_status = "active" if sub_status == "active" else "trial"
    elif sub_status in ("past_due", "unpaid"):
        local_status = "suspended"
    elif sub_status in ("canceled", "incomplete_expired"):
        local_status = "cancelled"
    else:
        return  # incomplete: ignore until Stripe finalizes

    # Pharmacy?
    pharmacy_match = db.table("pharmacies").select("id, name, subscription_status").eq("stripe_subscription_id", sub_id).execute()
    if pharmacy_match.data:
        pharmacy = pharmacy_match.data[0]
        previous = pharmacy.get("subscription_status")
        # pharmacies don't have 'trial' in their constraint
        pharmacy_status = "active" if local_status == "trial" else local_status
        db.table("pharmacies").update({"subscription_status": pharmacy_status}).eq("id", pharmacy["id"]).execute()
        if pharmacy_status == "suspended" and previous != "suspended":
            _suspend_pharmacy_doctors(pharmacy["id"], pharmacy.get("name", "Farmácia"))
        elif pharmacy_status == "active" and previous == "suspended":
            _reactivate_pharmacy_doctors(pharmacy["id"])
        return

    # Doctor?
    user_match = db.table("users").select("id, email, subscription_status").eq("stripe_subscription_id", sub_id).execute()
    if user_match.data:
        user = user_match.data[0]
        previous = user.get("subscription_status")
        db.table("users").update({"subscription_status": local_status}).eq("id", user["id"]).execute()
        if user.get("email"):
            if local_status == "suspended" and previous != "suspended":
                try:
                    send_subscription_suspended_email(user["email"])
                except Exception:
                    logger.exception("Failed suspended email")
            elif local_status == "active" and previous == "suspended":
                try:
                    send_subscription_reactivated_email(user["email"])
                except Exception:
                    logger.exception("Failed reactivated email")


def _handle_payment_failed(invoice: dict) -> None:
    customer_id = invoice.get("customer")
    if not customer_id:
        return
    user_match = db.table("users").select("id, email").eq("stripe_customer_id", customer_id).execute()
    if user_match.data:
        user = user_match.data[0]
        if user.get("email"):
            try:
                send_payment_failed_email(user["email"])
            except Exception:
                logger.exception("Failed payment-failed email")
        try:
            db.table("notifications").insert({
                "user_id": user["id"],
                "type": "payment_failed",
                "message": json.dumps({"text": "Falha de pagamento. Atualize seu cartão."}),
                "read": False,
            }).execute()
        except Exception:
            logger.exception("Failed payment-failed notification")


@webhook_router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(default="")) -> dict:
    payload = await request.body()
    try:
        event = stripe_service.verify_webhook_event(payload, stripe_signature)
    except Exception as exc:
        logger.warning("Invalid Stripe webhook signature: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info("Stripe webhook: %s", event_type)

    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(data)
        elif event_type in ("customer.subscription.updated", "customer.subscription.created"):
            _handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            data["status"] = "canceled"
            _handle_subscription_updated(data)
        elif event_type == "invoice.payment_failed":
            _handle_payment_failed(data)
    except Exception:
        logger.exception("Error handling Stripe event %s", event_type)

    return {"received": True}
