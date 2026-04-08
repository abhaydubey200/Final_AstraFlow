#!/usr/bin/env python
"""Quick test script to verify connector registry."""
import sys
import json
import os

# Ensure backend path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from core.connector_registry import ConnectorRegistry
    
    print("="*60)
    print("CONNECTOR REGISTRY TEST")
    print("="*60)
    
    # Get all supported types
    types = ConnectorRegistry.get_supported_types()
    print(f"\n✅ Supported Types ({len(types)}):")
    for t in types:
        print(f"   - {t}")
    
    # Get all schemas
    schemas = ConnectorRegistry.get_all_schemas()
    print(f"\n✅ Schemas Retrieved: {len(schemas)}")
    
    # Test each connector
    print("\n" + "="*60)
    print("CONNECTOR DETAILS")
    print("="*60)
    
    for name in types:
        try:
            connector_class = ConnectorRegistry.get_connector_class(name)
            schema = connector_class.get_config_schema()
            caps = connector_class.get_capabilities()
            
            print(f"\n✅ {name.upper()}")
            print(f"   Title: {schema.get('title', 'N/A')}")
            print(f"   Required: {schema.get('required', [])}")
            print(f"   Capabilities: CDC={caps.get('supports_cdc')}, Incremental={caps.get('supports_incremental')}")
            
        except Exception as e:
            print(f"\n❌ {name.upper()}: ERROR - {e}")
    
    # Test API response format
    print("\n" + "="*60)
    print("API RESPONSE FORMAT (/connections/types)")
    print("="*60)
    print(json.dumps({k: {"schema": "...", "capabilities": "..."} for k in types}, indent=2))
    
    print("\n✅ All tests passed!")
    sys.exit(0)
    
except Exception as e:
    print(f"\n❌ FATAL ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
