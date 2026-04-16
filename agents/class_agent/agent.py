"""Smart Classroom Management System - Agent implementation."""

from google.adk.runners import Runner
from google.adk.artifacts import InMemoryArtifactService
from google.adk.agents import LlmAgent
from google.adk.sessions import InMemorySessionService




from class_agent.prompt import ROOT_AGENT_INSTR
from config import MODEL, APP_NAME, USER_ID, SESSION_ID
from tools import mark_attendance_from_image, read_data, write_data, initialize_scms


root_agent = LlmAgent(
    name="classroom_management_agent",
    model=MODEL,
    description=""" You are a helpful classroom management assistant 
                    that helps users(teachers) manage their classrooms and students.
                """,
    instruction=ROOT_AGENT_INSTR,
    sub_agents=[],
    tools=[mark_attendance_from_image, write_data, read_data, initialize_scms],
    )

# Instantiate the desired artifact service
artifact_service = InMemoryArtifactService()
session_service = InMemorySessionService()
session = session_service.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID)


# Provide it to the Runner
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
    artifact_service=artifact_service # Service must be provided here
)

