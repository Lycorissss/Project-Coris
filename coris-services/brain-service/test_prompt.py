#!/usr/bin/env python
import sys
sys.path.insert(0, '.')
from brain_server import CorisService

s = CorisService()
prompt = s._build_system_prompt()
print(f'System prompt length: {len(prompt)} chars')

# Count lines
lines = prompt.split('\n')
print(f'Lines: {len(lines)}')

# Show first few lines
print('First 5 lines:')
for i, line in enumerate(lines[:5]):
    print(f'  {i+1}: {line[:80]}')
