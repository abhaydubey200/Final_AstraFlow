"""
Base service class for all AstraFlow services.
Provides common functionality and dependency injection.
"""
import logging
from typing import Optional, Any
from supabase import Client
from core.supabase_client import supabase

logger = logging.getLogger(__name__)


class BaseService:
    """
    Base class for all service classes.
    
    Provides:
    - Supabase client access
    - Common logging
    - Dependency injection support
    """
    
    def __init__(self, db_client: Optional[Client] = None, pool: Any = None):
        """
        Initialize the base service.
        
        Args:
            db_client: Supabase client instance (default: global supabase client)
            pool: Database connection pool (legacy, for backward compatibility)
        """
        self.supabase = db_client or supabase
        self.pool = pool  # Legacy support
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def _log_operation(self, operation: str, **kwargs):
        """Log service operation with context."""
        context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
        self.logger.info(f"{operation} {context}")
    
    def _log_error(self, operation: str, error: Exception, **kwargs):
        """Log service error with context."""
        context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
        self.logger.error(f"{operation} FAILED {context}: {str(error)}", exc_info=True)
    
    async def _execute_query(self, table: str, operation: str, **kwargs):
        """
        Execute a Supabase query with error handling.
        
        Args:
            table: Table name
            operation: Operation type (select, insert, update, delete)
            **kwargs: Additional arguments for the operation
            
        Returns:
            Query result
            
        Raises:
            Exception: If query fails
        """
        try:
            self._log_operation(f"{operation.upper()} {table}", **kwargs)
            
            if operation == "select":
                query = self.supabase.table(table).select(kwargs.get("columns", "*"))
            elif operation == "insert":
                query = self.supabase.table(table).insert(kwargs.get("data"))
            elif operation == "update":
                query = self.supabase.table(table).update(kwargs.get("data"))
            elif operation == "delete":
                query = self.supabase.table(table).delete()
            else:
                raise ValueError(f"Unknown operation: {operation}")
            
            # Apply filters if provided
            if "filters" in kwargs:
                for key, value in kwargs["filters"].items():
                    query = query.eq(key, value)
            
            result = query.execute()
            return result
            
        except Exception as e:
            self._log_error(f"{operation.upper()} {table}", e, **kwargs)
            raise
