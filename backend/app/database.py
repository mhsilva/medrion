from supabase import create_client, Client
from app.config import settings

db: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
