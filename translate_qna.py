import json
import time
import os
from deep_translator import GoogleTranslator

def main():
    file_path = 'public/questions.js'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    prefix = "const QUESTIONS_DATA = "
    if not content.startswith(prefix):
        print("Invalid file format")
        return
        
    json_str = content[len(prefix):].strip()
    if json_str.endswith(';'):
        json_str = json_str[:-1]
        
    data = json.loads(json_str)
    translator = GoogleTranslator(source='en', target='hi')
    
    print("Gathering untranslated items...")
    tasks = []
    
    for t_idx, topic in enumerate(data):
        if 'topic_hi' not in topic:
            tasks.append({'ref': topic, 'key': 'topic_hi', 'text': str(topic['topic'])})
            
        for q_idx, q in enumerate(topic['questions']):
            if 'q_hi' not in q:
                tasks.append({'ref': q, 'key': 'q_hi', 'text': str(q['q'])})
                
            if 'o_hi' not in q or len(q['o_hi']) != len(q['o']):
                q['o_hi'] = []
                for idx, opt in enumerate(q['o']):
                    tasks.append({'ref': q['o_hi'], 'key': 'append', 'text': str(opt)})

    print(f"Total items to translate: {len(tasks)}")
    if len(tasks) == 0:
        print("Everything is already translated!")
        return

    batch_size = 25
    
    try:
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i+batch_size]
            
            # Using a unique separator that Google Translate usually ignores
            sep = " \n "
            text_to_translate = sep.join([t['text'] if t['text'].strip() else "EMPTY_STR" for t in batch])
            
            try:
                translated_text = translator.translate(text_to_translate)
            except Exception as e:
                print(f"Batch API error: {e}")
                translated_text = ""
                
            if translated_text:
                translated_lines = translated_text.split('\n')
                translated_lines = [l.strip() for l in translated_lines]
                
                if len(translated_lines) == len(batch):
                    for idx, t in enumerate(batch):
                        res = translated_lines[idx]
                        if res == "EMPTY_STR": res = ""
                        
                        if t['key'] == 'append':
                            t['ref'].append(res)
                        else:
                            t['ref'][t['key']] = res
                else:
                    # Fallback to single translation if mismatch
                    for t in batch:
                        try:
                            res = translator.translate(t['text']) or ""
                        except:
                            res = t['text']
                        if t['key'] == 'append':
                            t['ref'].append(res)
                        else:
                            t['ref'][t['key']] = res
            else:
                # API failed
                for t in batch:
                    res = t['text']
                    if t['key'] == 'append':
                        t['ref'].append(res)
                    else:
                        t['ref'][t['key']] = res
            
            if i % 100 == 0:
                print(f"Processed {i}/{len(tasks)} items...")
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(prefix + json.dumps(data, indent=4, ensure_ascii=False) + ";\n")
                    
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nError: {e}")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(prefix + json.dumps(data, indent=4, ensure_ascii=False) + ";\n")
    print("Done and saved.")

if __name__ == "__main__":
    main()
