import os
from typing import Optional
from urllib.parse import quote_plus

# MongoDB configuration
MONGO_USER = "admin"
MONGO_PASS = "admin@123"
MONGO_CLUSTER = "scms-cluster.wfsdwph.mongodb.net"

# Build the connection string with properly escaped credentials
MONGO_URI = f"mongodb+srv://{quote_plus(MONGO_USER)}:{quote_plus(MONGO_PASS)}@{MONGO_CLUSTER}/?retryWrites=true&w=majority&appName=SCMS-Cluster"

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

def generate_session_id():
    """
    Generate a session ID which is a unique identifier for the current session.
    It can be a random string of characters.
    """
    import uuid
    return str(uuid.uuid4())

SESSION_ID = generate_session_id()