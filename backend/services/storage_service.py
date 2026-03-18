import os
import boto3
from botocore.client import Config
from typing import List, Dict, Any, Optional

class StorageService:
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY")
        self.secret_key = os.getenv("MINIO_SECRET_KEY")
        self.bucket_name = os.getenv("STORAGE_BUCKET", "astraflow-staging")
        
        if not self.access_key or not self.secret_key:
            if "localhost" not in self.endpoint:
                raise ValueError("Storage credentials (MINIO_ACCESS_KEY/SECRET_KEY) must be provided in non-local environments.")
            # Fallback for local development only if endpoint is localhost
            self.access_key = self.access_key or "minioadmin"
            self.secret_key = self.secret_key or "minioadmin"
        
        self.s3 = boto3.client(
            's3',
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
        
        # Ensure bucket exists
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.s3.head_bucket(Bucket=self.bucket_name)
        except:
            try:
                self.s3.create_bucket(Bucket=self.bucket_name)
            except Exception as e:
                print(f"Error creating storage bucket: {e}")

    async def upload_file(self, local_path: str, remote_path: str) -> str:
        """Uploads a local file to object storage."""
        if os.getenv("USE_MOCK_DB") == "true":
            print(f"Mock storage upload: {local_path} -> {remote_path}")
            return remote_path
            
        try:
            self.s3.upload_file(local_path, self.bucket_name, remote_path)
            return remote_path
        except Exception as e:
            print(f"File upload error: {e}")
            raise

    async def get_download_url(self, remote_path: str, expires_in: int = 3600) -> str:
        """Generates a presigned URL for downloading a file."""
        return self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket_name, 'Key': remote_path},
            ExpiresIn=expires_in
        )

    async def delete_file(self, remote_path: str):
        """Deletes a file from object storage."""
        self.s3.delete_object(Bucket=self.bucket_name, Key=remote_path)
