"""Smart Classroom Management System - Agent implementation."""

from __future__ import annotations

from typing import Optional

from google.adk.agents import LlmAgent
from google.adk.artifacts import InMemoryArtifactService
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from class_agent.prompt import ROOT_AGENT_INSTR
from config import APP_NAME, MODEL
from tools import initialize_scms, mark_attendance_from_image, read_data, write_data

root_agent = LlmAgent(
    name="classroom_management_agent",
    model=MODEL,
    description=(
        "You are a helpful classroom management assistant "
        "that helps teachers manage their classrooms and students."
    ),
    instruction=ROOT_AGENT_INSTR,
    sub_agents=[],
    tools=[mark_attendance_from_image, write_data, read_data, initialize_scms],
)

# Process-level services are reused across requests to preserve session state.
artifact_service = InMemoryArtifactService()
session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
    artifact_service=artifact_service,
)


def ensure_session(*, user_id: str, session_id: str) -> str:
    """Create a session if it does not already exist."""
    existing = session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if existing:
        return session_id

    session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    return session_id


def _extract_text(event) -> str:
    if not getattr(event, "content", None):
        return ""
    parts = getattr(event.content, "parts", None) or []
    text_chunks: list[str] = []
    for part in parts:
        text = getattr(part, "text", None)
        if text:
            text_chunks.append(text)
    return "\n".join(text_chunks).strip()


async def run_agent_turn(*, user_id: str, session_id: str, message: str) -> str:
    """Run one conversational turn and return assistant text."""
    ensure_session(user_id=user_id, session_id=session_id)

    user_content = types.Content(
        role="user",
        parts=[types.Part(text=message)],
    )

    final_text: Optional[str] = None
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=user_content
    ):
        text = _extract_text(event)
        if text:
            final_text = text
        if hasattr(event, "is_final_response") and event.is_final_response():
            if text:
                return text

    if final_text:
        return final_text
    return "I could not generate a response. Please try again."

