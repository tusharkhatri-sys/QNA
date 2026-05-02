import re
import json

def parse_mcq():
    with open('extracted_text.txt', 'r', encoding='utf-8') as f:
        text = f.read()

    # Clean up headers/footers
    text = re.sub(r'\nQ\. Bank \[COPA Semester - 1\] \d+\n', '\n', text)
    text = re.sub(r'\n\d+ Prepared by: Dr\.V\.Nagaradjane\n', '\n', text)
    text = re.sub(r'\nPrepared by: Dr\.V\.Nagaradjane\n', '\n', text)
    text = re.sub(r'\nContents\n.*?(?=Chapter 1)', '', text, flags=re.DOTALL)

    # The PDF contains sections like "1.1 Basic hardware and software"
    # Followed by questions: "1. Logarithm was invented by .\n(a) John Napier\n(b) Edmund Gunter\n(c) Blaise Pascal\n(d) Charles Babbage"
    # And eventually "Answers(1-372)\n1. (a) 2. (c) ..."
    
    # Let's split the document by chapters or main topics
    topics_raw = re.split(r'\n1\.\d+\s+([^\n]+)\n', text)
    
    # topics_raw[0] is preamble.
    # pairs of (topic_name, topic_content)
    
    final_data = []
    
    if len(topics_raw) > 1:
        for i in range(1, len(topics_raw), 2):
            topic_name = topics_raw[i].strip()
            topic_text = topics_raw[i+1]
            
            # Find the answers block in this topic
            ans_dict = {}
            ans_blocks = re.findall(r'Answers\([0-9]+-[0-9]+\)(.*?)(?=\n1\.\d+\s+|$)', topic_text, re.DOTALL | re.IGNORECASE)
            
            if not ans_blocks:
                # sometimes it's just "Answers" without range
                ans_blocks = re.findall(r'Answers.*?\n(.*?)(?=\n1\.\d+\s+|$)', topic_text, re.DOTALL | re.IGNORECASE)
                
            for ans_text in ans_blocks:
                matches = re.findall(r'(\d+)\.\s*\(([a-d])\)', ans_text, re.IGNORECASE)
                for m in matches:
                    ans_dict[int(m[0])] = ord(m[1].lower()) - ord('a')
                    
            # Find questions
            # Split by question numbers
            q_splits = re.split(r'\n(\d+)\.\s+', topic_text)
            
            questions_list = []
            
            for j in range(1, len(q_splits), 2):
                q_num = int(q_splits[j])
                q_body = q_splits[j+1]
                
                # We need to stop q_body at the next topic or "Answers"
                q_body = re.split(r'\nAnswers', q_body, flags=re.IGNORECASE)[0]
                
                # Find options: (a) ..., (b) ..., (c) ..., (d) ...
                # Sometimes options are on the same line: (a) Foo (b) Bar
                # Use regex to extract
                
                opt_a_match = re.search(r'\([aA]\)\s*(.*?)(?=\([bB]\)|\n|$)', q_body, re.DOTALL)
                opt_b_match = re.search(r'\([bB]\)\s*(.*?)(?=\([cC]\)|\n|$)', q_body, re.DOTALL)
                opt_c_match = re.search(r'\([cC]\)\s*(.*?)(?=\([dD]\)|\n|$)', q_body, re.DOTALL)
                opt_d_match = re.search(r'\([dD]\)\s*(.*?)(?=$)', q_body, re.DOTALL)
                
                if opt_a_match and opt_b_match and opt_c_match and opt_d_match:
                    q_text = q_body[:opt_a_match.start()].strip()
                    # Clean up q_text (remove trailing dots, newlines)
                    q_text = q_text.replace('\n', ' ').strip()
                    
                    o_a = opt_a_match.group(1).replace('\n', ' ').strip()
                    o_b = opt_b_match.group(1).replace('\n', ' ').strip()
                    o_c = opt_c_match.group(1).replace('\n', ' ').strip()
                    o_d = opt_d_match.group(1).replace('\n', ' ').strip()
                    
                    correct_ans = ans_dict.get(q_num, 0) # default to 0 if not found
                    
                    questions_list.append({
                        "q": q_text,
                        "o": [o_a, o_b, o_c, o_d],
                        "a": correct_ans
                    })
            
            if questions_list:
                final_data.append({
                    "topic": topic_name.title(),
                    "questions": questions_list
                })
                
    print(f"Extracted {len(final_data)} topics.")
    total_q = sum(len(t["questions"]) for t in final_data)
    print(f"Total questions: {total_q}")
    
    # Save to questions.js
    js_content = "const QUESTIONS_DATA = " + json.dumps(final_data, indent=4) + ";\n"
    with open('questions.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print("Saved to questions.js")

if __name__ == "__main__":
    parse_mcq()
