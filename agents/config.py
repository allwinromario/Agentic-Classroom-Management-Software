import os
from typing import Optional
from urllib.parse import quote_plus

# MongoDB configuration (env-first, with backward-compatible fallback)
MONGO_USER = os.getenv("MONGO_USER", "sarah04zain_db_user")
MONGO_PASS = os.getenv("MONGO_PASS", "LbNuJJRe2bvZ9xZ9")
MONGO_CLUSTER = os.getenv("MONGO_CLUSTER", "Cluster0.ylnkbcq.mongodb.net")

DEFAULT_MONGO_URI = (
    f"mongodb+srv://{quote_plus(MONGO_USER)}:{quote_plus(MONGO_PASS)}@{MONGO_CLUSTER}/"
    "?retryWrites=true&w=majority&appName=SCMS-Cluster"
)
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or DEFAULT_MONGO_URI

GOOGLE_API_KEY: Optional[str] = os.getenv("GOOGLE_API_KEY")

# Model configuration
MODEL = "gemini-2.5-flash"
TEMPERATURE = 1.0
MAX_OUTPUT_TOKENS = 4096

# Database configuration
DB_NAME = "scms"

# Training directory
TRAIN_DIR = "tools/train"

# Artifact configuration
APP_NAME = "classroom_management_app"
USER_ID = "user_1"

# Class-agent service configuration
CLASS_AGENT_HOST = os.getenv("CLASS_AGENT_HOST", "0.0.0.0")
CLASS_AGENT_PORT = int(os.getenv("CLASS_AGENT_PORT", "8001"))
CLASS_AGENT_TIMEOUT_MS = int(os.getenv("CLASS_AGENT_TIMEOUT_MS", "30000"))

def generate_session_id():
    """
    Generate a session ID which is a unique identifier for the current session.
    It can be a random string of characters.
    """
    import uuid
    return str(uuid.uuid4())

SESSION_ID = generate_session_id()