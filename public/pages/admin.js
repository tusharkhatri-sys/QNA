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