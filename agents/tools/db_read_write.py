"""Database read and write operations for the Smart Classroom Management System."""

from typing import Any, Dict, Optional, List
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, WriteError, OperationFailure
from bson import ObjectId
from datetime import datetime
from config import MONGO_URI, DB_NAME
from .json_utils import json_serialize, serialize_object

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

def validate_collection_exists(collection_name: str) -> bool:
    """
    Validate if a collection exists in the database.
    """
    client = get_database_client()
    db = client[DB_NAME]
    return collection_name in db.list_collection_names()

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
        # First check if collection exists
        if not validate_collection_exists(collection_name):
            return {
                "status": "error",
                "message": f"Collection '{collection_name}' does not exist. Please run database setup first."
            }

        client = get_database_client()
        db = client[DB_NAME]
        collection = db[collection_name]
        
        # Convert string dates to datetime objects
        processed_data = []
        for item in data:
            processed_item = {}
            for key, value in item.items():
                if isinstance(value, str) and key.lower().endswith(('date', 'datetime')):
                    try:
                        processed_item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        processed_item[key] = value
                else:
                    processed_item[key] = value
            processed_data.append(processed_item)

        # Insert the processed data
        result = collection.insert_many(processed_data)
        
        # Create response with serialized IDs
        response = {
            "status": "success",
            "message": f"Data written successfully. Inserted {len(result.inserted_ids)} documents.",
            "inserted_ids": [str(id) for id in result.inserted_ids]
        }
        return response
        
    except WriteError as e:
        return {
            "status": "error",
            "message": f"Data validation error: {str(e)}"
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

def read_data(collection_name: str, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Read data from MongoDB collection using MongoDB query syntax.
    
    Args:
        collection_name: Name of the collection to read from
        query: MongoDB query dictionary to filter results
        
    Returns:
        Dict[str, Any]: Response containing:
            - On success: {
                "status": "success",
                "data": [list of matching documents]
              }
            - On error: {
                "status": "error",
                "message": "error description"
              }
    """
    if query is None:
        query = {}

    try:
        # First check if collection exists
        if not validate_collection_exists(collection_name):
            return {
                "status": "error",
                "message": f"Collection '{collection_name}' does not exist. Please run database setup first."
            }
        
        client = get_database_client()
        db = client[DB_NAME]
        collection = db[collection_name]
        
        # Execute the query and convert cursor to list
        cursor = collection.find(query)
        results = []
        for doc in cursor:
            # Serialize each document
            serialized_doc = serialize_object(doc)
            results.append(serialized_doc)
        
        return {
            "status": "success",
            "data": results
        }
        
    except OperationFailure as e:
        return {
            "status": "error",
            "message": f"Query operation error: {str(e)}"
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

def update_data(collection_name: str, query: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update data in MongoDB collection using MongoDB update syntax.
    
    Args:
        collection_name: Name of the collection to update
        query: MongoDB query dictionary to filter results (e.g., {"student_id": "2024001", "class_id": "MATH101"})
        update: MongoDB update dictionary to apply (e.g., {"$set": {"status": "present"}})
        
    Returns:
        Dict[str, Any]: Response containing:
            - On success: {
                "status": "success",
                "message": "Data updated successfully",
                "matched_count": number of documents matched,
                "modified_count": number of documents modified
            }
            - On error: {
                "status": "error",
                "message": "error description"
            }
    """
    try:
        # First check if collection exists
        if not validate_collection_exists(collection_name):
            return {
                "status": "error",
                "message": f"Collection '{collection_name}' does not exist. Please run database setup first."
            }
        
        client = get_database_client()
        db = client[DB_NAME]
        collection = db[collection_name]

        # Validate update operation
        if not update or not any(key.startswith('$') for key in update.keys()):
            return {
                "status": "error",
                "message": "Invalid update operation. Must use MongoDB update operators (e.g., $set)"
            }

        # Execute the update
        result = collection.update_many(query, update)

        return {
            "status": "success",
            "message": "Data updated successfully",
            "matched_count": result.matched_count,
            "modified_count": result.modified_count
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Database error: {str(e)}"
        }

# Example usage: