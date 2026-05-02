from pypdf import PdfReader
import re
import json

def parse_pdf():
    reader = PdfReader('copa 2000 .pdf')
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"
        
    with open('extracted_text.txt', 'w', encoding='utf-8') as f:
        f.write(full_text)


    topics = []
    
    # We will try to find lines like "1.1 Basic hardware and software" or just parse questions globally.
    # Pattern for questions: "number. Question text (a) option (b) option (c) option (d) option"
    # Pattern for answers: "number. (letter)"
    
    print("Extracted", len(full_text), "characters.")

if __name__ == '__main__':
    parse_pdf()
