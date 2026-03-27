import traceback
import sys
import os

# Ad AstraRoot to path
sys.path.append(os.getcwd())

try:
    print("IMPORTING MAIN...")
    from main import app
    print("IMPORT SUCCESS.")
    
    import asyncio
    from main import startup_event
    
    print("RUNNING STARTUP EVENT...")
    asyncio.run(startup_event())
    print("STARTUP SUCCESS.")
except Exception:
    print("CAUGHT FATAL ERROR:")
    traceback.print_exc()
