#!/usr/bin/env python
"""Test JSON extraction from NullClaw output."""

import re
import json

output = '''info(memory_sqlite): filesystem does not support mmap
info(memory): memory plan resolved
```json
{
  "speech": "Halo!",
  "assembly": []
}
```'''

print('=== Original output ===')
print(output)
print()

# Filter log lines and markdown backticks
lines = output.split('\n')
filtered_lines = []
for line in lines:
    line_stripped = line.strip()
    if re.match(r'^(info\(|error:|debug:|warning:|warn:)', line_stripped, re.IGNORECASE):
        print(f'SKIP (log): {line_stripped[:50]}')
        continue
    if line_stripped.startswith('```'):
        print(f'SKIP (backticks): {line_stripped}')
        continue
    if len(line_stripped) == 0:
        continue
    filtered_lines.append(line)

filtered_output = '\n'.join(filtered_lines)
print()
print('=== Filtered output (repr) ===')
print(repr(filtered_output))
print()
print('=== Filtered output (readable) ===')
print(filtered_output)
print()

# Find JSON
start = filtered_output.find('{')
print(f'First {{ at position: {start}')

if start >= 0:
    depth = 0
    in_string = False
    escape_next = False
    end = -1
    
    for i in range(start, len(filtered_output)):
        char = filtered_output[i]
        
        if char == '"' and not escape_next:
            in_string = not in_string
        elif char == '\\' and in_string:
            escape_next = True
            continue
        escape_next = False
        
        if not in_string:
            if char == '{':
                depth += 1
                print(f'  depth++ at {i}: {{')
            elif char == '}':
                depth -= 1
                print(f'  depth-- at {i}: }} (depth={depth})')
                if depth == 0:
                    end = i + 1
                    break
    
    print(f'Matching }} at position: {end}')
    
    if end > 0:
        json_str = filtered_output[start:end].strip()
        print()
        print('=== Extracted JSON ===')
        print(json_str)
        
        try:
            data = json.loads(json_str)
            print(f'Valid JSON! speech={data.get("speech")}')
        except Exception as e:
            print(f'Invalid JSON: {e}')
    else:
        print('ERROR: No matching } found')
else:
    print('ERROR: No { found')
