// ===== State =====
let currentMode = 'topic';
let currentQuiz = [];
let currentIndex = 0;
let userAnswers = {};
let score = 0;
let randomCount = 50;
let lastTopicId = null;
let reviewFilter = 'all';

// ===== Live Test State =====
let isLiveTest = false;
let currentLiveCode = null;
let currentStudentName = null;
let liveTestTimer = null;
let timeRemaining = 0;

// ===== Auth State =====
let loggedInStudent = null;
let authMode = 'login'; // 'login' or 'register'

// ===== Admin State =====
let adminStudentsList = [];

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    const totalQ = QUESTIONS_DATA.reduce((s, t) => s + t.questions.length, 0);
    const totalSub = QUESTIONS_DATA.reduce((s, t) => s + (t.subtopics?.length || 0), 0);
    animateCount('total-questions-count', totalQ);
    animateCount('total-topics-count', QUESTIONS_DATA.length);
    animateCount('total-subtopics-count', totalSub);
    renderTopics();
    updateModeSlider();

    const savedStudent = localStorage.getItem('loggedInStudent');
    if (savedStudent) {
        try {
            loggedInStudent = JSON.parse(savedStudent);
            const nameInput = document.getElementById('student-name-input');
            if (nameInput) nameInput.value = loggedInStudent.name;
        } catch(e){}
    }
});

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.ceil(target / 40);
    const interval = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(interval);
    }, 30);
}

// ===== Screen Navigation =====
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
}
function showLanding() { showScreen('main-portal-screen'); }
function showStudentDashboard() { showScreen('student-dashboard-screen'); }
function showTopicScreen() { 
    showScreen('topic-screen'); 
    setTimeout(updateModeSlider, 10);
}
function showResults() { showScreen('results-screen'); }

// ===== Mode Toggle =====
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    updateModeSlider();
    document.getElementById('topics-grid').classList.toggle('hidden', mode !== 'topic');
    document.getElementById('all-mode-panel').classList.toggle('hidden', mode !== 'all');
    document.getElementById('random-mode-panel').classList.toggle('hidden', mode !== 'random');
}

function updateModeSlider() {
    const active = document.querySelector('.mode-btn.active');
    const slider = document.querySelector('.mode-slider');
    if (active && slider) {
        slider.style.width = active.offsetWidth + 'px';
        slider.style.left = active.offsetLeft + 'px';
    }
}

function setRandomCount(n) {
    randomCount = n;
    document.querySelectorAll('.count-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === n));
}

let topicConfigTopicId = null;
let topicConfigCount = 10;

function openTopicConfig(topicIndex) {
    topicConfigTopicId = topicIndex;
    const t = QUESTIONS_DATA[topicIndex];
    document.getElementById('topic-config-name').textContent = t.topic;
    document.getElementById('topic-config-desc').textContent = `Total questions available: ${t.questions.length}`;
    
    const counts = [10, 25, 50, 100, t.questions.length];
    const uniqueCounts = [...new Set(counts.filter(c => c <= t.questions.length))];
    if (!uniqueCounts.includes(t.questions.length)) uniqueCounts.push(t.questions.length);
    
    topicConfigCount = uniqueCounts[0] || t.questions.length;
    
    document.getElementById('topic-count-btns').innerHTML = uniqueCounts.map(c => `
        <button class="count-btn ${c === topicConfigCount ? 'active' : ''}" onclick="setTopicCount(${c}, this)">${c === t.questions.length ? 'All (' + c + ')' : c}</button>
    `).join('');
    
    document.getElementById('topic-config-modal').style.display = 'flex';
}

function setTopicCount(n, btn) {
    topicConfigCount = n;
    document.querySelectorAll('#topic-count-btns .count-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function closeTopicConfig() {
    document.getElementById('topic-config-modal').style.display = 'none';
}

function startConfiguredTopicQuiz() {
    closeTopicConfig();
    startQuiz('topic', topicConfigTopicId);
}

// ===== Render Topics =====
const TOPIC_ICONS = ['💻','🔧','🖥️','📝','📊','📽️','🖼️','🗄️','🌐','🌍'];

function renderTopics() {
    const grid = document.getElementById('topics-grid');
    grid.innerHTML = QUESTIONS_DATA.map((t, i) => `
        <div class="topic-card" onclick="openTopicConfig(${i})">
            <div class="topic-icon">${TOPIC_ICONS[i] || '📚'}</div>
            <div class="topic-name">${t.topic}</div>
            <div class="topic-count">${t.questions.length} questions</div>
            ${t.subtopics ? `<div class="topic-subtopics">${t.subtopics.slice(0, 4).map(s => `<span class="topic-subtag">${s}</span>`).join('')}${t.subtopics.length > 4 ? `<span class="topic-subtag">+${t.subtopics.length - 4}</span>` : ''}</div>` : ''}
        </div>
    `).join('');
}

// ===== Start Quiz =====
function startQuiz(mode, topicIndex) {
    userAnswers = {};
    score = 0;
    currentIndex = 0;

    if (mode === 'topic') {
        lastTopicId = topicIndex;
        let pool = [...QUESTIONS_DATA[topicIndex].questions];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        currentQuiz = pool.slice(0, Math.min(topicConfigCount || pool.length, pool.length)).map((q, i) => ({ ...q, _idx: i }));
        document.getElementById('quiz-topic-name').textContent = QUESTIONS_DATA[topicIndex].topic;
    } else if (mode === 'all') {
        lastTopicId = null;
        currentQuiz = [];
        QUESTIONS_DATA.forEach(t => t.questions.forEach((q, i) => currentQuiz.push({ ...q, _idx: currentQuiz.length })));
        document.getElementById('quiz-topic-name').textContent = 'All Questions';
    } else if (mode === 'random') {
        lastTopicId = null;
        let all = [];
        QUESTIONS_DATA.forEach(t => t.questions.forEach(q => all.push({ ...q })));
        // Shuffle
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
        }
        currentQuiz = all.slice(0, Math.min(randomCount, all.length)).map((q, i) => ({ ...q, _idx: i }));
        document.getElementById('quiz-topic-name').textContent = `Random (${currentQuiz.length})`;
    }

    document.getElementById('quiz-timer').style.display = 'none';
    document.getElementById('quiz-score').textContent = '0';
    const scoreBadge = document.querySelector('.quiz-score-badge');
    if (scoreBadge) scoreBadge.style.display = 'flex';
    showScreen('quiz-screen');
    renderQuestion();
}

// ===== Render Question =====
function renderQuestion() {
    const q = currentQuiz[currentIndex];
    const card = document.getElementById('question-card');
    card.style.animation = 'none';
    card.offsetHeight; // reflow
    card.style.animation = 'slideUp 0.35s ease';

    document.getElementById('question-number').textContent = `Q${currentIndex + 1}`;
    
    const questionHTML = q.q_hi ? `${escapeHTML(q.q)}<br><span style="color:var(--text-secondary); font-size: 0.9em; margin-top: 8px; display: block;">${escapeHTML(q.q_hi)}</span>` : escapeHTML(q.q);
    document.getElementById('question-text').innerHTML = questionHTML;
    
    document.getElementById('quiz-counter').textContent = `${currentIndex + 1} / ${currentQuiz.length}`;
    document.getElementById('quiz-progress-fill').style.width = `${((currentIndex + 1) / currentQuiz.length) * 100}%`;

    const letters = ['A', 'B', 'C', 'D'];
    const optList = document.getElementById('options-list');
    optList.innerHTML = q.o.map((opt, i) => {
        let cls = 'option-btn';
        const answered = userAnswers[currentIndex] !== undefined;
        if (answered) {
            if (!isLiveTest) {
                cls += ' disabled';
                if (i === q.a) cls += ' correct';
                if (i === userAnswers[currentIndex] && i !== q.a) cls += ' wrong';
            } else {
                if (i === userAnswers[currentIndex]) cls += ' selected';
            }
        }
        
        const optText = (q.o_hi && q.o_hi[i]) ? `${escapeHTML(opt)} <span style="color:var(--text-secondary); font-size: 0.9em; margin-left: 8px;">(${escapeHTML(q.o_hi[i])})</span>` : escapeHTML(opt);
        
        return `<button class="${cls}" ${answered && !isLiveTest ? 'disabled' : ''} onclick="selectOption(${i})" id="opt-${i}">
            <span class="option-letter">${letters[i]}</span>
            <span class="option-text">${optText}</span>
        </button>`;
    }).join('');

    // Nav buttons
    document.getElementById('btn-prev').disabled = currentIndex === 0;
    const btnNext = document.getElementById('btn-next');
    if (currentIndex === currentQuiz.length - 1) {
        btnNext.innerHTML = '<span>Finish</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
    } else {
        btnNext.innerHTML = '<span>Next</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    }
}

function selectOption(i) {
    if (userAnswers[currentIndex] !== undefined && !isLiveTest) return;
    
    const q = currentQuiz[currentIndex];
    userAnswers[currentIndex] = i;

    let newScore = 0;
    currentQuiz.forEach((qItem, idx) => {
        if (userAnswers[idx] === qItem.a) newScore++;
    });
    score = newScore;
    
    if (!isLiveTest) {
        // Disable all options
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.add('disabled');
            btn.disabled = true;
        });
        document.getElementById('quiz-score').textContent = score;
        // Show correct/wrong
        document.querySelectorAll('.option-btn').forEach((btn, idx) => {
            if (idx === q.a) btn.classList.add('correct');
            if (idx === i && idx !== q.a) btn.classList.add('wrong');
        });
    } else {
        // Just mark as selected
        document.querySelectorAll('.option-btn').forEach((btn, idx) => {
            btn.classList.remove('selected');
            if (idx === i) btn.classList.add('selected');
        });
        reportLiveProgress();
    }
}

function nextQuestion() {
    if (currentIndex < currentQuiz.length - 1) {
        currentIndex++;
        renderQuestion();
    } else {
        showResultsScreen();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderQuestion();
    }
}

function exitQuiz() {
    if (Object.keys(userAnswers).length > 0) {
        if (!confirm('Are you sure you want to exit? Your progress will be lost.')) return;
    }
    showTopicScreen();
}

// ===== Results =====
function showResultsScreen() {
    const total = currentQuiz.length;
    const correct = score;
    const answered = Object.keys(userAnswers).length;
    const wrong = answered - correct;
    const skipped = total - answered;
    const pct = Math.round((correct / total) * 100);

    document.getElementById('correct-count').textContent = correct;
    document.getElementById('wrong-count').textContent = wrong;
    document.getElementById('skipped-count').textContent = skipped;
    document.getElementById('score-percent').textContent = pct + '%';

    // Ring animation
    const circumference = 326.73;
    const offset = circumference - (pct / 100) * circumference;
    const ring = document.getElementById('score-ring-fill');
    ring.style.strokeDashoffset = circumference;
    
    // Icon & title
    let icon, title, color;
    if (pct >= 80) { icon = '🏆'; title = 'Excellent!'; color = 'var(--green)'; }
    else if (pct >= 60) { icon = '👍'; title = 'Good Job!'; color = 'var(--accent-light)'; }
    else if (pct >= 40) { icon = '📖'; title = 'Keep Practicing!'; color = 'var(--yellow)'; }
    else { icon = '💪'; title = 'Don\'t Give Up!'; color = 'var(--red)'; }

    document.getElementById('results-icon').textContent = icon;
    document.getElementById('results-title').textContent = title;
    document.getElementById('results-subtitle').textContent = `You scored ${correct} out of ${total}`;
    ring.style.stroke = color;

    if (isLiveTest) {
        submitLiveTestResults();
    }
    
    showScreen('results-screen');
    
    setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
    if (pct >= 60) spawnConfetti();
}

function spawnConfetti() {
    const container = document.getElementById('results-confetti');
    container.innerHTML = '';
    const colors = ['#6c5ce7', '#a29bfe', '#00cec9', '#feca57', '#ff6b6b', '#fd79a8'];
    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 2 + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(piece);
    }
}

function retryQuiz() {
    if (lastTopicId !== null) startQuiz('topic', lastTopicId);
    else startQuiz(currentMode === 'random' ? 'random' : 'all');
}

// ===== Review =====
function reviewAnswers() {
    reviewFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    renderReview();
    showScreen('review-screen');
}

function filterReview(filter) {
    reviewFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    renderReview();
}

function renderReview() {
    const list = document.getElementById('review-list');
    const letters = ['A', 'B', 'C', 'D'];
    let html = '';

    currentQuiz.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        const isCorrect = userAns === q.a;
        const isSkipped = userAns === undefined;
        let status = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'wrong');
        
        if (reviewFilter !== 'all' && reviewFilter !== status) return;

        const qHTML = q.q_hi ? `${escapeHTML(q.q)}<br><span style="color:var(--text-secondary); font-size: 0.9em;">${escapeHTML(q.q_hi)}</span>` : escapeHTML(q.q);

        html += `<div class="review-item review-${status}">
            <div class="review-q-number">Question ${idx + 1} — <span style="color:${status === 'correct' ? 'var(--green)' : status === 'wrong' ? 'var(--red)' : 'var(--yellow)'}">${status.toUpperCase()}</span></div>
            <div class="review-q-text">${qHTML}</div>
            <div class="review-options">${q.o.map((opt, i) => {
                let cls = 'review-opt';
                if (i === q.a) cls += ' is-correct';
                else if (i === userAns && i !== q.a) cls += ' is-wrong';
                
                const optText = (q.o_hi && q.o_hi[i]) ? `${escapeHTML(opt)} <span style="font-size: 0.9em; opacity: 0.8;">(${escapeHTML(q.o_hi[i])})</span>` : escapeHTML(opt);
                
                return `<div class="${cls}"><span class="review-opt-letter">${letters[i]}</span><span>${optText}</span></div>`;
            }).join('')}</div>
        </div>`;
    });

    list.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;padding:40px;">No questions match this filter.</p>';
}

// ==========================================
// ===== ADMIN & LIVE TEST SYSTEM =====
// ==========================================

// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://gxfojevrtvexfootbzjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Zm9qZXZydHZleGZvb3Riemp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDg5MTMsImV4cCI6MjA5MzAyNDkxM30.0MP9rW4UdOYT3irbPqCjY352g8vr1b92zymXeqsnD8w';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const API_URL = '/api';

// ===== Student Authentication =====
function handleStudentPortalClick() {
    if (loggedInStudent) {
        showStudentDashboard();
    } else {
        showScreen('auth-screen');
    }
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').textContent = authMode === 'login' ? 'Student Login' : 'Student Registration';
    document.getElementById('auth-subtitle').textContent = authMode === 'login' ? 'Login to access your dashboard' : 'Create an account to take tests';
    document.getElementById('auth-name-group').style.display = authMode === 'login' ? 'none' : 'block';
    document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-toggle-text').textContent = authMode === 'login' ? "Don't have an account?" : "Already have an account?";
    document.getElementById('auth-toggle-btn').textContent = authMode === 'login' ? 'Register' : 'Login';
    document.getElementById('auth-error-msg').style.display = 'none';
}

async function submitAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    const errEl = document.getElementById('auth-error-msg');
    const btn = document.getElementById('auth-submit-btn');
    
    if (!email || !password || (authMode === 'register' && !name)) {
        errEl.textContent = 'Please fill all required fields.';
        errEl.style.display = 'block';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Processing...';
    
    try {
        const url = authMode === 'login' ? '/api/students/login' : '/api/students/register';
        const body = authMode === 'login' ? { email, password } : { email, password, name };
        
        const res = await fetch(API_URL.replace('/api', '') + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        
        if (data.success) {
            if (authMode === 'login') {
                loggedInStudent = data.student;
                localStorage.setItem('loggedInStudent', JSON.stringify(loggedInStudent));
                const nameInput = document.getElementById('student-name-input');
                if (nameInput) nameInput.value = loggedInStudent.name;
                showStudentDashboard();
                errEl.style.display = 'none';
            } else {
                // Registration successful, but needs email confirmation
                errEl.textContent = data.message;
                errEl.style.color = 'var(--green)';
                errEl.style.display = 'block';
                // Switch back to login mode so they can login after confirming
                setTimeout(() => {
                    if (authMode === 'register') toggleAuthMode();
                    errEl.style.color = 'var(--red)'; // reset
                    errEl.style.display = 'none';
                }, 5000);
            }
        } else {
            errEl.style.color = 'var(--red)';
            errEl.textContent = data.message || 'Authentication failed.';
            errEl.style.display = 'block';
        }
    } catch (e) {
        errEl.textContent = 'Network error. Make sure server is running.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'Login' : 'Register';
    }
}

function logoutStudent() {
    loggedInStudent = null;
    localStorage.removeItem('loggedInStudent');
    showLanding();
}

function showAdminLogin() { showScreen('admin-login-screen'); }

function verifyAdmin() {
    const pass = document.getElementById('admin-pass-input').value;
    if (pass === 'ITI@345001') {
        showScreen('admin-dashboard-screen');
        renderAdminTopics();
        fetchAdminTests();
    } else {
        alert('Invalid Admin Password!');
    }
}

function switchAdminTab(tab) {
    const tabs = ['create', 'results', 'students'];
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`tab-${t}`);
        const tabContent = document.getElementById(`admin-tab-${t}`);
        if (tabBtn) tabBtn.classList.toggle('active', t === tab);
        if (tabContent) tabContent.style.display = t === tab ? 'block' : 'none';
    });
    
    if (tab === 'results') {
        fetchAdminTests();
    } else if (tab === 'students') {
        fetchStudents();
    } else {
        if (window.adminLivePollTimer) clearInterval(window.adminLivePollTimer);
    }
}

function renderAdminTopics() {
    const list = document.getElementById('admin-topics-list');
    list.innerHTML = QUESTIONS_DATA.map((t, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm);">
            <div>
                <strong>${t.topic}</strong>
                <div style="font-size:0.8rem; color:var(--text-muted);">${t.questions.length} total available</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <label style="font-size:0.85rem; color:var(--text-secondary);">Pick:</label>
                <input type="number" id="admin-topic-count-${i}" class="modern-input" style="width:80px; padding:8px;" value="0" min="0" max="${t.questions.length}" onchange="updateAdminTotal()">
            </div>
        </div>
    `).join('');
    updateAdminTotal();
}

function updateAdminTotal() {
    let total = 0;
    QUESTIONS_DATA.forEach((t, i) => {
        const val = parseInt(document.getElementById(`admin-topic-count-${i}`).value) || 0;
        total += val;
    });
    document.getElementById('admin-total-q-count').textContent = total;
}

async function generateTest() {
    const name = document.getElementById('new-test-name').value;
    const duration = parseInt(document.getElementById('new-test-time').value) || 30;
    
    let totalQ = 0;
    const topicConfig = {};
    QUESTIONS_DATA.forEach((t, i) => {
        const count = parseInt(document.getElementById(`admin-topic-count-${i}`).value) || 0;
        if (count > 0) {
            topicConfig[t.topic] = count;
            totalQ += count;
        }
    });
    
    if (totalQ === 0) return alert('Please select at least 1 question for the test.');
    if (!name) return alert('Please provide a test name.');

    try {
        const testCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        let testQuestions = [];
        
        // Generate random questions from local data
        for (const [topicName, count] of Object.entries(topicConfig)) {
            const topic = QUESTIONS_DATA.find(t => t.topic === topicName);
            if (topic) {
                const shuffled = [...topic.questions].sort(() => 0.5 - Math.random());
                testQuestions = testQuestions.concat(shuffled.slice(0, count));
            }
        }
        
        const testData = {
            name,
            duration,
            topicConfig,
            questions: testQuestions,
            students: [],
            liveStudents: {},
            isActive: 'active'
        };

        const { error } = await supabase.from('tests').insert({
            code: testCode,
            data: testData
        });

        if (error) throw error;

        document.getElementById('generated-code-display').textContent = testCode;
        document.getElementById('code-modal').style.display = 'flex';
        fetchAdminTests();
    } catch (e) {
        console.error(e);
        alert('Could not connect to Supabase database.');
    }
}

async function fetchAdminTests() {
    try {
        const { data: dbTests, error } = await supabase.from('tests').select('*');
        if (error) throw error;
        
        // Convert to array of test objects
        const tests = dbTests.map(t => ({ code: t.code, ...t.data }));
        const list = document.getElementById('admin-test-list');
        
        if (tests.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No tests generated yet.</p>';
            return;
        }
        
        list.innerHTML = tests.map(t => `
            <div class="admin-list-item" onclick="viewTestResults('${t.code}')">
                <div style="font-weight:600; margin-bottom:4px; ${t.isActive === false ? 'color:var(--text-muted);' : ''}">
                    ${t.name} ${t.isActive === false ? '<span style="font-size:0.7rem; color:var(--yellow); padding:2px 4px; border:1px solid var(--yellow); border-radius:4px; margin-left:8px;">STOPPED</span>' : ''}
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; justify-content:space-between;">
                    <span>Code: <strong style="color:var(--accent-light);">${t.code}</strong></span>
                    <span>${t.students.length} Submissions</span>
                </div>
            </div>
        `).join('');
    } catch (e) {}
}

async function fetchStudents() {
    try {
        const res = await fetch(`${API_URL}/students`);
        const students = await res.json();
        adminStudentsList = students || [];
        
        const list = document.getElementById('admin-students-list');
        if (!students || students.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No students registered yet.</td></tr>';
            return;
        }
        
        renderAdminStudents(students);
    } catch(e) {
        console.error(e);
        document.getElementById('admin-students-list').innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--red); padding:20px;">Failed to load students.</td></tr>';
    }
}

function renderAdminStudents(students) {
    const list = document.getElementById('admin-students-list');
    if (students.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No matching students found.</td></tr>';
        return;
    }
    list.innerHTML = students.map((s, idx) => `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px; font-weight: 500;">${escapeHTML(s.name)}</td>
                <td style="padding: 12px;">${escapeHTML(s.email)}</td>
                <td style="padding: 12px; color: var(--text); font-family: monospace;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="pwd-text-${idx}" style="letter-spacing: 2px;">••••••••</span>
                        <span id="pwd-val-${idx}" style="display: none;">${escapeHTML(s.password)}</span>
                        <button onclick="togglePasswordVisibility(${idx})" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 4px;">
                            <svg id="pwd-icon-${idx}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                    </div>
                </td>
                <td style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">${new Date(s.created_at).toLocaleString()}</td>
                <td style="padding: 12px;">
                    <button class="btn-ghost" style="color: var(--accent-light); padding: 4px 8px; font-size: 0.8rem; margin-right: 8px;" onclick="showAdminStudentAnalytics('${s.email}', '${escapeHTML(s.name)}')">Analytics</button>
                    <button class="btn-ghost" style="color: var(--red); padding: 4px 8px; font-size: 0.8rem;" onclick="deleteStudent('${s.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
}

function filterAdminStudents() {
    const query = document.getElementById('admin-student-search').value.toLowerCase();
    const filtered = adminStudentsList.filter(s => 
        (s.name && s.name.toLowerCase().includes(query)) || 
        (s.email && s.email.toLowerCase().includes(query))
    );
    renderAdminStudents(filtered);
}

function exportStudentsCSV() {
    if (adminStudentsList.length === 0) return alert('No students to export.');
    let csv = 'Name,Email,Joined Date\\n';
    adminStudentsList.forEach(s => {
        const date = new Date(s.created_at).toLocaleString().replace(/,/g, '');
        csv += `"${s.name}","${s.email}","${date}"\\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'registered_students.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function togglePasswordVisibility(idx) {
    const pwdText = document.getElementById(`pwd-text-${idx}`);
    const pwdVal = document.getElementById(`pwd-val-${idx}`).textContent;
    const icon = document.getElementById(`pwd-icon-${idx}`);
    
    if (pwdText.textContent === '••••••••') {
        pwdText.textContent = pwdVal;
        pwdText.style.letterSpacing = 'normal';
        pwdText.style.color = 'var(--red)';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        pwdText.textContent = '••••••••';
        pwdText.style.letterSpacing = '2px';
        pwdText.style.color = 'var(--text)';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

async function deleteStudent(id) {
    if(!confirm("Are you sure you want to delete this student?")) return;
    try {
        await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
        fetchStudents();
    } catch(e) {
        alert("Delete failed");
    }
}

async function showAdminStudentAnalytics(email, name) {
    // Show loading state immediately
    document.getElementById('admin-analytics-content').innerHTML = '<div style="text-align:center; padding: 40px;"><p style="color:var(--text-muted);">Loading analytics for ' + escapeHTML(name) + '...</p></div>';
    document.getElementById('admin-analytics-title').textContent = `Analytics: ${name}`;
    document.getElementById('admin-analytics-modal').style.display = 'flex';
    
    try {
        const res = await fetch(`${API_URL}/students/${encodeURIComponent(email)}/history`);
        const history = await res.json();
        
        let html = '';
        if (!Array.isArray(history) || history.length === 0) {
            html = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
                    <h3 style="color: var(--text-secondary); margin-bottom: 8px;">No Test Data Yet</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">This student has not submitted any live tests yet.</p>
                </div>`;
        } else {
            let totalScore = 0;
            let totalPossible = 0;
            let bestScore = 0;
            
            const testCards = history.map(h => {
                totalScore += h.score;
                totalPossible += h.total;
                const pct = h.total > 0 ? Math.round((h.score / h.total) * 100) : 0;
                if (pct > bestScore) bestScore = pct;
                const barColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
                return `
                <div style="background:var(--bg); border:1px solid var(--border); padding:14px; border-radius:var(--radius-sm); margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <div style="font-weight:bold; font-size: 0.95rem;">${escapeHTML(h.testName)}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(h.submittedAt).toLocaleString()}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight:bold; color:${barColor}; font-size: 1.1rem;">${h.score} / ${h.total}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${pct}%</div>
                        </div>
                    </div>
                    <div style="width:100%; height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:3px; transition: width 0.5s ease;"></div>
                    </div>
                </div>`;
            }).join('');
            
            const overallPct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
            const overallColor = overallPct >= 80 ? 'var(--green)' : overallPct >= 50 ? 'var(--yellow)' : 'var(--red)';
            
            html = `
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                    <div style="background:var(--bg); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border); text-align:center;">
                        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Tests Taken</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--accent-light);">${history.length}</div>
                    </div>
                    <div style="background:var(--bg); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border); text-align:center;">
                        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Total Score</div>
                        <div style="font-size:1.8rem; font-weight:800; color:${overallColor};">${totalScore}<span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);"> / ${totalPossible}</span></div>
                    </div>
                    <div style="background:var(--bg); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border); text-align:center;">
                        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Best Score</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--green);">${bestScore}%</div>
                    </div>
                </div>
                <h4 style="margin-bottom:12px; font-size: 0.95rem; color: var(--text-secondary);">Test History</h4>
                <div style="max-height: 350px; overflow-y:auto; padding-right:8px;">${testCards}</div>
            `;
        }
        
        document.getElementById('admin-analytics-content').innerHTML = html;
    } catch(e) {
        console.error('Analytics error:', e);
        document.getElementById('admin-analytics-content').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                <h3 style="color: var(--red); margin-bottom: 8px;">Failed to Load</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Could not connect to server. Check your internet connection.</p>
            </div>`;
    }
}

async function exportTestResultsCSV(code) {
    try {
        const { data: dbTest, error } = await supabase.from('tests').select('data').eq('code', code).single();
        if (error) throw error;
        const test = { code, ...dbTest.data };
        
        if (!test || (!test.students.length && !Object.keys(test.liveStudents || {}).length)) {
            return alert('No data to export for this test.');
        }

        let csv = 'Status,Student Name,Email,Score,Total Possible,Percentage,Submitted At\\n';
        
        // Add completed students
        test.students.forEach(s => {
            const date = new Date(s.submittedAt).toLocaleString().replace(/,/g, '');
            const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
            csv += `"Completed","${escapeHTML(s.studentName)}","${s.studentEmail}","${s.score}","${s.total}","${pct}%","${date}"\\n`;
        });
        
        // Add live students
        if (test.liveStudents) {
            Object.values(test.liveStudents).forEach(s => {
                const date = new Date(s.joinedAt).toLocaleString().replace(/,/g, '');
                csv += `"Live (In Progress)","${escapeHTML(s.studentName)}","${s.studentEmail}","N/A","N/A","N/A","${date}"\\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `${test.name}_results.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch(e) {
        console.error(e);
        alert('Failed to export data.');
    }
}

let loadedTests = {};
let currentAdminTestCode = null;

async function viewTestResults(code) {
    currentAdminTestCode = code;
    document.querySelectorAll('.admin-list-item').forEach(el => {
        if(el.innerHTML.includes(code)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    if (window.adminLivePollTimer) clearInterval(window.adminLivePollTimer);
    
    await fetchAndRenderTestResults(code);
    
    window.adminLivePollTimer = setInterval(() => {
        if (document.getElementById('admin-tab-results').style.display !== 'none' && currentAdminTestCode === code) {
            fetchAndRenderTestResults(code);
        } else {
            clearInterval(window.adminLivePollTimer);
        }
    }, 3000);
}

async function setTestStatus(code, newStatus) {
    let actionText = newStatus === 'hold' ? 'PAUSE' : newStatus === 'active' ? 'RESUME' : 'CLOSE/ARCHIVE';
    if(!confirm(`Are you sure you want to ${actionText} this test?`)) return;
    try {
        const { data: dbTest } = await supabase.from('tests').select('data').eq('code', code).single();
        if (dbTest) {
            dbTest.data.isActive = newStatus;
            await supabase.from('tests').update({ data: dbTest.data }).eq('code', code);
        }
        fetchAdminTests();
        if (currentAdminTestCode === code) fetchAndRenderTestResults(code);
    } catch(e) {
        alert("Action failed");
    }
}

async function deleteTest(code) {
    if(!confirm("Are you sure you want to DELETE this test permanently? All results will be lost.")) return;
    try {
        await supabase.from('tests').delete().eq('code', code);
        document.getElementById('admin-results-header').innerHTML = '<h3 style="font-size: 1.1rem;">Select a test to view results</h3>';
        document.getElementById('admin-student-list').innerHTML = '';
        currentAdminTestCode = null;
        fetchAdminTests();
    } catch(e) {
        alert("Delete failed");
    }
}

async function fetchAndRenderTestResults(code) {
    try {
        const { data: dbTest, error } = await supabase.from('tests').select('data').eq('code', code).single();
        if (error || !dbTest) return;
        const test = { code, ...dbTest.data };

        const liveEntriesCount = Object.keys(test.liveStudents || {}).length;
        const completedCount = test.students.length;
        const totalJoinedCount = liveEntriesCount + completedCount;

        document.getElementById('admin-results-header').innerHTML = `
            <div>
                <h3 style="font-size: 1.1rem; margin-bottom:4px;">${test.name}</h3>
                <p style="font-size:0.85rem; color:var(--text-muted);">Code: ${test.code} • Duration: ${test.duration}m</p>
                <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${test.isActive === 'stopped' ? 
                        `<span style="padding: 4px 8px; font-size: 0.8rem; background: var(--border); border-radius:4px; color: var(--text-muted);">Archived Test</span>` 
                    : 
                        (test.isActive === 'hold' ? 
                            `<button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; border: 1px solid var(--border); color: var(--green);" onclick="setTestStatus('${test.code}', 'active')">▶ Resume</button>
                             <button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; border: 1px solid var(--border); color: var(--yellow);" onclick="setTestStatus('${test.code}', 'stopped')">⏹ Close Test</button>`
                        : 
                            `<button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; border: 1px solid var(--border); color: var(--yellow);" onclick="setTestStatus('${test.code}', 'hold')">⏸ Hold Test</button>
                             <button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; border: 1px solid var(--border); color: var(--red);" onclick="setTestStatus('${test.code}', 'stopped')">⏹ Close Test</button>`
                        )
                    }
                    <button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; border: 1px solid var(--border);" onclick="exportTestResultsCSV('${test.code}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Export
                    </button>
                    <button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; color: var(--red); border: 1px solid var(--border);" onclick="deleteTest('${test.code}')">
                        Delete
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 24px; text-align: center; align-items: center;">
                <div>
                    <div style="font-size:1.4rem; font-weight:bold; color:var(--text);">${totalJoinedCount}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Joined</div>
                </div>
                <div>
                    <div style="font-size:1.4rem; font-weight:bold; color:var(--yellow);">${liveEntriesCount}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Live</div>
                </div>
                <div>
                    <div style="font-size:1.4rem; font-weight:bold; color:var(--green);">${completedCount}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">Submitted</div>
                </div>
            </div>
        `;
        
        const slist = document.getElementById('admin-student-list');
        let html = '';

        // Completed
        const sortedStudents = [...test.students].sort((a,b)=>b.score-a.score);
        html += sortedStudents.map((s, idx) => `
            <div class="student-result-item" style="cursor: pointer;" onclick="showStudentDetails('${code}', ${idx})">
                <div>
                    <div style="font-weight:600; font-size:0.95rem;">${s.studentName}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(s.submittedAt).toLocaleTimeString()} • Click to view answers</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:var(--green); font-size:1.1rem;">${s.score} / ${s.total}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">${Math.round((s.score/s.total)*100)}%</div>
                </div>
            </div>
        `).join('');

        // Live Students
        const liveEntries = Object.entries(test.liveStudents || {});
        if (liveEntries.length > 0) {
            html += `<h4 style="margin-top:20px; margin-bottom:10px; color:var(--text-secondary); font-size:0.9rem; text-transform:uppercase;">Live (In Progress)</h4>`;
            html += liveEntries.map(([name, data]) => {
                const pct = Math.round((data.answered / data.total) * 100) || 0;
                return `
                <div class="student-result-item" style="border-left-color: var(--yellow); opacity: 0.8; cursor: default; margin-bottom:12px;">
                    <div>
                        <div style="font-weight:600; font-size:0.95rem;">${name}</div>
                        <div style="font-size:0.75rem; color:var(--yellow);">Testing... Last updated: ${new Date(data.lastUpdated).toLocaleTimeString()}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; color:var(--text); font-size:1.1rem;">${data.answered} / ${data.total}</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary);">${pct}% Done</div>
                    </div>
                </div>
                `;
            }).join('');
        }

        if (html === '') {
            html = '<p style="color:var(--text-muted); font-size:0.9rem;">No students have joined or completed this test yet.</p>';
        }
        slist.innerHTML = html;
    } catch (e) {}
}

let lastFetchedTests = [];
async function fetchTestForDetails(code) {
    const res = await fetch(`${API_URL}/tests`);
    lastFetchedTests = await res.json();
    return lastFetchedTests.find(t => t.code === code);
}

async function showStudentDetails(code, studentIndex) {
    const test = await fetchTestForDetails(code);
    if (!test) return;
    
    // The list was sorted by score descending before mapping. We need to find the correct student.
    // Wait, the index passed is based on the sorted array.
    const sortedStudents = [...test.students].sort((a,b)=>b.score-a.score);
    const student = sortedStudents[studentIndex];
    if (!student) return;

    document.getElementById('detail-student-name').textContent = student.studentName + ' - ' + student.score + '/' + student.total;
    
    const list = document.getElementById('student-detail-list');
    const letters = ['A', 'B', 'C', 'D'];
    
    list.innerHTML = student.detailedResults.map((q, idx) => {
        const isCorrect = q.studentAnswerIndex === q.correctAnswerIndex;
        const isSkipped = q.studentAnswerIndex === null || q.studentAnswerIndex === undefined;
        let status = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'wrong');
        
        return `
        <div class="review-item review-${status}" style="padding: 16px; margin-bottom: 0;">
            <div class="review-q-number" style="display:flex; justify-content:space-between;">
                <span>Question ${idx + 1}</span>
                <span style="color:${status === 'correct' ? 'var(--green)' : status === 'wrong' ? 'var(--red)' : 'var(--yellow)'}; font-weight:bold;">${status.toUpperCase()}</span>
            </div>
            <div class="review-q-text" style="font-size:0.95rem; margin-bottom:12px;">${escapeHTML(q.questionText)}</div>
            <div class="review-options" style="display:flex; flex-direction:column; gap:8px;">
                ${q.options.map((opt, i) => {
                    let bg = 'var(--bg)';
                    let border = '1px solid var(--border)';
                    let color = 'var(--text-secondary)';
                    
                    if (i === q.correctAnswerIndex) {
                        bg = 'rgba(0, 206, 201, 0.1)';
                        border = '1px solid var(--green)';
                        color = 'var(--green)';
                    } else if (i === q.studentAnswerIndex) {
                        bg = 'rgba(255, 107, 107, 0.1)';
                        border = '1px solid var(--red)';
                        color = 'var(--red)';
                    }
                    
                    return `
                    <div style="background:${bg}; border:${border}; color:${color}; padding:8px 12px; border-radius:var(--radius-sm); font-size:0.85rem; display:flex; gap:10px;">
                        <span style="font-weight:bold;">${letters[i]}</span>
                        <span>${escapeHTML(opt)}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('student-detail-modal').style.display = 'flex';
}

// ===== Student Live Test Logic =====

async function joinLiveTest() {
    const name = document.getElementById('student-name-input').value.trim();
    const code = document.getElementById('test-code-input').value.trim().toUpperCase();
    const err = document.getElementById('join-error-msg');
    
    if (!name) { err.textContent = "Please enter your name."; err.style.display = "block"; return; }
    if (!code) { err.textContent = "Please enter a test code."; err.style.display = "block"; return; }

    try {
        err.style.display = "none";
        
        const { data: dbTest, error } = await supabase.from('tests').select('data').eq('code', code).single();
        
        if (error || !dbTest) {
            err.textContent = "Invalid Code.";
            err.style.display = "block";
            return;
        }

        const testData = { code, ...dbTest.data };
        
        if (testData.isActive === false || testData.isActive === 'stopped') {
            err.textContent = "This test is no longer active.";
            err.style.display = "block";
            return;
        }
        if (testData.isActive === 'hold') {
            err.textContent = "This test is currently on hold by the admin.";
            err.style.display = "block";
            return;
        }

        startLiveQuiz(testData, name);
    } catch (e) {
        console.error(e);
        err.textContent = "Could not connect to database.";
        err.style.display = "block";
    }
}

function startLiveQuiz(testData, studentName) {
    isLiveTest = true;
    currentLiveCode = testData.code;
    currentStudentName = studentName;
    
    userAnswers = {};
    score = 0;
    currentIndex = 0;
    currentQuiz = [];
    
    // Pick questions based on topicConfig
    const config = testData.topicConfig;
    for (const [topicName, count] of Object.entries(config)) {
        const tObj = QUESTIONS_DATA.find(t => t.topic === topicName);
        if (tObj) {
            let pool = [...tObj.questions];
            // Shuffle pool
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            // Pick requested count
            const picked = pool.slice(0, count);
            currentQuiz = currentQuiz.concat(picked);
        }
    }
    
    // Shuffle the final quiz so topics are mixed
    for (let i = currentQuiz.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentQuiz[i], currentQuiz[j]] = [currentQuiz[j], currentQuiz[i]];
    }
    
    // Assign index
    currentQuiz = currentQuiz.map((q, i) => ({ ...q, _idx: i }));
    
    document.getElementById('quiz-topic-name').textContent = testData.name;
    document.getElementById('quiz-score').textContent = '0';
    const scoreBadge = document.querySelector('.quiz-score-badge');
    if (scoreBadge) scoreBadge.style.display = 'none';
    
    // Setup timer
    timeRemaining = testData.duration * 60;
    const timerEl = document.getElementById('quiz-timer');
    timerEl.style.display = 'block';
    updateTimerDisplay();
    
    if (liveTestTimer) clearInterval(liveTestTimer);
    liveTestTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(liveTestTimer);
            alert("Time's up! Your test will be auto-submitted.");
            showResultsScreen();
        }
    }, 1000);

    showScreen('quiz-screen');
    renderQuestion();
    reportLiveProgress();

    // Supabase Realtime Listener for Hold/Stop Events
    if (window.studentRealtimeSub) supabase.removeChannel(window.studentRealtimeSub);
    window.studentRealtimeSub = supabase.channel(`student_test_${testData.code}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tests', filter: `code=eq.${testData.code}` }, payload => {
            const data = payload.new.data;
            if (data.isActive === 'hold') {
                document.getElementById('quiz-screen').style.opacity = '0.5';
                document.getElementById('quiz-screen').style.pointerEvents = 'none';
                if (!document.getElementById('hold-alert-msg')) {
                    const msg = document.createElement('div');
                    msg.id = 'hold-alert-msg';
                    msg.innerHTML = '<h2 style="color:var(--red); text-align:center; margin-top:20px;">TEST PAUSED BY ADMIN</h2>';
                    document.getElementById('quiz-screen').prepend(msg);
                }
            } else if (data.isActive === 'active') {
                document.getElementById('quiz-screen').style.opacity = '1';
                document.getElementById('quiz-screen').style.pointerEvents = 'auto';
                const msg = document.getElementById('hold-alert-msg');
                if (msg) msg.remove();
            } else if (data.isActive === 'stopped' || data.isActive === false) {
                alert('Test was closed by admin. Submitting your current progress...');
                showResultsScreen(); // auto-submits what they have
            }
        })
        .subscribe();
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    document.getElementById('quiz-timer').textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (timeRemaining < 60) {
        document.getElementById('quiz-timer').style.color = 'var(--red)';
    } else {
        document.getElementById('quiz-timer').style.color = 'var(--accent-light)';
    }
}

async function submitLiveTestResults() {
    if (liveTestTimer) clearInterval(liveTestTimer);
    document.getElementById('quiz-timer').style.display = 'none';
    if (window.studentRealtimeSub) supabase.removeChannel(window.studentRealtimeSub);
    
    const detailed = currentQuiz.map((q, idx) => ({
        questionText: q.q,
        options: q.o,
        correctAnswerIndex: q.a,
        studentAnswerIndex: userAnswers[idx] !== undefined ? userAnswers[idx] : null
    }));
    
    const payload = {
        studentName: currentStudentName,
        studentEmail: loggedInStudent ? loggedInStudent.email : '',
        score: score,
        total: currentQuiz.length,
        submittedAt: new Date().toISOString(),
        detailedResults: detailed
    };
    
    try {
        const emailKey = loggedInStudent ? loggedInStudent.email : currentStudentName;
        const { data: dbTest } = await supabase.from('tests').select('data').eq('code', currentLiveCode).single();
        
        if (dbTest) {
            if (dbTest.data.liveStudents && dbTest.data.liveStudents[emailKey]) {
                delete dbTest.data.liveStudents[emailKey];
            }
            if (!dbTest.data.students) dbTest.data.students = [];
            dbTest.data.students.push(payload);
            
            await supabase.from('tests').update({ data: dbTest.data }).eq('code', currentLiveCode);
        }
    } catch (e) {
        console.error("Failed to submit results", e);
    }

    isLiveTest = false; // Reset so they can't submit twice
}

async function reportLiveProgress() {
    if (!isLiveTest || !currentLiveCode) return;
    
    const answered = Object.keys(userAnswers).length;
    const total = currentQuiz.length;
    const emailKey = loggedInStudent ? loggedInStudent.email : currentStudentName;
    
    try {
        const { data: dbTest } = await supabase.from('tests').select('data').eq('code', currentLiveCode).single();
        if (dbTest) {
            if (!dbTest.data.liveStudents) dbTest.data.liveStudents = {};
            dbTest.data.liveStudents[emailKey] = {
                studentName: currentStudentName,
                studentEmail: loggedInStudent ? loggedInStudent.email : '',
                answered: answered,
                total: total,
                joinedAt: dbTest.data.liveStudents[emailKey]?.joinedAt || new Date().toISOString()
            };
            await supabase.from('tests').update({ data: dbTest.data }).eq('code', currentLiveCode);
        }
    } catch (e) {
        console.error("Failed to report live progress", e);
    }
}

// ===== Student History & Leaderboard =====

async function showStudentHistory() {
    if (!loggedInStudent) return;
    
    // Show loading immediately
    document.getElementById('student-history-content').innerHTML = '<div style="text-align:center; padding:40px;"><div style="font-size:2rem; margin-bottom:12px;">⏳</div><p style="color:var(--text-muted);">Loading your test history...</p></div>';
    document.getElementById('student-history-modal').style.display = 'flex';
    
    try {
        const res = await fetch(`${API_URL}/students/${encodeURIComponent(loggedInStudent.email)}/history`);
        const history = await res.json();
        
        let html = '';
        if (!Array.isArray(history) || history.length === 0) {
            html = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
                    <h3 style="color: var(--text-secondary); margin-bottom: 8px;">No History Yet</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">You haven't taken any live tests yet. Join a test using a code from your teacher!</p>
                </div>`;
        } else {
            // Calculate summary stats
            let totalScore = 0, totalPossible = 0, bestPct = 0;
            history.forEach(h => {
                totalScore += h.score;
                totalPossible += h.total;
                const pct = h.total > 0 ? Math.round((h.score / h.total) * 100) : 0;
                if (pct > bestPct) bestPct = pct;
            });
            const overallPct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
            const overallColor = overallPct >= 80 ? 'var(--green)' : overallPct >= 50 ? 'var(--yellow)' : 'var(--red)';
            
            // Summary cards
            html = `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                    <div style="background: var(--bg); padding: 14px; border-radius: var(--radius-xs); border: 1px solid var(--border); text-align: center;">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Tests</div>
                        <div style="font-size: 1.6rem; font-weight: 800; color: var(--accent-light);">${history.length}</div>
                    </div>
                    <div style="background: var(--bg); padding: 14px; border-radius: var(--radius-xs); border: 1px solid var(--border); text-align: center;">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Overall</div>
                        <div style="font-size: 1.6rem; font-weight: 800; color: ${overallColor};">${overallPct}%</div>
                    </div>
                    <div style="background: var(--bg); padding: 14px; border-radius: var(--radius-xs); border: 1px solid var(--border); text-align: center;">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Best</div>
                        <div style="font-size: 1.6rem; font-weight: 800; color: var(--green);">${bestPct}%</div>
                    </div>
                </div>
            `;
            
            // Test cards
            html += history.map(h => {
                const pct = h.total > 0 ? Math.round((h.score / h.total) * 100) : 0;
                const barColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
                const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '📖' : '💪';
                return `
                <div style="background: var(--bg); border: 1px solid var(--border); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text);">${emoji} ${escapeHTML(h.testName)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Code: ${escapeHTML(h.testCode)} • ${new Date(h.submittedAt).toLocaleDateString()}</div>
                        </div>
                        <div style="text-align: right; margin-left: 12px;">
                            <div style="font-weight: 800; color: ${barColor}; font-size: 1.1rem;">${h.score}/${h.total}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">${pct}%</div>
                        </div>
                    </div>
                    <div style="width: 100%; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 3px;"></div>
                    </div>
                </div>`;
            }).join('');
        }
        
        document.getElementById('student-history-content').innerHTML = html;
    } catch(e) {
        console.error('History error:', e);
        document.getElementById('student-history-content').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                <h3 style="color: var(--red); margin-bottom: 8px;">Connection Error</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Could not load history. Check your internet connection.</p>
            </div>`;
    }
}

async function showLeaderboard() {
    // Show loading immediately
    document.getElementById('leaderboard-content').innerHTML = '<div style="text-align:center; padding:40px;"><div style="font-size:2rem; margin-bottom:12px;">⏳</div><p style="color:var(--text-muted);">Loading global rankings...</p></div>';
    document.getElementById('leaderboard-modal').style.display = 'flex';
    
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const leaderboard = await res.json();
        
        let html = '';
        if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
            html = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">🏟️</div>
                    <h3 style="color: var(--text-secondary); margin-bottom: 8px;">No Rankings Yet</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">Rankings will appear once students start taking live tests.</p>
                </div>`;
        } else {
            // Find current student's rank
            let myRank = -1;
            if (loggedInStudent) {
                myRank = leaderboard.findIndex(l => l.email === loggedInStudent.email);
            }
            
            html = leaderboard.map((l, i) => {
                const medals = ['🥇', '🥈', '🥉'];
                const isMe = loggedInStudent && l.email === loggedInStudent.email;
                const pct = l.avgPercent || 0;
                const pctColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
                const bgStyle = isMe ? 'background: rgba(99,102,241,0.08); border-color: var(--accent-light);' : 'background: var(--bg);';
                
                return `
                <div style="${bgStyle} border: 1px solid var(--border); padding: 14px 16px; border-radius: var(--radius-sm); margin-bottom: 8px; ${isMe ? 'box-shadow: 0 0 0 1px var(--accent-light);' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <div style="min-width: 36px; text-align: center;">
                                ${i < 3 
                                    ? '<span style="font-size: 1.4rem;">' + medals[i] + '</span>' 
                                    : '<span style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted);">#' + (i + 1) + '</span>'
                                }
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text);">
                                    ${escapeHTML(l.name)} ${isMe ? '<span style="font-size: 0.7rem; background: var(--accent); color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">YOU</span>' : ''}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${l.testsTaken} tests • Score: ${l.totalScore}/${l.totalPossible || 0}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.3rem; font-weight: 800; color: ${pctColor};">${pct}%</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Accuracy</div>
                        </div>
                    </div>
                    <div style="width: 100%; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: ${pctColor}; border-radius: 2px;"></div>
                    </div>
                </div>`;
            }).join('');
            
            // If student is ranked, show their position at top
            if (myRank >= 0) {
                const myPct = leaderboard[myRank].avgPercent || 0;
                const myColor = myPct >= 80 ? 'var(--green)' : myPct >= 50 ? 'var(--yellow)' : 'var(--red)';
                html = `
                    <div style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.03)); border: 1px solid rgba(99,102,241,0.2); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px; text-align: center;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Your Rank</div>
                        <div style="font-size: 2rem; font-weight: 900; color: var(--accent-light);">#${myRank + 1} <span style="font-size: 0.9rem; font-weight: 400; color: var(--text-muted);">of ${leaderboard.length}</span></div>
                        <div style="font-size: 0.85rem; color: ${myColor}; font-weight: 600; margin-top: 4px;">${myPct}% Accuracy</div>
                    </div>
                ` + html;
            }
        }
        
        document.getElementById('leaderboard-content').innerHTML = html;
    } catch(e) {
        console.error('Leaderboard error:', e);
        document.getElementById('leaderboard-content').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                <h3 style="color: var(--red); margin-bottom: 8px;">Connection Error</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Could not load rankings. Check your internet connection.</p>
            </div>`;
    }
}
