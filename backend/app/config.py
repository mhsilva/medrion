from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str
    ANTHROPIC_API_KEY: str
    RESEND_API_KEY: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_DOCTOR: str = ""
    STRIPE_PRICE_PHARMACY_10: str = ""
    STRIPE_PRICE_PHARMACY_20: str = ""
    STRIPE_PRICE_PHARMACY_30: str = ""
    CRON_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
