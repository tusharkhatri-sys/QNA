import json
import re

with open('questions.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_str = content.replace('const QUESTIONS_DATA = ', '').strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

data = json.loads(json_str)

def is_still_bad(q):
    text = q.get('q', '').strip()
    options = q.get('o', [])
    
    # Text length less than 15 but no words >= 3 chars
    words = [w for w in text.split() if w.isalpha()]
    if len(text) < 15 and not any(len(w) >= 3 for w in words):
        return True
        
    # Check if options start with numbers followed by dot and letter, like "20. (a)"
    for opt in options:
        if re.search(r'^\d+\.\s*\([a-d]\)', opt.strip()):
            return True
        if re.match(r'^\([a-d]\)', opt.strip()) and len(opt) < 8:
            return True # options that are just "(a)" or "(a) 234"

    if re.match(r'^\([a-d]\)', text.strip()) and len(text) < 10:
        return True
        
    return False

removed = 0
for topic_data in data:
    filtered = [q for q in topic_data['questions'] if not is_still_bad(q)]
    removed += len(topic_data['questions']) - len(filtered)
    topic_data['questions'] = filtered
    
print(f"Removed additional {removed} garbage questions.")

with open('questions.js', 'w', encoding='utf-8') as f:
    f.write('const QUESTIONS_DATA = ' + json.dumps(data, indent=4) + ';\n')
