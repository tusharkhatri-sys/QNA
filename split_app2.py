import os

pages_dir = r"c:\Users\tusha\OneDrive\Desktop\my_softwares\QNA\public\pages"

files = {
    "admin.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="../questions.js"></script>
</head>
<body>
    <div class="animated-bg"></div>
    <!-- Admin Login -->
    <div class="screen active" id="admin-login-screen">
        <div class="container" style="display: flex; justify-content: center; align-items: center; min-height: 100vh;">
            <div style="background: var(--surface); padding: 40px; border-radius: var(--radius-lg); border: 1px solid var(--border); width: 100%; max-width: 400px; text-align: center;">
                <h2 style="margin-bottom: 20px;">Admin Login</h2>
                <div id="admin-error-msg" style="color: var(--red); display: none; margin-bottom: 20px;"></div>
                <div class="form-group" style="text-align: left;">
                    <label>Admin Password</label>
                    <input type="password" id="admin-pass-input" placeholder="Enter password" class="input-field">
                </div>
                <button class="btn btn-primary" style="width: 100%;" onclick="adminLogin()">Login</button>
                <div style="margin-top: 20px;"><a href="landing.html" style="color: var(--text-muted);">Back to Home</a></div>
            </div>
        </div>
    </div>
    
    <!-- Admin Dashboard -->
    <div class="screen" id="admin-dashboard-screen">
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <div class="logo-icon" style="background:var(--accent);">A</div>
                    <span>Admin Panel</span>
                </div>
                <button class="btn btn-outline" onclick="adminLogout()">Logout</button>
            </div>
        </header>
        <div class="container" style="padding-top: 100px;">
            <div style="display: grid; grid-template-columns: 350px 1fr; gap: 30px;">
                <!-- Left Sidebar -->
                <div>
                    <button class="btn btn-primary" style="width: 100%; margin-bottom: 20px; font-size: 1.1rem; padding: 16px;" onclick="showAdminTab('create')">+ Create New Test</button>
                    <button class="btn btn-outline" style="width: 100%; margin-bottom: 20px; font-size: 1.1rem; padding: 16px;" onclick="showAdminTab('results')">📊 View Past Results</button>
                    <div style="background: var(--surface); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <h3 style="margin-bottom: 16px; font-size: 1.1rem; color: var(--text-secondary);">Active Tests</h3>
                        <div id="admin-test-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto;">
                            <div style="color: var(--text-muted); text-align: center; padding: 20px 0;">Loading...</div>
                        </div>
                    </div>
                </div>
                <!-- Right Content -->
                <div style="background: var(--surface); padding: 30px; border-radius: var(--radius-lg); border: 1px solid var(--border); min-height: 600px;">
                    <!-- Create Tab -->
                    <div id="admin-tab-create">
                        <h2 style="margin-bottom: 20px; font-size: 1.8rem;">Create Custom Test</h2>
                        <div class="form-group">
                            <label>Test Name / Title</label>
                            <input type="text" id="new-test-name" class="input-field" placeholder="e.g. Weekly Assessment - Batch A">
                        </div>
                        <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <label>Duration (Minutes)</label>
                                <input type="number" id="new-test-duration" class="input-field" value="30" min="5" max="180">
                            </div>
                            <div>
                                <label>Total Questions</label>
                                <input type="number" id="new-test-count" class="input-field" value="50" disabled style="background: var(--bg); opacity: 0.7;">
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="generateTest()" style="margin-top: 20px;">Create & Go Live</button>
                        <div id="test-creation-result" style="margin-top: 20px; padding: 20px; background: rgba(0,206,201,0.1); border: 1px dashed var(--primary); border-radius: var(--radius-md); display: none; text-align: center;">
                            <p style="color: var(--text-secondary); margin-bottom: 10px;">Test generated successfully! Share this code with students:</p>
                            <div id="generated-test-code" style="font-family: 'JetBrains Mono', monospace; font-size: 2.5rem; font-weight: 800; color: var(--primary); letter-spacing: 4px;"></div>
                        </div>
                    </div>
                    <!-- Results Tab -->
                    <div id="admin-tab-results" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid var(--border);" id="admin-results-header">
                            <h3 style="font-size: 1.1rem; color: var(--text-muted);">Select a test from the sidebar to view results</h3>
                        </div>
                        <div id="admin-student-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="shared.js"></script>
    <script src="admin.js"></script>
</body>
</html>
""",
    "admin.js": """
function adminLogin() {
    const pass = document.getElementById('admin-pass-input').value;
    const err = document.getElementById('admin-error-msg');
    if (pass === 'admin123') { // Hardcoded for demo, normally backend validates
        document.getElementById('admin-login-screen').classList.remove('active');
        document.getElementById('admin-dashboard-screen').classList.add('active');
        fetchAdminTests();
    } else {
        err.textContent = "Invalid Password";
        err.style.display = "block";
    }
}

function adminLogout() {
    window.location.href = 'landing.html';
}

function showAdminTab(tab) {
    document.getElementById('admin-tab-create').style.display = tab === 'create' ? 'block' : 'none';
    document.getElementById('admin-tab-results').style.display = tab === 'results' ? 'block' : 'none';
}

async function fetchAdminTests() {
    try {
        const { data: dbTests, error } = await supabaseClient.from('tests').select('*');
        if (error) throw error;
        
        let tests = dbTests.map(t => ({ code: t.code, ...t.data }));
        tests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const list = document.getElementById('admin-test-list');
        if (tests.length === 0) {
            list.innerHTML = '<div style="color: var(--text-muted); text-align:center;">No tests found</div>';
            return;
        }
        
        list.innerHTML = tests.map(t => `
            <div class="admin-list-item" style="padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;" onclick="viewTestResults('${t.code}')">
                <div style="font-weight: 600; margin-bottom: 4px;">${escapeHTML(t.name)}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                    <span>${t.code}</span>
                    <span style="color: ${t.isActive === 'stopped' ? 'var(--red)' : t.isActive === 'hold' ? 'var(--yellow)' : 'var(--green)'}">
                        ${t.isActive === 'stopped' ? 'Archived' : t.isActive === 'hold' ? 'Paused' : 'Active'}
                    </span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to fetch admin tests", e);
    }
}

let currentAdminTestCode = null;

async function viewTestResults(code) {
    showAdminTab('results');
    currentAdminTestCode = code;
    try {
        const { data: dbTest, error } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (error || !dbTest) return;
        const test = { code, ...dbTest.data };

        const liveCount = Object.keys(test.liveStudents || {}).length;
        const compCount = (test.students || []).length;
        
        document.getElementById('admin-results-header').innerHTML = `
            <div>
                <h3>${escapeHTML(test.name)} (${code})</h3>
                <p>Status: ${test.isActive}</p>
                <button onclick="deleteTest('${code}')">Delete</button>
            </div>
            <div>Joined: ${liveCount + compCount} | Live: ${liveCount} | Completed: ${compCount}</div>
        `;
        
        const slist = document.getElementById('admin-student-list');
        let html = (test.students || []).map(s => `<div style="padding:10px; border:1px solid var(--border);">${s.studentName} - Score: ${s.score}/${s.total}</div>`).join('');
        slist.innerHTML = html || 'No completions yet.';
    } catch(e) {}
}

async function generateTest() {
    const name = document.getElementById('new-test-name').value || 'Untitled Test';
    const duration = parseInt(document.getElementById('new-test-duration').value) || 30;
    
    // Quick random allocation logic
    const totalTopics = QUESTIONS_DATA.length;
    let config = {};
    let remaining = 50;
    QUESTIONS_DATA.forEach((t, idx) => {
        let alloc = idx === totalTopics - 1 ? remaining : Math.floor(50 / totalTopics);
        config[t.topic] = alloc;
        remaining -= alloc;
    });

    const testCode = Array.from({length: 6}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random()*36)]).join('');
    
    const testData = {
        name, duration, topicConfig: config,
        createdAt: new Date().toISOString(), isActive: 'active'
    };

    try {
        await supabaseClient.from('tests').insert({ code: testCode, data: testData });
        document.getElementById('test-creation-result').style.display = 'block';
        document.getElementById('generated-test-code').textContent = testCode;
        fetchAdminTests();
    } catch(e) { alert('Failed to create test'); }
}

async function deleteTest(code) {
    if(!confirm("Delete this test forever?")) return;
    try {
        await supabaseClient.from('tests').delete().eq('code', code);
        document.getElementById('admin-results-header').innerHTML = 'Select a test';
        document.getElementById('admin-student-list').innerHTML = '';
        fetchAdminTests();
    } catch(e) {}
}
"""
}

import codecs
for filename, content in files.items():
    path = os.path.join(pages_dir, filename)
    with codecs.open(path, "w", "utf-8") as f:
        f.write(content.strip())

print("Added admin files to public/pages/")
