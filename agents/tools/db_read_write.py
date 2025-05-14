"""Database read and write operations for the Smart Classroom Management System."""

from typing import Any, Dict, Optional, List
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from datetime import datetime
from config import MONGO_URI, DB_NAME
from .json_utils import json_serialize

# Create a global client with connection pooling
_mongo_client: Optional[MongoClient] = None

def sanitize_for_json(obj: Any) -> Any:
    """Convert complex types to simple types that can be JSON serialized."""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.strftime("%Y-%m-%d %H:%M:%S")
    elif isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    return obj

def get_database_client() -> MongoClient:
    """
    Get or create a MongoDB client with connection pooling.
    """
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(
            MONGO_URI,
            maxPoolSize=10,
            minPoolSize=1,
            maxIdleTimeMS=45000,
            connectTimeoutMS=5000,
            serverSelectionTimeoutMS=5000,
            retryWrites=True
        )
    return _mongo_client

def write_data(collection_name: str, data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Write data to MongoDB collection using insert_many.
    
    Args:
        collection_name: Name of the collection to write to
        data: List of dictionaries containing the data to write
        
    Returns:
        Dict[str, Any]: JSON serialized response containing status of the operation
    """
    try:
        client = get_database_client()
        db = client[DB_NAME]
        collection = db[collection_name]
        
        # Sanitize the input data
        sanitized_data = sanitize_for_json(data)
        
        # Insert the sanitized data
        result = collection.insert_many(sanitized_data)
        
        # Create response with sanitized IDs
        response = {
            "status": "success",
            "message": f"Data written successfully. Inserted {len(result.inserted_ids)} documents.",
            "inserted_ids": [str(id) for id in result.inserted_ids]
        }
        return response
        
    except ConnectionFailure as e:
        return {
            "status": "error",
            "message": f"Database connection error: {str(e)}"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Database error: {str(e)}"
        }

def read_data(collection_name: str, query: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Read data from MongoDB collection.
    
    Args:
        collection_name: Name of the collection to read from
        query: Query dictionary to filter results
        
    Returns:
        Dict[str, Any]: JSON serialized response containing the query results
    """
    if query is None:
        query = {}
        
    try:
        client = get_database_client()
        db = client[DB_NAME]
        collection = db[collection_name]
        
        # Execute the query and convert cursor to list
        cursor = collection.find(query)
        results = []
        for doc in cursor:
            # Sanitize each document
            sanitized_doc = sanitize_for_json(doc)
            results.append(sanitized_doc)
        
        return {
            "status": "success",
            "data": results
        }
        
    except ConnectionFailure as e:
        return {
            "status": "error",
            "message": f"Database connection error: {str(e)}"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Database error: {str(e)}"
        }

# Example usage:
# if __name__ == "__main__":
#     # Example write operation
#     sample_data = {
#         "student_id": "12345",
#         "name": "John Doe",
#         "grade": "A",
#         "subject": "Mathematics"
#     }
#     write_result = write_data("students", sample_data)
#     print("Write result:", write_result)
    
    # Example read operation
    # query = {"student_id": "12345"}
    # read_result = read_data("students", query)
    # print("Read result:", read_result)
