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
        
        # Student Collection Schema
        student_schema = {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["name", "student_id", "class_id"],
                    "properties": {
                        "name": {
                            "bsonType": "string",
                            "description": "Name of the student"
                        },
                        "student_id": {
                            "bsonType": "string",
                            "description": "Unique student identifier"
                        },
                        "class_id": {
                            "bsonType": "string",
                            "description": "Class identifier in format IX-A or VIII-D"
                        },
                        "guardiancontact": {
                            "bsonType": "string",
                            "description": "Guardian contact number"
                        }
                    }
                }
            },
            "validationAction": "error"
        }

        # Attendance Collection Schema (Updated)
        attendance_schema = {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["student_id", "date", "status", "class_id"],
                    "properties": {
                        "student_id": {
                            "bsonType": "string",
                            "description": "Student identifier"
                        },
                        "date": {
                            "bsonType": "date",
                            "description": "Date of attendance"
                        },
                        "status": {
                            "enum": ["present", "absent"],
                            "description": "Attendance status"
                        },
                        "class_id": {
                            "bsonType": "string",
                            "description": "Class identifier"
                        },
                        "remarks": {
                            "bsonType": ["string", "null"],
                            "description": "Optional remarks"
                        }
                    }
                }
            },
            "validationAction": "error"
        }

        # Subject Collection Schema
        subject_schema = {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["subject_name", "class_id"],
                    "properties": {
                        "subject_name": {
                            "bsonType": "string",
                            "description": "Subject name"
                        },
                        "class_id": {
                            "bsonType": "string",
                            "description": "Class identifier"
                        },
                    }
                }
            },
            "validationAction": "error"
        }

        # Assessment Collection Schema
        assessment_schema = {
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["student_id", "classId", "assessmentType", "maxMarks", "marksObtained"],
                    "properties": {
                        "student_id": {
                            "bsonType": "string",
                            "description": "Reference to student document"
                        },
                        "classId": {
                            "bsonType": "string",
                            "description": "Reference to class document"
                        },
                        "assessmentType": {
                            "enum": ["exam", "quiz", "assignment", "project"],
                            "description": "Type of assessment"
                        },
                        "maxMarks": {
                            "bsonType": "number",
                            "minimum": 0,
                            "description": "Maximum marks possible"
                        },
                        "marksObtained": {
                            "bsonType": "number",
                            "minimum": 0,
                            "description": "Marks obtained by student"
                        },
                        "remarks": {
                            "bsonType": ["string", "null"],
                            "description": "Optional remarks"
                        }
                    }
                }
            },
            "validationAction": "error"
        }

        # Create or update collections with schemas
        collections_schemas = {
            "students": student_schema,
            "attendance": attendance_schema,
            "subjects": subject_schema,
            "assessments": assessment_schema
        }

        for collection_name, schema in collections_schemas.items():
            if collection_name in db.list_collection_names():
                db.command("collMod", collection_name, **schema)
            else:
                db.create_collection(collection_name, **schema)

        # Create indexes for better query performance
        db.students.create_index([("student_id", ASCENDING)], unique=True)
        db.attendance.create_index([("student_id", ASCENDING), ("date", ASCENDING)])
        
        print("Database setup completed successfully!")
        return client
        
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise
    except Exception as e:
        print(f"An error occurred during database setup: {e}")
        raise


if __name__ == "__main__":
    # Run the database setup
    client = setup_database()
        
    # Close the connection
    client.close()
