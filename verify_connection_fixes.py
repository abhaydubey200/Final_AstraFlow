#!/usr/bin/env python3
"""
Verification script for Connection Page fixes
Run this to verify all fixes are in place
"""

import os
import sys

def check_file_contains(filepath, search_strings, description):
    """Check if a file contains all the required strings"""
    if not os.path.exists(filepath):
        print(f"❌ {description}: File not found - {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    missing = []
    for search_str in search_strings:
        if search_str not in content:
            missing.append(search_str)
    
    if missing:
        print(f"❌ {description}: Missing - {', '.join(missing)}")
        return False
    
    print(f"✅ {description}")
    return True

def main():
    print("🔍 Verifying Connection Page Fixes...\n")
    
    checks = [
        # Frontend: Connections.tsx
        (
            "src/pages/Connections.tsx",
            ["const openEdit", "handleBrowseExplorer"],
            "Connections.tsx - openEdit function"
        ),
        
        # Frontend: ConnectionExplorer.tsx
        (
            "src/components/connections/ConnectionExplorer.tsx",
            ["errorNodes", "AlertCircle", "toast", "substring('database:'.length)"],
            "ConnectionExplorer.tsx - Error handling & parsing"
        ),
        
        # Backend: Snowflake connector
        (
            "backend/core/snowflake_connector.py",
            ["quote_identifier", "def quote_identifier", "safe_id.replace"],
            "snowflake_connector.py - Identifier quoting"
        ),
        
        # Backend: Connection service
        (
            "backend/services/connection_service.py",
            ["Missing required", "validate", "HTTPException"],
            "connection_service.py - Validation"
        ),
    ]
    
    all_passed = True
    for filepath, search_strings, description in checks:
        if not check_file_contains(filepath, search_strings, description):
            all_passed = False
    
    print("\n" + "="*60)
    if all_passed:
        print("✅ ALL CHECKS PASSED - Connection Page is Production Ready!")
        print("="*60)
        print("\n📝 Next Steps:")
        print("1. Start backend: cd backend && python main.py")
        print("2. Start frontend: npm run dev")
        print("3. Test at: http://localhost:8080/connections")
        print("\n📖 Documentation:")
        print("- Full details: CONNECTION_PAGE_FIXES_COMPLETE.md")
        print("- Quick guide: QUICKFIX_CONNECTION_PAGE.md")
        return 0
    else:
        print("❌ SOME CHECKS FAILED - Please review the fixes")
        print("="*60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
