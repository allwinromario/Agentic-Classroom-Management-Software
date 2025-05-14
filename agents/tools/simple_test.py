"""Simple test for database operations."""

from datetime import datetime
from config import MONGO_URI, DB_NAME
from .db_read_write import read_data, write_data

def test_db_operations():
    """Test basic database operations."""
    # Test data
    test_data = [{
        "student_name": "Test Student",
        "status": "present",
        "timestamp": datetime.utcnow(),
        "remarks": "Test record"
    }]
    
    try:
        print("1. Testing write operation...")
        write_result = write_data("test_collection", test_data)
        print(f"Write result: {write_result}")
        
        print("\n2. Testing read operation...")
        read_result = read_data("test_collection")
        print(f"Read result: {read_result}")
        
        print("\nTests completed successfully!")
        
    except Exception as e:
        print(f"Error during test: {str(e)}")

if __name__ == "__main__":
    test_db_operations() 