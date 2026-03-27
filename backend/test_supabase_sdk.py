import os
from supabase import create_client
from dotenv import load_dotenv

# Load .env relative to backend/
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"URL: {url}")
print(f"Key preview: {key[:10]}...")

try:
    supabase = create_client(url, key)
    res = supabase.table("pipelines").select("id").limit(1).execute()
    print("SUCCESS: Connection established.")
    print(f"Data: {res.data}")
except Exception as e:
    print(f"FAILED: {e}")
