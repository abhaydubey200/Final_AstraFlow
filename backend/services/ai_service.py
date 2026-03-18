import os
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = "gpt-4-turbo"

    async def generate_sql(self, natural_language_query: str, schema_context: str) -> str:
        """Generates SQL from natural language using AI."""
        # Mocking AI response for project demonstration
        # In a real enterprise app, this would call OpenAI or a self-hosted LLM
        logger.info(f"Generating SQL for query: {natural_language_query}")
        
        # Simple rule-based mock for demo purposes
        if "order" in natural_language_query.lower() and "total" in natural_language_query.lower():
            return "SELECT SUM(total_amount) FROM orders WHERE status = 'completed';"
        
        return "SELECT * FROM source_table LIMIT 100;"

    async def detect_anomalies(self, data_sample: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identifies anomalies in a data sample using statistical heuristics or AI."""
        anomalies = []
        if not data_sample:
            return []
            
        # Example heuristic: value > 3x mean
        # Total amount as a proxy
        amounts = [row.get('amount', 0) for row in data_sample if 'amount' in row]
        if amounts:
            mean = sum(amounts) / len(amounts)
            for i, row in enumerate(data_sample):
                if row.get('amount', 0) > mean * 3:
                    anomalies.append({
                        "index": i,
                        "reason": f"Value {row['amount']} is significantly above average ({mean})",
                        "severity": "high"
                    })
        
        return anomalies

    async def summarize_pipeline_run(self, run_id: str, statistics: Dict[str, Any]) -> str:
        """Generates a human-readable summary of a pipeline run."""
        rows = statistics.get('rows_processed', 0)
        errors = statistics.get('error_count', 0)
        duration = statistics.get('duration_seconds', 0)
        
        summary = f"Pipeline run {run_id} processed {rows} rows in {duration}s. "
        if errors > 0:
            summary += f"Encountered {errors} errors. AI recommends verifying source connectivity."
        else:
            summary += "Run was successful with no anomalies detected."
            
        return summary
    async def explain_failure(self, error_message: str) -> Dict[str, Any]:
        """Analyzes technical error logs to provide human-readable explanations and fixes."""
        error_lower = error_message.lower()
        
        # Rule-based suggestions for common ETL failures
        if "warehouse" in error_lower and "suspended" in error_lower:
            return {
                "reason": "The destination warehouse is currently suspended or inactive.",
                "fix": "Enable 'Auto-Resume' in your Snowflake warehouse settings or start it manually.",
                "confidence": 0.95
            }
        if "permission" in error_lower or "access denied" in error_lower:
            return {
                "reason": "The worker does not have sufficient privileges to read/write the data.",
                "fix": "Grant SELECT/INSERT permissions to the AstraFlow service user for this database.",
                "confidence": 0.90
            }
        if "column" in error_lower and "not found" in error_lower:
            return {
                "reason": "A schema change occurred in the source table.",
                "fix": "Re-run schema discovery and update your pipeline mapping.",
                "confidence": 0.85
            }
        if "timeout" in error_lower or "deadline exceeded" in error_lower:
            return {
                "reason": "Connection timed out. The server might be unreachable or behind a firewall.",
                "fix": "Check your firewall settings and ensure the AstraFlow IP is whitelisted.",
                "confidence": 0.80
            }
        if "authentication" in error_lower or "password" in error_lower or "ident" in error_lower:
            return {
                "reason": "Invalid credentials or authentication method mismatch.",
                "fix": "Double-check your username and password. Ensure SSL is enabled if required by the server.",
                "confidence": 0.90
            }
            
        # Default AI-style summary
        return {
            "reason": "General connectivity or execution error detected.",
            "fix": "Verify that both source and destination systems are reachable and credentials haven't expired.",
            "confidence": 0.50
        }
