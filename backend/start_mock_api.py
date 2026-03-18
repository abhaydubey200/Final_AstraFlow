import uvicorn
import os

# Inject mock db before any other local imports
import mock_db

from main import app

if __name__ == "__main__":
    print("Starting AstraFlow API in MOCK mode on port 8081...")
    uvicorn.run(app, host="0.0.0.0", port=8081)
