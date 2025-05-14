from datetime import datetime
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure
from config import MONGO_URI
# from tools.db_read_write import read_data, write_data

# MongoDB connection string
if not MONGO_URI:
    raise ValueError("MongoDB URI not found in environment variables")

def setup_database():
    """
    Set up the MongoDB database and collections with appropriate schemas and indexes.
    """
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client.scms
        
        # Create attendance collection with schema validation
        attendance_schema = {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["student_name", "session_id", "status"],
                    "properties": {
                        "student_name": {
                            "bsonType": "string",
                            "description": "Full name of the student"
                        },
                        "session_id": {
                            "bsonType": ["string"],  # Allow both date and string formats
                            "description": "Date and time of attendance marking"
                        },
                        "status": {
                            "enum": ["present", "absent"],
                            "description": "Attendance status of the student"
                        },
                        "remarks": {
                            "bsonType": ["string", "null"],  # Allow null for empty remarks
                            "description": "Additional notes or remarks"
                        }
                    }
                }
            },
            "validationAction": "warn"  # Change from error to warn to help debug issues
        }
        
        # Create or update the attendance collection with schema
        if "attendance" in db.list_collection_names():
            db.command("collMod", "attendance", **attendance_schema)
        else:
            db.create_collection("attendance", **attendance_schema)
        
        # Create indexes for better query performance
        attendance_collection = db.attendance
        attendance_collection.create_index([("student_name", ASCENDING), ("timestamp", ASCENDING)])
        
        print("Database setup completed successfully!")
        return client
        
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise
    except Exception as e:
        print(f"An error occurred during database setup: {e}")
        raise

def insert_sample_attendance(client: MongoClient):
    """
    Insert sample attendance records for testing purposes.
    """
    db = client.scms
    attendance_collection = db.attendance
    
    sample_records = [
        {
            "student_name": "John Doe",
            "timestamp": datetime.now(),
            "status": "present",
            "remarks": "On time",
        },
        {
            "student_name": "Jane Smith",
            "timestamp": datetime.now(),
            "status": "late",
            "remarks": "Arrived 10 minutes late",
        }
    ]
    
    try:
        attendance_collection.insert_many(sample_records)
        print("Sample attendance records inserted successfully!")
    except Exception as e:
        print(f"Error inserting sample records: {e}")

if __name__ == "__main__":
    # Run the database setup
    client = setup_database()
    
    # Uncomment the following line to insert sample data
    # insert_sample_attendance(client)
    
    # Close the connection
    client.close()
