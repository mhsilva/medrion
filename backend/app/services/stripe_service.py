"""
Stripe service for Medrion.

Wraps the Stripe SDK with helpers for:
- creating customers (idempotent by email)
- creating Checkout Sessions for the doctor plan (with 7-day trial)
- creating Checkout Sessions for pharmacy seat packages (10/20/30)
- creating Customer Portal sessions
- verifying webhook signatures

All functions raise RuntimeError when STRIPE_SECRET_KEY is missing,
so callers can return a friendly error to the user.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


def _ensure_configured() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("Stripe não configurado (STRIPE_SECRET_KEY ausente)")


def _client():
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def get_pharmacy_price_id(plan_seats: int) -> str:
    mapping = {
        10: settings.STRIPE_PRICE_PHARMACY_10,
        20: settings.STRIPE_PRICE_PHARMACY_20,
        30: settings.STRIPE_PRICE_PHARMACY_30,
    }
    price_id = mapping.get(plan_seats)
    if not price_id:
        raise RuntimeError(f"Price ID não configurado para pacote de {plan_seats} seats")
    return price_id


def create_or_get_customer(email: str, name: Optional[str], metadata: Optional[dict] = None) -> str:
    """Returns a Stripe customer id. Creates one if no customer with the same email exists."""
    _ensure_configured()
    stripe = _client()

    existing = stripe.Customer.list(email=email, limit=1)
    if existing.data:
        return existing.data[0].id

    customer = stripe.Customer.create(
        email=email,
        name=name or None,
        metadata=metadata or {},
    )
    return customer.id


def create_doctor_checkout_session(
    *,
    user_id: str,
    email: str,
    name: Optional[str],
    success_url: str,
    cancel_url: str,
) -> dict:
    """
    Creates a Checkout Session for the direct doctor plan.
    7-day trial with card required up front.
    """
    _ensure_configured()
    if not settings.STRIPE_PRICE_DOCTOR:
        raise RuntimeError("STRIPE_PRICE_DOCTOR não configurado")

    stripe = _client()
    customer_id = create_or_get_customer(email=email, name=name, metadata={"medrion_user_id": user_id})

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": settings.STRIPE_PRICE_DOCTOR, "quantity": 1}],
        subscription_data={
            "trial_period_days": 7,
            "metadata": {"medrion_user_id": user_id, "channel": "doctor"},
        },
        payment_method_collection="always",
        client_reference_id=user_id,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"id": session.id, "url": session.url, "customer_id": customer_id}


def create_pharmacy_checkout_session(
    *,
    pharmacy_id: str,
    email: str,
    name: Optional[str],
    plan_seats: int,
    success_url: str,
    cancel_url: str,
) -> dict:
    """
    Creates a Checkout Session for a pharmacy seat package.
    No trial — pharmacies are charged immediately on signup.
    """
    _ensure_configured()
    stripe = _client()

    price_id = get_pharmacy_price_id(plan_seats)
    customer_id = create_or_get_customer(
        email=email, name=name, metadata={"medrion_pharmacy_id": pharmacy_id}
    )

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        subscription_data={
            "metadata": {"medrion_pharmacy_id": pharmacy_id, "channel": "pharmacy", "plan_seats": str(plan_seats)},
        },
        payment_method_collection="always",
        client_reference_id=pharmacy_id,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"id": session.id, "url": session.url, "customer_id": customer_id}


def create_billing_portal_session(*, customer_id: str, return_url: str) -> dict:
    """Creates a Customer Portal session for managing payment method/subscription."""
    _ensure_configured()
    stripe = _client()

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return {"url": session.url}


def verify_webhook_event(payload: bytes, sig_header: str):
    """Verifies the Stripe webhook signature and returns the parsed event. Raises on failure."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET não configurado")
    stripe = _client()
    return stripe.Webhook.construct_event(
        payload=payload,
        sig_header=sig_header,
        secret=settings.STRIPE_WEBHOOK_SECRET,
    )
