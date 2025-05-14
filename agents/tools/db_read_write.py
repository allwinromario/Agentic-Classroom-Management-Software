"""Database read and write operations for the Smart Classroom Management System."""

from typing import Any, Dict, Optional, List
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from config import MONGO_URI, DB_NAME
from .json_utils import json_serialize

# Create a global client with connection pooling
_mongo_client: Optional[MongoClient] = None

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
        data: List of dictionaries containing the data to write. For example:
            List[Dict[str, Any]]: A list of attendance records, where each record is a dictionary:
            [
                {
                    "student_name": str,  # Student name in uppercase
                    "status": str,        # "present" or "absent"
                    "timestamp": str,     # UTC timestamp as ISO format string
                    "remarks": str        # Detection remarks
                },
                ...
            ]
        
    Returns:
        Dict containing status of the operation
    """
    try:
        client = get_database_client()
        db = client[DB_NAME]
        collection = db[collection_name]
        
        # Insert the data directly since datetime is already handled
        result = collection.insert_many(data)
        
        response = {
            "status": "success",
            "message": f"Data written successfully. Inserted {len(result.inserted_ids)} documents."
        }
        return json_serialize(response)
    except ConnectionFailure as e:
        error_response = {
            "status": "error",
            "message": f"Database connection error: {str(e)}"
        }
        return json_serialize(error_response)
    except Exception as e:
        error_response = {
            "status": "error",
            "message": f"Database error: {str(e)}"
        }
        return json_serialize(error_response)

def read_data(collection_name: str, query: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Read data from MongoDB collection.
    
    Args:
        collection_name: Name of the collection to read from
        query: Query dictionary to filter results
        
    Returns:
        Dict containing the query results
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
            # Convert ObjectId to string for _id field
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
            results.append(doc)
        
        response = {
            "status": "success",
            "data": results
        }
        return json_serialize(response)
    except ConnectionFailure as e:
        error_response = {
            "status": "error",
            "message": f"Database connection error: {str(e)}"
        }
        return json_serialize(error_response)
    except Exception as e:
        error_response = {
            "status": "error",
            "message": f"Database error: {str(e)}"
        }
        return json_serialize(error_response)

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
