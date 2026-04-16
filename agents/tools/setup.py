"""Setup tool for initializing the Smart Classroom Management System."""

import os
import face_recognition
import numpy as np
from typing import Dict, List, Tuple, Any
from datetime import datetime
from config import MONGO_URI, DB_NAME, TRAIN_DIR
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

def load_known_faces(train_dir: str = TRAIN_DIR) -> Tuple[List[np.ndarray], List[str]]:
    """
    Load and encode known faces from the training directory.
    
    Args:
        train_dir: Directory containing training images
        
    Returns:
        Tuple of (known_face_encodings, known_names)
    """
    known_face_encodings = []
    known_names = []
    
    for filename in os.listdir(train_dir):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            image_path = os.path.join(train_dir, filename)
            try:
                # Load and encode the image
                image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(image)
                
                if encodings:
                    known_face_encodings.append(encodings[0])
                    # Get name from filename (without extension)
                    name = os.path.splitext(filename)[0].upper()
                    known_names.append(name)
                else:
                    print(f"Warning: No face found in {filename}")
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    print(f"Loaded {len(known_face_encodings)} known faces: {known_names}")
    return known_face_encodings, known_names

def create_initial_students() -> Dict[str, Any]:
    """
    Create initial student records based on the face recognition training data.
    """
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        
        # Define standard class IDs
        class_ids = ["MATH101", "PHY102", "CHEM203", "BIO102", "ENG101"]
        
        # Load student names from face recognition data
        _, student_names = load_known_faces()
        
        # Create student records with random class assignments
        students_to_insert = []
        for idx, name in enumerate(student_names, start=1):
            # Randomly assign a class ID
            assigned_class = class_ids[idx % len(class_ids)]  # This will distribute students evenly across classes
            
            student = {
                "name": name,
                "student_id": f"2024{str(idx).zfill(3)}",  # Generate admission numbers like 2024001
                "class_id": assigned_class,
                "guardiancontact": "+919980587423"  # This can be updated later
            }
            students_to_insert.append(student)
        
        if students_to_insert:
            try:
                result = db.students.insert_many(students_to_insert)
                return {
                    "status": "success",
                    "message": f"Created {len(result.inserted_ids)} student records",
                    "students": [{"name": s["name"], "class": s["class_id"]} for s in students_to_insert]
                }
            except DuplicateKeyError:
                return {
                    "status": "warning",
                    "message": "Some students already exist in the database"
                }
        else:
            return {
                "status": "error",
                "message": "No student face data found in training directory"
            }
            
    except Exception as e:
        return {
            "status": "warning",
            "message": f"Error creating students: {str(e)}"
        }
    finally:
        client.close()

def create_initial_subjects() -> Dict[str, Any]:
    """
    Create initial subject records for the school.
    """
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        
        # Define basic subjects
        class_subjects = [
            {
                "subject_name": "Mathematics",
                "class_id": "MATH101",
            },
            {
                "subject_name": "Physics",
                "class_id": "PHY101",
            },
            {
                "subject_name": "Chemistry",
                "class_id": "CHEM101",
            },
            {
                "subject_name": "Biology",
                "class_id": "BIO101",
            },
            {
                "subject_name": "English",
                "class_id": "ENG101",
            }
        ]
        
        try:
            result = db.subjects.insert_many(class_subjects)
            return {
                "status": "success",
                "message": f"Created {len(result.inserted_ids)} subject records",
                "subjects": [s["subject_name"] for s in class_subjects]
            }
        except DuplicateKeyError:
            return {
                "status": "error",
                "message": "Some subjects already exist in the database"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error creating subjects: {str(e)}"
        }
    finally:
        client.close()

def initialize_scms() -> Dict[str, Any]:
    """
    Initialize the entire SCMS by setting up students and subjects.
    """
    results = {
        "students": create_initial_students(),
        "subjects": create_initial_subjects()
    }
    
    # Check if both operations were successful
    if all(r["status"] == "success" for r in results.values()):
        return {
            "status": "success",
            "message": "SCMS initialized successfully",
            "details": results
        }
    else:
        return {
            "status": "error",
            "message": "Some initialization steps failed",
            "details": results
        }

if __name__ == "__main__":
    result = initialize_scms()
    print(result)
