#!/usr/bin/env python
"""Direct test of brain_server NullClaw invocation."""

import sys
sys.path.insert(0, '.')

from brain_server import CorisService

print("Creating service...")
service = CorisService()

print("Testing with simple prompt...")
try:
    result = service._invoke_nullclaw_cli("Halo, jawab dengan JSON")
    print(f"Result: {result[:200]}...")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
