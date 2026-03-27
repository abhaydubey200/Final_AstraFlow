import sys
import os
import uvicorn
import traceback

# Add current directory and backend to sys.path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), "backend"))

if __name__ == "__main__":
    print("Starting AstraFlow Backend Server...")
    try:
        # Import app from main
        from backend.main import app
        print("Backend application loaded successfully.")
        
        # Run uvicorn
        uvicorn.run(app, host="127.0.0.1", port=8081, log_level="info")
    except Exception as e:
        print(f"\nCRITICAL ERROR DURING STARTUP:")
        print(f"Error: {e}")
        print("\nFull Traceback:")
        traceback.print_exc()
        sys.exit(1)
