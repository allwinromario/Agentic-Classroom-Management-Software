"""Standalone test script for MongoDB connection and JSON serialization."""

from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import json
import os
from urllib.parse import quote_plus

# MongoDB connection credentials
MONGO_USER = "admin"
MONGO_PASS = "admin@123"
MONGO_CLUSTER = "scms-cluster.wfsdwph.mongodb.net"

# Build the connection string with properly escaped credentials
MONGO_URI = f"mongodb+srv://{quote_plus(MONGO_USER)}:{quote_plus(MONGO_PASS)}@{MONGO_CLUSTER}/?retryWrites=true&w=majority&appName=SCMS-Cluster"

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

def test_mongodb_connection():
    client = None
    try:
        # Connect to MongoDB
        print("Connecting to MongoDB Atlas...")
        client = MongoClient(MONGO_URI)
        
        # Test the connection
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        
        # Get database
        db = client.test_db
        
        # Create test data
        test_data = {
            "name": "Test Document",
            "timestamp": datetime.utcnow(),
            "some_data": "test"
        }
        
        print("\n1. Inserting test document...")
        result = db.test_collection.insert_one(test_data)
        print(f"Inserted document ID: {result.inserted_id}")
        
        print("\n2. Reading back the document...")
        doc = db.test_collection.find_one({"_id": result.inserted_id})
        
        print("\n3. Testing JSON serialization...")
        json_str = json.dumps(doc, cls=CustomJSONEncoder, indent=2)
        print("Serialized document:")
        print(json_str)
        
        print("\n4. Cleaning up test data...")
        db.test_collection.delete_one({"_id": result.inserted_id})
        
        print("\nAll tests completed successfully!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if client:
            client.close()
            print("MongoDB connection closed.")

if __name__ == "__main__":
    test_mongodb_connection() 