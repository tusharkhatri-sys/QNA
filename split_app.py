import os

pages_dir = r"c:\Users\tusha\OneDrive\Desktop\my_softwares\QNA\public\pages"
os.makedirs(pages_dir, exist_ok=True)

# Define file paths
files = {
    "shared.js": """
// ===== SHARED CONFIG & UTILS =====
const SUPABASE_URL = 'https://gxfojevrtvexfootbzjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Zm9qZXZydHZleGZvb3Riemp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDg5MTMsImV4cCI6MjA5MzAyNDkxM30.0MP9rW4UdOYT3irbPqCjY352g8vr1b92zymXeqsnD8w';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API_URL = '/api';

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

function getLoggedInStudent() {
    const saved = localStorage.getItem('loggedInStudent');
    return saved ? JSON.parse(saved) : null;
}
""",
    "landing.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QNA Platform - Welcome</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <style>
        .portal-cards { display: flex; gap: 24px; max-width: 900px; margin: 40px auto; justify-content: center; flex-wrap: wrap; }
        .portal-card { background: var(--surface); padding: 40px 30px; border-radius: var(--radius-lg); text-align: center; border: 1px solid var(--border); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; flex: 1; min-width: 280px; position: relative; overflow: hidden; }
        .portal-card:hover { transform: translateY(-8px); border-color: var(--primary); box-shadow: 0 12px 40px rgba(0,206,201,0.15); }
        .portal-icon { font-size: 3.5rem; margin-bottom: 24px; color: var(--primary); }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="screen active">
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <div class="logo-icon">Q</div>
                    <span>QNA Platform</span>
                </div>
            </div>
        </header>
        <div class="container" style="text-align: center; padding-top: 100px;">
            <h1 style="font-size: 3.5rem; margin-bottom: 16px; background: linear-gradient(135deg, #fff 0%, #a0a5b1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Select Your Portal</h1>
            <p style="color: var(--text-secondary); font-size: 1.2rem; margin-bottom: 40px;">Choose your role to continue</p>
            <div class="portal-cards">
                <div class="portal-card" onclick="window.location.href='student.html'">
                    <div class="portal-icon">🎓</div>
                    <h2 style="font-size: 1.8rem; margin-bottom: 12px;">Student Portal</h2>
                    <p style="color: var(--text-muted); line-height: 1.6;">Take live tests, practice topics, and view your detailed performance analytics.</p>
                </div>
                <div class="portal-card" onclick="window.location.href='admin.html'">
                    <div class="portal-icon">👨‍🏫</div>
                    <h2 style="font-size: 1.8rem; margin-bottom: 12px;">Teacher / Admin</h2>
                    <p style="color: var(--text-muted); line-height: 1.6;">Create tests, monitor live student progress, and manage results.</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
""",
    "auth.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QNA Platform - Student Auth</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="screen active">
        <div class="container" style="display: flex; justify-content: center; align-items: center; min-height: 100vh;">
            <div style="background: var(--surface); padding: 40px; border-radius: var(--radius-lg); border: 1px solid var(--border); width: 100%; max-width: 400px; text-align: center;">
                <div class="logo" style="justify-content: center; margin-bottom: 30px;">
                    <div class="logo-icon">Q</div>
                    <span>QNA Platform</span>
                </div>
                <h2 id="auth-title" style="margin-bottom: 10px; font-size: 1.8rem;">Student Login</h2>
                <p id="auth-subtitle" style="color: var(--text-muted); margin-bottom: 30px;">Login to access your dashboard</p>
                <div id="auth-error-msg" style="color: var(--red); background: rgba(255, 107, 107, 0.1); border: 1px solid var(--red); padding: 10px; border-radius: var(--radius-sm); margin-bottom: 20px; display: none; font-size: 0.9rem;"></div>
                
                <div id="auth-name-group" class="form-group" style="display: none; text-align: left;">
                    <label>Full Name</label>
                    <input type="text" id="auth-name" placeholder="Enter your full name" class="input-field">
                </div>
                <div class="form-group" style="text-align: left;">
                    <label>Email Address</label>
                    <input type="email" id="auth-email" placeholder="Enter your email" class="input-field">
                </div>
                <div class="form-group" style="text-align: left;">
                    <label>Password</label>
                    <input type="password" id="auth-password" placeholder="Enter your password" class="input-field">
                </div>
                
                <button class="btn btn-primary" id="auth-submit-btn" style="width: 100%; margin-top: 10px;" onclick="submitAuth()">Login</button>
                <div style="margin-top: 24px; color: var(--text-muted); font-size: 0.9rem;">
                    <span id="auth-toggle-text">Don't have an account?</span> 
                    <a href="#" id="auth-toggle-btn" style="color: var(--primary); text-decoration: none; font-weight: 600;" onclick="toggleAuthMode()">Register</a>
                </div>
            </div>
        </div>
    </div>
    <script src="shared.js"></script>
    <script src="auth.js"></script>
</body>
</html>
""",
    "auth.js": """
let authMode = 'login';
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
    const errObj = document.getElementById('auth-error-msg');
    
    if (!email || !password || (authMode === 'register' && !name)) {
        errObj.textContent = "Please fill all fields";
        errObj.style.display = 'block';
        return;
    }
    
    document.getElementById('auth-submit-btn').textContent = 'Processing...';
    
    try {
        const payload = { action: authMode, email, password, name };
        const res = await fetch(`${API_URL}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('loggedInStudent', JSON.stringify({ email: data.student.email, name: data.student.name }));
            window.location.href = 'student.html';
        } else {
            errObj.textContent = data.message;
            errObj.style.display = 'block';
            document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
        }
    } catch (e) {
        errObj.textContent = "Server error. Try again.";
        errObj.style.display = 'block';
        document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
    }
}
""",
    "student.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Student Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="screen active">
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <div class="logo-icon">Q</div>
                    <span>QNA Platform</span>
                </div>
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div id="student-profile-badge" style="display: flex; align-items: center; gap: 10px; background: var(--bg); padding: 6px 16px; border-radius: 30px; border: 1px solid var(--border);">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: var(--bg); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;" id="badge-initial">S</div>
                        <span style="font-size: 0.9rem; font-weight: 500; color: var(--text);" id="badge-name">Student</span>
                    </div>
                    <button class="btn btn-outline" onclick="logout()">Logout</button>
                </div>
            </div>
        </header>

        <div class="container">
            <div style="display: grid; grid-template-columns: 350px 1fr; gap: 30px; align-items: start;">
                
                <!-- Live Test Join Card -->
                <div style="background: var(--surface); padding: 30px; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0, 206, 201, 0.1); color: var(--primary); padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-bottom: 20px;">
                        <span class="live-pulse"></span> Live Exam
                    </div>
                    <h2 style="font-size: 1.6rem; margin-bottom: 10px;">Join a Live Test</h2>
                    <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.5;">Enter the 6-character code provided by your teacher to join an active test session.</p>
                    
                    <div id="join-error-msg" style="color: var(--red); font-size: 0.85rem; margin-bottom: 12px; display: none;"></div>
                    
                    <div class="form-group">
                        <label>Student Name</label>
                        <input type="text" id="student-name-input" class="input-field" placeholder="Enter your full name">
                    </div>
                    
                    <div class="form-group">
                        <label>Test Code</label>
                        <input type="text" id="test-code-input" class="input-field" placeholder="e.g. ABCDEF" style="text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                    </div>
                    
                    <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="joinLiveTest()">Join Test</button>
                </div>
                
                <div>
                    <h2 style="font-size: 2rem; margin-bottom: 10px;">Practice Area</h2>
                    <p style="color: var(--text-muted); font-size: 1.05rem; margin-bottom: 30px;">Practice offline tests to prepare for your exams.</p>
                    
                    <div style="background: var(--surface); padding: 30px; border-radius: var(--radius-lg); border: 1px solid var(--border); margin-bottom: 30px;">
                        <h3 style="margin-bottom: 20px;">Start Practice Mode</h3>
                        <button class="btn btn-outline" style="margin-right: 10px;" onclick="startLocalPractice('all')">All Questions Mix</button>
                        <button class="btn btn-outline" onclick="startLocalPractice('random')">Random 50 Questions</button>
                    </div>

                    <button class="btn btn-outline" style="width: 100%; padding: 20px; font-size: 1.1rem;" onclick="window.location.href='history.html'">View Past Results & Analytics</button>
                </div>
            </div>
        </div>
    </div>
    <script src="shared.js"></script>
    <script src="student.js"></script>
</body>
</html>
""",
    "student.js": """
const student = getLoggedInStudent();
if (!student) {
    window.location.href = 'auth.html';
} else {
    document.getElementById('badge-name').textContent = student.name;
    document.getElementById('badge-initial').textContent = student.name.charAt(0).toUpperCase();
    document.getElementById('student-name-input').value = student.name;
}

function logout() {
    localStorage.removeItem('loggedInStudent');
    window.location.href = 'landing.html';
}

async function joinLiveTest() {
    const name = document.getElementById('student-name-input').value.trim();
    const code = document.getElementById('test-code-input').value.trim().toUpperCase();
    const err = document.getElementById('join-error-msg');
    
    if (!name || !code) { err.textContent = "Please fill all fields."; err.style.display = "block"; return; }

    try {
        err.style.display = "none";
        const { data: dbTest, error } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (error || !dbTest) {
            err.textContent = "Invalid Code."; err.style.display = "block"; return;
        }

        const testData = { code, ...dbTest.data };
        if (testData.isActive === false || testData.isActive === 'stopped') {
            err.textContent = "This test is no longer active."; err.style.display = "block"; return;
        }
        if (testData.isActive === 'hold') {
            err.textContent = "This test is currently on hold by the admin."; err.style.display = "block"; return;
        }

        // Save session
        localStorage.setItem('activeTest', JSON.stringify(testData));
        localStorage.setItem('activeTestStudentName', name);
        window.location.href = 'quiz.html';
    } catch (e) {
        console.error(e);
        err.textContent = "Could not connect to database."; err.style.display = "block";
    }
}

function startLocalPractice(mode) {
    localStorage.setItem('practiceMode', mode);
    window.location.href = 'quiz.html';
}
""",
    "quiz.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quiz Running...</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="../questions.js"></script>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="screen active" id="quiz-screen">
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <div class="logo-icon">Q</div>
                    <span id="quiz-topic-name">Live Test</span>
                </div>
                <div style="display: flex; gap: 20px; align-items: center;">
                    <div id="quiz-timer" style="font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; font-weight: 700; background: var(--bg); padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border); color: var(--accent-light);">
                        ⏱️ 00:00
                    </div>
                </div>
            </div>
        </header>
        <div class="container" style="max-width: 900px; padding-top: 100px;">
            <div class="quiz-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; gap: 12px; align-items: baseline;">
                        <span style="font-size: 2.5rem; font-weight: 800; color: var(--primary); line-height: 1;" id="current-q-num">1</span>
                        <span style="color: var(--text-muted); font-size: 1.1rem; font-weight: 500;">/ <span id="total-q-num">10</span></span>
                    </div>
                    <div style="background: var(--bg); border: 1px solid var(--border); padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">
                        Topic: <span id="current-subtopic" style="color: var(--text);">General</span>
                    </div>
                </div>
                
                <h2 class="question-text" id="question-text">Loading...</h2>
                <h3 class="question-text-hi" id="question-text-hi" style="margin-bottom: 30px; color: var(--text-secondary); font-weight: 500;">Loading...</h3>
                
                <div class="options-grid" id="options-grid"></div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 40px; align-items: center;">
                    <button class="btn btn-outline" id="prev-btn" onclick="prevQuestion()" style="min-width: 120px;">← Previous</button>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-primary" id="next-btn" onclick="nextQuestion()" style="min-width: 120px;">Next →</button>
                        <button class="btn btn-accent" id="submit-btn" onclick="submitQuiz()" style="display: none; min-width: 120px;">Submit Test</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="shared.js"></script>
    <script src="quiz.js"></script>
</body>
</html>
""",
    "quiz.js": """
const testData = JSON.parse(localStorage.getItem('activeTest'));
const studentName = localStorage.getItem('activeTestStudentName');
const student = getLoggedInStudent();

let currentQuiz = [];
let currentIndex = 0;
let userAnswers = {};
let score = 0;
let timeRemaining = 0;
let liveTestTimer = null;

if (!testData && !localStorage.getItem('practiceMode')) {
    window.location.href = 'student.html';
}

function initQuiz() {
    if (testData) {
        initLiveTest();
    } else {
        initPracticeMode();
    }
}

function initLiveTest() {
    document.getElementById('quiz-topic-name').textContent = testData.name;
    const config = testData.topicConfig;
    for (const [topicName, count] of Object.entries(config)) {
        const tObj = QUESTIONS_DATA.find(t => t.topic === topicName);
        if (tObj) {
            let pool = [...tObj.questions];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            currentQuiz = currentQuiz.concat(pool.slice(0, count));
        }
    }
    for (let i = currentQuiz.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentQuiz[i], currentQuiz[j]] = [currentQuiz[j], currentQuiz[i]];
    }
    
    timeRemaining = testData.duration * 60;
    updateTimerDisplay();
    liveTestTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(liveTestTimer);
            alert("Time's up! Your test will be auto-submitted.");
            submitQuiz();
        }
    }, 1000);

    // Supabase Realtime Listener
    if (window.studentRealtimeSub) window.supabase.removeChannel(window.studentRealtimeSub);
    window.studentRealtimeSub = window.supabase.channel(`student_test_${testData.code}`)
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
                submitQuiz(); 
            }
        }).subscribe();
        
    renderQuestion();
    reportLiveProgress();
}

function initPracticeMode() {
    document.getElementById('quiz-timer').style.display = 'none';
    currentQuiz = [];
    QUESTIONS_DATA.forEach(t => currentQuiz = currentQuiz.concat(t.questions));
    
    if(localStorage.getItem('practiceMode') === 'random') {
        for (let i = currentQuiz.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentQuiz[i], currentQuiz[j]] = [currentQuiz[j], currentQuiz[i]];
        }
        currentQuiz = currentQuiz.slice(0, 50);
    }
    renderQuestion();
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    document.getElementById('quiz-timer').textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (timeRemaining < 60) document.getElementById('quiz-timer').style.color = 'var(--red)';
}

function renderQuestion() {
    if (currentQuiz.length === 0) return;
    const q = currentQuiz[currentIndex];
    
    document.getElementById('current-q-num').textContent = currentIndex + 1;
    document.getElementById('total-q-num').textContent = currentQuiz.length;
    document.getElementById('question-text').textContent = q.q;
    document.getElementById('question-text-hi').textContent = q.q_hi || '';
    
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    const letters = ['A', 'B', 'C', 'D'];
    q.o.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-card';
        if (userAnswers[currentIndex] === idx) div.classList.add('selected');
        
        div.onclick = () => selectOption(idx);
        
        const hiText = (q.o_hi && q.o_hi[idx]) ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${escapeHTML(q.o_hi[idx])}</div>` : '';
        
        div.innerHTML = `
            <div class="option-letter">${letters[idx]}</div>
            <div>
                <div class="option-text">${escapeHTML(opt)}</div>
                ${hiText}
            </div>
        `;
        grid.appendChild(div);
    });
    
    document.getElementById('prev-btn').disabled = currentIndex === 0;
    
    if (currentIndex === currentQuiz.length - 1) {
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('submit-btn').style.display = 'block';
    } else {
        document.getElementById('next-btn').style.display = 'block';
        document.getElementById('submit-btn').style.display = 'none';
    }
}

function selectOption(idx) {
    userAnswers[currentIndex] = idx;
    renderQuestion();
    if(testData) reportLiveProgress();
}

function nextQuestion() {
    if (currentIndex < currentQuiz.length - 1) {
        currentIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderQuestion();
    }
}

async function reportLiveProgress() {
    if (!testData) return;
    const answered = Object.keys(userAnswers).length;
    const emailKey = student ? student.email : studentName;
    try {
        const { data: dbTest } = await supabaseClient.from('tests').select('data').eq('code', testData.code).single();
        if (dbTest) {
            if (!dbTest.data.liveStudents) dbTest.data.liveStudents = {};
            dbTest.data.liveStudents[emailKey] = {
                studentName, studentEmail: student ? student.email : '',
                answered, total: currentQuiz.length,
                joinedAt: dbTest.data.liveStudents[emailKey]?.joinedAt || new Date().toISOString()
            };
            await supabaseClient.from('tests').update({ data: dbTest.data }).eq('code', testData.code);
        }
    } catch(e) {}
}

async function submitQuiz() {
    if (liveTestTimer) clearInterval(liveTestTimer);
    if (window.studentRealtimeSub) window.supabase.removeChannel(window.studentRealtimeSub);
    
    score = 0;
    currentQuiz.forEach((q, idx) => {
        if (userAnswers[idx] === q.a) score++;
    });

    if (testData) {
        const detailed = currentQuiz.map((q, idx) => ({
            questionText: q.q, options: q.o, correctAnswerIndex: q.a, studentAnswerIndex: userAnswers[idx] !== undefined ? userAnswers[idx] : null
        }));
        
        const payload = {
            studentName, studentEmail: student ? student.email : '',
            score, total: currentQuiz.length, submittedAt: new Date().toISOString(), detailedResults: detailed
        };
        
        try {
            const emailKey = student ? student.email : studentName;
            const { data: dbTest } = await supabaseClient.from('tests').select('data').eq('code', testData.code).single();
            if (dbTest) {
                if (dbTest.data.liveStudents && dbTest.data.liveStudents[emailKey]) delete dbTest.data.liveStudents[emailKey];
                if (!dbTest.data.students) dbTest.data.students = [];
                dbTest.data.students.push(payload);
                await supabaseClient.from('tests').update({ data: dbTest.data }).eq('code', testData.code);
            }
        } catch(e) {}
    }
    
    // Save results to local storage to show in results screen
    localStorage.setItem('lastQuizResults', JSON.stringify({ score, total: currentQuiz.length }));
    localStorage.removeItem('activeTest');
    localStorage.removeItem('activeTestStudentName');
    window.location.href = 'student.html'; // Or results.html if implemented
}

initQuiz();
"""
}

import codecs
for filename, content in files.items():
    path = os.path.join(pages_dir, filename)
    with codecs.open(path, "w", "utf-8") as f:
        f.write(content.strip())

print("Created multi-page structure in public/pages/")
