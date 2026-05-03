"""
Email service using Resend for Medrion.
All functions are no-ops when RESEND_API_KEY is not configured.
"""

import base64
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def _resend_available() -> bool:
    return bool(settings.RESEND_API_KEY)


def send_welcome_email(to: str, name: str) -> None:
    """
    Send a welcome email to a newly registered doctor.
    No-op if RESEND_API_KEY is not set.
    """
    if not _resend_available():
        logger.debug("RESEND_API_KEY not configured — skipping welcome email to %s", to)
        return

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": "Medrion <noreply@medrion.com.br>",
                "to": [to],
                "subject": "Bem-vindo ao Medrion!",
                "html": f"""
                <h2>Olá, Dr(a). {name}!</h2>
                <p>Sua conta no Medrion foi criada com sucesso.</p>
                <p>Complete o onboarding para começar a gerar prescrições inteligentes.</p>
                <p>Equipe Medrion</p>
                """,
            }
        )
        logger.info("Welcome email sent to %s", to)
    except Exception as exc:
        logger.error("Failed to send welcome email to %s: %s", to, exc)


def send_otp_email(to: str, otp: str) -> None:
    """
    Send a one-time password email for future 2FA support.
    No-op if RESEND_API_KEY is not set.
    """
    if not _resend_available():
        logger.debug("RESEND_API_KEY not configured — skipping OTP email to %s", to)
        return

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": "Medrion <noreply@medrion.com.br>",
                "to": [to],
                "subject": "Seu código de verificação — Medrion",
                "html": f"""
                <h2>Código de verificação</h2>
                <p>Use o código abaixo para confirmar seu acesso:</p>
                <h1 style="letter-spacing: 8px; font-size: 40px;">{otp}</h1>
                <p>O código é válido por 10 minutos.</p>
                <p>Se você não solicitou este código, ignore este e-mail.</p>
                """,
            }
        )
        logger.info("OTP email sent to %s", to)
    except Exception as exc:
        logger.error("Failed to send OTP email to %s: %s", to, exc)


def send_prescription_to_pharmacy(
    to: str, docx_bytes: bytes, patient_name: str
) -> None:
    """
    Send a prescription DOCX as an email attachment to a pharmacy.
    No-op if RESEND_API_KEY is not set.
    """
    if not _resend_available():
        logger.debug(
            "RESEND_API_KEY not configured — skipping pharmacy email to %s", to
        )
        return

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        b64_content = base64.standard_b64encode(docx_bytes).decode("utf-8")
        filename = f"Prescricao_{patient_name.replace(' ', '_')}.docx"

        resend.Emails.send(
            {
                "from": "Medrion <prescricoes@medrion.com.br>",
                "to": [to],
                "subject": f"Prescrição Médica — {patient_name}",
                "html": f"""
                <p>Segue em anexo a prescrição médica do paciente <strong>{patient_name}</strong>.</p>
                <p>Documento gerado via plataforma Medrion.</p>
                """,
                "attachments": [
                    {
                        "filename": filename,
                        "content": b64_content,
                    }
                ],
            }
        )
        logger.info("Prescription email sent to pharmacy %s for patient %s", to, patient_name)
    except Exception as exc:
        logger.error(
            "Failed to send prescription email to %s: %s", to, exc
        )
