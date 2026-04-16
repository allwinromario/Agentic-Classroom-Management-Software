from dotenv import load_dotenv
load_dotenv()

# Training directory
TRAIN_DIR = "tools/train"

def generate_session_id():
    """
    Generate a session ID which is a unique identifier for the current session.
    It can be a random string of characters.
    """
    import uuid
    return str(uuid.uuid4())

SESSION_ID = generate_session_id()