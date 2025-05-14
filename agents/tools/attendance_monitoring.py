"""Attendance monitoring tool using face recognition for the Smart Classroom Management System."""

import os
import cv2
import numpy as np
import face_recognition
from typing import Dict, List, Tuple, Any
from config import TRAIN_DIR, MONGO_URI, DB_NAME, SESSION_ID
from pymongo import MongoClient
from .json_utils import json_serialize
import requests
from datetime import datetime

from urllib.parse import urlparse

def is_url(path: str) -> bool:
    """Check if the given path is a URL."""
    try:
        result = urlparse(path)
        return all([result.scheme, result.netloc])
    except:
        return False

def load_image(image_path: str) -> Tuple[np.ndarray, str]:
    """
    Load image from either local path or URL.
    
    Args:
        image_path: Local file path or URL to the image
        
    Returns:
        Tuple of (image array, error message if any)
    """
    try:
        if is_url(image_path):
            # Download image from URL
            response = requests.get(image_path)
            response.raise_for_status()  # Raise exception for bad status codes
            
            # Convert to numpy array
            image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
            image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
            
            if image is None:
                return None, f"Could not decode image from URL: {image_path}"
                
            return image, None
        else:
            # Load local image
            image = cv2.imread(image_path)
            if image is None:
                return None, f"Could not load local image: {image_path}"
                
            return image, None
            
    except requests.exceptions.RequestException as e:
        return None, f"Error downloading image from URL: {str(e)}"
    except Exception as e:
        return None, f"Error loading image: {str(e)}"

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

def mark_attendance_from_image(image_path: str) -> str:
    """
    Process a group image to determine attendance status for each student.
    
    Args:
        image_path (str): Path to the image file or URL containing student faces.
                         For local files: path to JPG, JPEG, PNG, or WEBP image
                         For web images: URL to the image
                         Examples:
                         - "path/to/class_photo.jpg"
                         - "https://example.com/class_photo.jpg"
    
    Returns:
        str: A JSON serialized string containing attendance records or error
    """
    client = None
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        attendance_collection = db.attendance
        
        # Load known faces
        known_face_encodings, known_names = load_known_faces()
        if not known_face_encodings:
            return json_serialize({"error": "No known faces found in training directory"})
        
        # Load and process the group image
        image, error = load_image(image_path)
        if error:
            return json_serialize({"error": error})
        
        # Convert BGR to RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Find faces in the image
        face_locations = face_recognition.face_locations(image)
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        # Initialize attendance records
        attendance_records = []
        recognized_names = set()  # Track recognized students
        
        # Process each face found in the image
        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            # Compare with known faces
            matches = face_recognition.compare_faces(
                known_face_encodings, 
                face_encoding,
                tolerance=0.6
            )
            
            # Get the best match
            face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
            best_match_index = np.argmin(face_distances)
            
            if matches[best_match_index]:
                name = known_names[best_match_index]
                recognized_names.add(name)
                
                # Draw rectangle around face
                cv2.rectangle(image, (left, top), (right, bottom), (0, 0, 255), 2)
                cv2.rectangle(image, (left, bottom - 15), (right, bottom), (0, 0, 255), cv2.FILLED)
                
                # Add name label
                font = cv2.FONT_HERSHEY_DUPLEX
                cv2.putText(image, name, (left + 6, bottom - 6), font, 1.0, (255, 255, 255), 1)
        
        # Create attendance records for all students
        for name in known_names:
            record = {
                "student_name": name,
                "status": "present" if name in recognized_names else "absent",
                "timestamp": datetime.now().isoformat(),
                "remarks": "Detected in class photo" if name in recognized_names else "Not detected in class photo"
            }
            attendance_records.append(record)
        
        # Save the annotated image
        if not is_url(image_path):
            # For local files, save next to original
            output_path = os.path.join(os.path.dirname(image_path), "output.jpg")
        else:
            # For URLs, save in current directory
            output_path = "output.jpg"
            
        cv2.imwrite(output_path, cv2.cvtColor(image, cv2.COLOR_RGB2BGR))
        
        print(f"Attendance records prepared: {attendance_records}")
        return attendance_records
        
    except Exception as e:
        return json_serialize({"error": str(e)})
    finally:
        client.close()

# # Example usage:
# if __name__ == "__main__":
#     test_image_path = "tools/test.webp"
#     attendance_result = mark_attendance_from_image(test_image_path)
