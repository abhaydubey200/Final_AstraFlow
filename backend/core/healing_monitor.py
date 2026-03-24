import functools
import time
import inspect
import asyncio
import traceback
import logging
import json
from datetime import datetime
from typing import Any, Callable, Dict, Optional

from services.self_healing_service import self_healing_manager

logger = logging.getLogger("astra-tracing")

class HealingMonitor:
    """Monitoring layer that traces function execution and triggers self-healing on failure."""
    def __init__(self, healing_manager=self_healing_manager):
        self.healing_manager = healing_manager
        self.active_traces = {}

    def set_healing_manager(self, manager):
        self.healing_manager = manager

    def trace_and_heal(self, component: str = "generic"):
        """Decorator to monitor function calls and auto-heal on exception."""
        def decorator(func: Callable):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await self._execute_traced(func, component, *args, **kwargs)

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                return asyncio.run(self._execute_traced(func, component, *args, **kwargs))

            return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        return decorator

    async def _execute_traced(self, func, component, *args, **kwargs):
        trace_id = f"{func.__name__}_{time.time()}"
        start_time = time.time()
        
        # Capture input metadata (sanitized)
        payload = self._sanitize_payload(args, kwargs)
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            duration = (time.time() - start_time) * 1000
            
            # Performance Monitoring: Detect latency bottlenecks
            if duration > 2000: # 2s threshold
                logger.warning(f"Performance Warning: {func.__name__} took {duration:.2f}ms")
                if self.healing_manager:
                    await self.healing_manager.diagnose_and_fix(
                        error_msg=f"High latency in {func.__name__}: {duration:.2f}ms",
                        component=component,
                        context={"duration_ms": duration, "trace_id": trace_id}
                    )
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            stack_trace = traceback.format_exc()
            duration = (time.time() - start_time) * 1000
            
            logger.error(f"Execution Failure in {func.__name__}: {error_msg}")
            
            # Autonomous Self-Healing Trigger
            if self.healing_manager:
                await self.healing_manager.diagnose_and_fix(
                    error_msg=error_msg,
                    component=component,
                    context={
                        "function": func.__name__,
                        "payload": payload,
                        "stack_trace": stack_trace,
                        "duration_ms": duration,
                        "trace_id": trace_id,
                        "timestamp": datetime.now().isoformat()
                    }
                )
            
            raise e

    def _sanitize_payload(self, args, kwargs) -> Dict:
        """Sanitize sensitive data from trace logs."""
        # Simple sanitization - in production this would be more robust
        sanitized = {"args": list(args), "kwargs": kwargs}
        sensitive_keys = {"password", "token", "secret", "key", "auth"}
        
        def _clear_secrets(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if any(s in k.lower() for s in sensitive_keys):
                        obj[k] = "********"
                    else:
                        _clear_secrets(v)
            elif isinstance(obj, list):
                for item in obj:
                    _clear_secrets(item)
                    
        _clear_secrets(sanitized)
        return sanitized

# Global monitor instance
runtime_monitor = HealingMonitor()
