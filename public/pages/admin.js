document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-dashboard-screen').style.display = 'flex';
        fetchAdminTests();
        renderTopicConfigUI();
    }
});

function adminLogin() {
    const pass = document.getElementById('admin-pass-input').value;
    const err = document.getElementById('admin-error-msg');
    if (pass === 'ITI@345001') { 
        localStorage.setItem('adminLoggedIn', 'true');
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-dashboard-screen').style.display = 'flex';
        fetchAdminTests();
        renderTopicConfigUI();
    } else {
        err.textContent = "Access Denied: Invalid Credentials";
        err.style.display = "block";
    }
}

function adminLogout() {
    localStorage.removeItem('adminLoggedIn');
    window.location.href = 'landing.html';
}

function showTab(tabName, element) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    else {
        document.querySelectorAll('.menu-item').forEach(el => {
            if(el.textContent.toLowerCase().includes(tabName)) el.classList.add('active');
        });
    }
    
    document.getElementById('tab-overview').style.display = tabName === 'overview' ? 'block' : 'none';
    document.getElementById('tab-create').style.display = tabName === 'create' ? 'block' : 'none';
    document.getElementById('tab-results').style.display = tabName === 'results' ? 'block' : 'none';
    
    const ts = document.getElementById('tab-students');
    if(ts) ts.style.display = tabName === 'students' ? 'block' : 'none';
    
    if (tabName === 'overview' || tabName === 'results') {
        fetchAdminTests();
    }
    if (tabName === 'students' && typeof fetchAdminStudents === 'function') {
        fetchAdminStudents();
    }
}

let allTestsData = [];
let currentAdminTestCode = null;
let adminLivePollTimer = null;

async function fetchAdminTests() {
    try {
        const { data: dbTests, error } = await supabaseClient.from('tests').select('*');
        if (error) throw error;
        
        allTestsData = dbTests.map(t => ({ code: t.code, ...t.data }));
        allTestsData.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        updateOverviewStats();
        renderOverviewTable();
        renderResultsSidebar();
        
        if (currentAdminTestCode) {
            viewTestResults(currentAdminTestCode);
        }
    } catch (e) {
        console.error("Failed to fetch tests", e);
    }
}

function updateOverviewStats() {
    document.getElementById('stat-total-tests').textContent = allTestsData.length;
    let totalSubs = 0;
    let totalLive = 0;
    allTestsData.forEach(t => {
        totalSubs += (t.students || []).length;
        totalLive += Object.keys(t.liveStudents || {}).length;
    });
    document.getElementById('stat-total-subs').textContent = totalSubs;
    document.getElementById('stat-live-students').textContent = totalLive;
}

function renderOverviewTable() {
    const tbody = document.getElementById('overview-test-list');
    if (allTestsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">No assessments deployed yet.</td></tr>';
        return;
    }
    
    tbody.innerHTML = allTestsData.map(t => {
        const d = new Date(t.createdAt).toLocaleDateString();
        let badgeClass = t.isActive === 'stopped' ? 'status-archived' : t.isActive === 'hold' ? 'status-hold' : 'status-active';
        let badgeText = t.isActive === 'stopped' ? 'Archived' : t.isActive === 'hold' ? 'On Hold' : 'Live Active';
        
        return `
        <tr>
            <td style="font-weight: 600;">${escapeHTML(t.name)}</td>
            <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; letter-spacing: 1px; color: var(--accent);">${t.code}</td>
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td>${t.duration} min</td>
            <td style="color: var(--text-muted);">${d}</td>
            <td>
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="viewTestResults('${t.code}'); showTab('results');">Analyze</button>
            </td>
        </tr>
        `;
    }).join('');
}

function renderResultsSidebar() {
    const list = document.getElementById('results-test-list');
    if (allTestsData.length === 0) {
        list.innerHTML = '<div style="color: var(--text-muted); text-align:center; padding: 20px;">No tests</div>';
        return;
    }
    
    list.innerHTML = allTestsData.map(t => `
        <div class="menu-item ${currentAdminTestCode === t.code ? 'active' : ''}" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; border: 1px solid ${currentAdminTestCode === t.code ? 'var(--accent)' : 'transparent'}; background: ${currentAdminTestCode === t.code ? 'var(--accent-glow)' : 'rgba(15,23,42,0.02)'};" onclick="viewTestResults('${t.code}')">
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text);">${escapeHTML(t.name)}</div>
            <div style="font-size: 0.8rem; font-family: monospace; color: var(--accent-light);">${t.code}</div>
        </div>
    `).join('');
}

async function setTestStatus(code, newStatus) {
    let actionText = newStatus === 'hold' ? 'PAUSE' : newStatus === 'active' ? 'RESUME' : 'ARCHIVE';
    if(!confirm(`Are you sure you want to ${actionText} this assessment?`)) return;
    try {
        const { data: dbTest } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (dbTest) {
            dbTest.data.isActive = newStatus;
            await supabaseClient.from('tests').update({ data: dbTest.data }).eq('code', code);
        }
        fetchAdminTests();
    } catch(e) { alert("Action failed"); }
}

async function deleteTest(code) {
    if(!confirm("DANGER: Are you sure you want to PERMANENTLY DELETE this assessment and all its data?")) return;
    try {
        await supabaseClient.from('tests').delete().eq('code', code);
        currentAdminTestCode = null;
        document.getElementById('results-header').style.display = 'none';
        document.getElementById('results-table-container').style.display = 'none';
        document.getElementById('results-empty-state').style.display = 'flex';
        fetchAdminTests();
    } catch(e) { alert("Delete failed"); }
}

function viewTestResults(code) {
    currentAdminTestCode = code;
    renderResultsSidebar(); // update active state
    
    document.getElementById('results-empty-state').style.display = 'none';
    const header = document.getElementById('results-header');
    const table = document.getElementById('results-table-container');
    header.style.display = 'block';
    table.style.display = 'flex';
    
    const test = allTestsData.find(t => t.code === code);
    if (!test) return;

    const liveCount = Object.keys(test.liveStudents || {}).length;
    const compCount = (test.students || []).length;
    
    let actionsHtml = '';
    if (test.isActive === 'stopped') {
        actionsHtml = `<span class="status-badge status-archived">Archived</span>`;
    } else if (test.isActive === 'hold') {
        actionsHtml = `
            <button class="btn btn-outline" style="padding: 8px 16px; font-size: 0.85rem; border-color: var(--green); color: var(--green);" onclick="setTestStatus('${code}', 'active')">▶ Resume</button>
            <button class="btn btn-outline" style="padding: 8px 16px; font-size: 0.85rem; border-color: var(--red); color: var(--red);" onclick="setTestStatus('${code}', 'stopped')">⏹ Archive</button>
        `;
    } else {
        actionsHtml = `
            <button class="btn btn-outline" style="padding: 8px 16px; font-size: 0.85rem; border-color: var(--yellow); color: var(--yellow);" onclick="setTestStatus('${code}', 'hold')">⏸ Pause Test</button>
            <button class="btn btn-outline" style="padding: 8px 16px; font-size: 0.85rem; border-color: var(--red); color: var(--red);" onclick="setTestStatus('${code}', 'stopped')">⏹ Archive</button>
        `;
    }

    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <h2 style="font-size: 1.8rem; margin-bottom: 8px;">${escapeHTML(test.name)}</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; font-family: monospace;">Access Code: <strong style="color: var(--accent);">${code}</strong> • Duration: ${test.duration}m</p>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                ${actionsHtml}
                <button class="btn btn-primary" style="padding: 8px 16px; font-size: 0.85rem; background: var(--red); border: none; color: white;" onclick="deleteTest('${code}')">🗑️ Delete</button>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px;">
            <div style="background: rgba(15,23,42,0.02); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Total Participants</div>
                <div style="font-size: 1.8rem; font-weight: 700;">${liveCount + compCount}</div>
            </div>
            <div style="background: rgba(15,23,42,0.02); padding: 16px; border-radius: var(--radius-sm); border: 1px solid rgba(245, 158, 11, 0.2);">
                <div style="font-size: 0.8rem; color: var(--yellow); text-transform: uppercase;">Currently Live</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: var(--yellow);">${liveCount}</div>
            </div>
            <div style="background: rgba(15,23,42,0.02); padding: 16px; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.2);">
                <div style="font-size: 0.8rem; color: var(--green); text-transform: uppercase;">Completed</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: var(--green);">${compCount}</div>
            </div>
        </div>
    `;
    
    const tbody = document.getElementById('results-student-list');
    let html = '';
    
    // Live students
    if (test.liveStudents) {
        Object.values(test.liveStudents).forEach(s => {
            html += `
            <tr>
                <td style="font-weight: 600;">${escapeHTML(s.studentName)}</td>
                <td><span class="status-badge status-hold" style="background: transparent; border: none; padding:0;">Live Testing</span></td>
                <td style="color: var(--text-muted);">-</td>
                <td style="color: var(--text-muted);">-</td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">Joined: ${new Date(s.joinedAt).toLocaleTimeString()}</td>
            </tr>
            `;
        });
    }
    
    // Completed students
    const sorted = [...(test.students || [])].sort((a,b)=>b.score-a.score);
    sorted.forEach(s => {
        const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
        const accColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
        html += `
        <tr>
            <td style="font-weight: 600;">${escapeHTML(s.studentName)}</td>
            <td><span class="status-badge status-active" style="background: transparent; border: none; padding:0;">Submitted</span></td>
            <td style="font-weight: 700;">${s.score} / ${s.total}</td>
            <td style="color: ${accColor}; font-weight: 600;">${pct}%</td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${new Date(s.submittedAt).toLocaleTimeString()}</td>
        </tr>
        `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No student data available.</td></tr>';
}

async function generateTest() {
    const name = document.getElementById('new-test-name').value || 'Untitled Assessment';
    const duration = parseInt(document.getElementById('new-test-duration').value) || 30;
    
    let config = {};
    let totalQuestions = 0;
    QUESTIONS_DATA.forEach((t, idx) => {
        let alloc = parseInt(document.getElementById(`topic-range-${idx}`).value) || 0;
        if (alloc > 0) {
            config[t.topic] = alloc;
            totalQuestions += alloc;
        }
    });

    if (totalQuestions === 0) {
        alert("Please select at least 1 question from any topic.");
        return;
    }

    const testCode = Array.from({length: 6}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random()*36)]).join('');
    const testData = { name, duration, topicConfig: config, createdAt: new Date().toISOString(), isActive: 'active' };

    try {
        await supabaseClient.from('tests').insert({ code: testCode, data: testData });
        document.getElementById('test-creation-result').style.display = 'block';
        document.getElementById('generated-test-code').textContent = testCode;
        fetchAdminTests();
    } catch(e) { alert('Failed to deploy assessment'); }
}

function exportCurrentCSV() {
    if (!currentAdminTestCode) return;
    const test = allTestsData.find(t => t.code === currentAdminTestCode);
    if (!test) return;
    
    let csv = 'Status,Student Name,Email,Score,Total Possible,Percentage,Time\\n';
    
    (test.students || []).forEach(s => {
        const d = new Date(s.submittedAt).toLocaleString().replace(/,/g, '');
        const p = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
        csv += `"Completed","${escapeHTML(s.studentName)}","${s.studentEmail}","${s.score}","${s.total}","${p}%","${d}"\\n`;
    });
    
    if (test.liveStudents) {
        Object.values(test.liveStudents).forEach(s => {
            const d = new Date(s.joinedAt).toLocaleString().replace(/,/g, '');
            csv += `"Live","${escapeHTML(s.studentName)}","${s.studentEmail}","N/A","N/A","N/A","${d}"\\n`;
        });
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `${test.name}_Analytics.csv`;
    a.click();
}

// Start auto-poll
setInterval(() => {
    if (document.getElementById('admin-dashboard-screen').style.display !== 'none') {
        fetchAdminTests();
    }
}, 5000);

// --- New Features ---

function renderTopicConfigUI() {
    const container = document.getElementById('topic-config-container');
    if (!container || typeof QUESTIONS_DATA === 'undefined') return;
    let html = '';
    QUESTIONS_DATA.forEach((topic, idx) => {
        const initialVal = Math.min(10, topic.questions.length);
        html += `
            <div style="background: rgba(15, 23, 42, 0.02); border: 1px solid var(--border); padding: 15px; border-radius: var(--radius-sm);">
                <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 10px; color: var(--text);">${escapeHTML(topic.topic)}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">
                    <span>0</span>
                    <span>Max: ${topic.questions.length}</span>
                </div>
                <input type="range" id="topic-range-${idx}" min="0" max="${topic.questions.length}" value="${initialVal}" class="modern-input" style="width: 100%; padding: 0; cursor: pointer;" oninput="updateTotalQuestions()">
                <div style="text-align: center; font-weight: bold; margin-top: 8px; color: var(--accent);" id="topic-val-${idx}">${initialVal}</div>
            </div>
        `;
    });
    container.innerHTML = html;
    updateTotalQuestions();
}

function updateTotalQuestions() {
    let total = 0;
    if (typeof QUESTIONS_DATA === 'undefined') return;
    QUESTIONS_DATA.forEach((topic, idx) => {
        const rangeEl = document.getElementById(`topic-range-${idx}`);
        if(rangeEl) {
            const val = parseInt(rangeEl.value) || 0;
            document.getElementById(`topic-val-${idx}`).textContent = val;
            total += val;
        }
    });
    const totalEl = document.getElementById('total-questions-count');
    if(totalEl) totalEl.textContent = total;
}

async function fetchAdminStudents() {
    try {
        const { data, error } = await supabaseClient.from('students').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const tbody = document.getElementById('admin-students-list');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">No registered students found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(function(s) {
            return '<tr>' +
                '<td style="font-weight: 600;">' + escapeHTML(s.name) + '</td>' +
                '<td>' + escapeHTML(s.email) + '</td>' +
                '<td style="font-family: monospace;">' + escapeHTML(s.password) + '</td>' +
                '<td style="color: var(--text-muted);">' + new Date(s.created_at).toLocaleString() + '</td>' +
                '<td>' +
                    '<button class="btn btn-outline" style="border-color: var(--red); color: var(--red); padding: 6px 12px; font-size: 0.8rem;" onclick="deleteStudent(\'' + s.id + '\')">\u{1F5D1}\uFE0F Delete</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    } catch(e) {
        console.error(e);
    }
}

async function deleteStudent(id) {
    if(!confirm("Are you sure you want to permanently delete this student account?")) return;
    try {
        await supabaseClient.from('students').delete().eq('id', id);
        fetchAdminStudents();
    } catch(e) { alert("Failed to delete student"); }
}