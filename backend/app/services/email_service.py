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


def send_pharmacy_invite_email(to: str, pharmacy_name: str, token: str) -> None:
    """Send a pharmacy invite email to a doctor."""
    if not _resend_available():
        logger.debug("RESEND_API_KEY not configured — skipping invite email to %s", to)
        return

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        app_url = getattr(settings, "FRONTEND_URL", "https://medrion.com.br")
        invite_url = f"{app_url}/cadastro?token={token}"

        resend.Emails.send(
            {
                "from": "Medrion <noreply@medrion.com.br>",
                "to": [to],
                "subject": f"Convite para usar o Medrion — {pharmacy_name}",
                "html": f"""
                <h2>Você foi convidado para o Medrion</h2>
                <p>A farmácia <strong>{pharmacy_name}</strong> convidou você para usar a plataforma Medrion.</p>
                <p>Clique no botão abaixo para criar sua conta:</p>
                <a href="{invite_url}" style="
                    display: inline-block;
                    background: #0F3D5C;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;
                    margin: 16px 0;
                ">Criar minha conta</a>
                <p style="color: #888; font-size: 12px;">
                    Este convite expira em 7 dias.<br>
                    Se você não reconhece esta solicitação, ignore este e-mail.
                </p>
                """,
            }
        )
        logger.info("Invite email sent to %s for pharmacy %s", to, pharmacy_name)
    except Exception as exc:
        logger.error("Failed to send invite email to %s: %s", to, exc)


def _send(to: str, subject: str, html: str) -> None:
    if not _resend_available():
        logger.debug("RESEND_API_KEY not configured — skipping email to %s", to)
        return
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "Medrion <noreply@medrion.com.br>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info("Email '%s' sent to %s", subject, to)
    except Exception as exc:
        logger.error("Failed to send email '%s' to %s: %s", subject, to, exc)


def send_payment_failed_email(to: str) -> None:
    portal_url = f"{settings.FRONTEND_URL}/perfil"
    _send(
        to,
        "Falha no pagamento — Medrion",
        f"""
        <h2>Falha no pagamento</h2>
        <p>Não conseguimos processar sua última cobrança no Medrion.</p>
        <p>Atualize seu cartão para evitar a suspensão do acesso:</p>
        <a href="{portal_url}" style="display:inline-block;background:#0F3D5C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Atualizar cartão</a>
        <p style="color:#888;font-size:12px;">Em caso de dúvidas, fale com suporte@medrion.com.br</p>
        """,
    )


def send_subscription_suspended_email(to: str) -> None:
    portal_url = f"{settings.FRONTEND_URL}/pagamento-pendente"
    _send(
        to,
        "Acesso suspenso — Medrion",
        f"""
        <h2>Seu acesso foi suspenso</h2>
        <p>Identificamos falha de pagamento e seu acesso ao Medrion foi suspenso.</p>
        <p>Reative seu cartão para retomar imediatamente:</p>
        <a href="{portal_url}" style="display:inline-block;background:#C0392B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reativar acesso</a>
        """,
    )


def send_subscription_reactivated_email(to: str) -> None:
    _send(
        to,
        "Acesso reativado — Medrion",
        """
        <h2>Acesso restaurado</h2>
        <p>Seu pagamento foi confirmado e o acesso ao Medrion já está reativado.</p>
        <p>Bom trabalho!</p>
        """,
    )


def send_pharmacy_suspended_email(to: str, pharmacy_name: str) -> None:
    direct_url = f"{settings.FRONTEND_URL}/cadastro"
    _send(
        to,
        "Acesso via farmácia foi suspenso — Medrion",
        f"""
        <h2>Acesso suspenso</h2>
        <p>O acesso fornecido pela farmácia <strong>{pharmacy_name}</strong> ao Medrion foi suspenso por falta de pagamento.</p>
        <p>Você pode contatar a farmácia ou assinar diretamente:</p>
        <a href="{direct_url}" style="display:inline-block;background:#0F3D5C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Assinar diretamente</a>
        """,
    )


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
