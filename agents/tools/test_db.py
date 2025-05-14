"""Test script to verify MongoDB connection and JSON serialization."""

from datetime import datetime
from config import MONGO_URI, DB_NAME
from .db_read_write import read_data, write_data

def test_connection():
    """Test MongoDB connection and JSON serialization."""
    # Test data with datetime
    test_data = [{
        "student_name": "Test Student",
        "status": "present",
        "timestamp": datetime.utcnow(),
        "remarks": "Test record"
    }]
    
    print("1. Testing write operation...")
    write_result = write_data("test_collection", test_data)
    print(f"Write result: {write_result}")
    
    print("\n2. Testing read operation...")
    read_result = read_data("test_collection")
    print(f"Read result: {read_result}")
    
if __name__ == "__main__":
    test_connection() 