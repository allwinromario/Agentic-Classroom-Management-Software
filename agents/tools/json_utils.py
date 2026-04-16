"""JSON utilities for handling MongoDB and datetime serialization."""

from datetime import datetime
from json import JSONEncoder
from bson import ObjectId
from typing import Any

class CustomJSONEncoder(JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

def serialize_object(obj: Any) -> Any:
    """
    Recursively serialize an object, handling special types like ObjectId and datetime.
    
    Args:
        obj: The object to serialize
        
    Returns:
        The serialized object
    """
    if isinstance(obj, dict):
        return {key: serialize_object(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_object(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.strftime("%Y-%m-%d %H:%M:%S")
    return obj

def json_serialize(obj: Any) -> str:
    """
    Serialize an object to JSON string, handling datetime and ObjectId.
    First applies custom serialization, then uses the CustomJSONEncoder.
    
    Args:
        obj: The object to serialize
        
    Returns:
        str: JSON string representation
    """
    # First apply our custom serialization
    serialized_obj = serialize_object(obj)
    # Then use the CustomJSONEncoder for the final JSON string
    return CustomJSONEncoder().encode(serialized_obj) 