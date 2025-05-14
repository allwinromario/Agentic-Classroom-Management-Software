from datetime import datetime
from json import JSONEncoder
from bson import ObjectId

class CustomJSONEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

def json_serialize(obj):
    """
    Serialize an object to JSON string, handling datetime and ObjectId.
    
    Args:
        obj: The object to serialize
        
    Returns:
        str: JSON string representation
    """
    return CustomJSONEncoder().encode(obj) 