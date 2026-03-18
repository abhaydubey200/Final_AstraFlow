import pandas as pd
import os
import uuid
import tempfile
from typing import List, Dict, Any, Optional

class ParquetUtils:
    @staticmethod
    def chunk_to_parquet(records: List[Dict[str, Any]], local_dir: Optional[str] = None) -> str:
        """
        Converts a list of dicts to a local Parquet file.
        Returns the local file path.
        """
        if not local_dir:
            local_dir = os.path.join(tempfile.gettempdir(), "astraflow_cache")
            
        if not os.path.exists(local_dir):
            os.makedirs(local_dir, exist_ok=True)
            
        df = pd.DataFrame(records)
        file_id = str(uuid.uuid4())
        file_path = os.path.join(local_dir, f"chunk_{file_id}.parquet")
        
        # Use Snappy compression as recommended for staging
        df.to_parquet(file_path, engine='pyarrow', compression='snappy', index=False)
        
        return file_path
