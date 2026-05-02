import json
import re

# Read the file
with open('questions.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the JSON array
prefix = 'const QUESTIONS_DATA = '
if not content.startswith(prefix):
    raise ValueError("Unexpected format")

json_str = content[len(prefix):].strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

data = json.loads(json_str)

# Filter criteria
def is_bad_question(q):
    text = q.get('q', '').strip()
    options = q.get('o', [])
    
    # Check if empty
    if not text:
        return True
        
    # Check if text is just like "(d) 346." or "346." or "(a)"
    if re.fullmatch(r'[\(\)a-zA-Z0-9\.\s]+', text) and len(text) < 15 and not any(w.isalpha() and len(w) > 2 for w in text.split()):
        return True
        
    # Check if options have empty string
    for opt in options:
        opt_strip = opt.strip()
        if not opt_strip:
            return True
        # Check if option looks like answer key string, e.g. "347. (c) 348."
        if re.search(r'\d+\.\s*\([a-d]\)', opt_strip):
            return True
            
    # Check if text looks like answer key string
    if re.search(r'\d+\.\s*\([a-d]\)', text):
        return True

    return False

total_questions_before = 0
total_questions_after = 0

for topic_data in data:
    original_len = len(topic_data['questions'])
    total_questions_before += original_len
    
    # Filter
    filtered = [q for q in topic_data['questions'] if not is_bad_question(q)]
    topic_data['questions'] = filtered
    
    total_questions_after += len(filtered)
    
print(f"Removed {total_questions_before - total_questions_after} garbage questions.")
print(f"Total remaining: {total_questions_after}")

# Write back
with open('questions.js', 'w', encoding='utf-8') as f:
    f.write('const QUESTIONS_DATA = ' + json.dumps(data, indent=4) + ';\n')
