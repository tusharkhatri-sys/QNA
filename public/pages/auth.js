function isSafeBrowser() {
    // ALWAYS ALLOW: Removed strict User-Agent/Kiosk locks to support standard PC browsers and Mobile WebViews
    return true;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Determine which UI to show based on browser type
    if (isSafeBrowser()) {
        document.getElementById('login-section').classList.add('active');
        document.getElementById('download-section').classList.remove('active');
    } else {
        document.getElementById('download-section').classList.add('active');
        document.getElementById('login-section').classList.remove('active');
    }
});

// ===== DOWNLOAD HANDLER =====
function handleDownload(e) {
    e.preventDefault();
    // In a real scenario, this links to the actual GitHub release EXE
    alert("Downloading QNA Safe Browser...");
}

// ===== SAFE BROWSER EXIT =====
function exitSafeBrowser() {
    if (window.electronAPI && window.electronAPI.exitApp) {
        window.electronAPI.exitApp();
    } else {
        window.close();
    }
}

// ===== GLOBAL STATE =====
let verifiedStudent = null;
let verifiedExam = null;

// ===== STEP 1: VERIFY TRAINEE & EXAM =====
async function verifyTrainee() {
    const email = document.getElementById('auth-email').value.trim();
    const examCode = document.getElementById('auth-exam-code').value.trim().toUpperCase();
    const errObj = document.getElementById('auth-error-msg');
    const btn = document.getElementById('auth-submit-btn');

    errObj.classList.add('hidden');
    errObj.textContent = '';

    if (!email || !examCode) {
        errObj.textContent = 'Please enter both Email and Exam Code.';
        errObj.classList.remove('hidden');
        return;
    }

    if (examCode.length !== 6) {
        errObj.textContent = 'Exam Code must be exactly 6 characters.';
        errObj.classList.remove('hidden');
        return;
    }

    btn.textContent = 'Verifying...';
    btn.disabled = true;

    try {
        // 1. Verify Exam Code exists and is active
        const { data: testData, error: testErr } = await supabaseClient
            .from('tests')
            .select('*')
            .eq('code', examCode)
            .single();

        if (testErr || !testData) {
            errObj.textContent = 'Invalid Exam Code. Please check with your invigilator.';
            errObj.classList.remove('hidden');
            btn.textContent = 'Verify & Proceed';
            btn.disabled = false;
            return;
        }

        // Check if test is active (assuming status is stored in JSON or implicitly active)
        // If there's a strict status field in data JSON, check it:
        if (testData.data && testData.data.status === 'completed') {
            errObj.textContent = 'This exam has already concluded.';
            errObj.classList.remove('hidden');
            btn.textContent = 'Verify & Proceed';
            btn.disabled = false;
            return;
        }

        // 2. Verify Student Email exists
        const { data: studentDb, error: studentErr } = await supabaseClient
            .from('students')
            .select('name, email')
            .eq('email', email)
            .single();

        if (studentErr || !studentDb) {
            errObj.textContent = 'Student not found. Ensure you are entering the registered email.';
            errObj.classList.remove('hidden');
            btn.textContent = 'Verify & Proceed';
            btn.disabled = false;
            return;
        }

        // Success! Store in memory and proceed to Step 2
        verifiedStudent = { email: studentDb.email, name: studentDb.name };
        verifiedExam = testData;

        // Transition to Rules Section
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('rules-section').classList.add('active');

    } catch (err) {
        console.error('Verification Error:', err);
        errObj.textContent = 'A network error occurred. Please try again.';
        errObj.classList.remove('hidden');
        btn.textContent = 'Verify & Proceed';
        btn.disabled = false;
    }
}

// ===== STEP 2: RULES ACKNOWLEDGEMENT =====
function toggleStartButton() {
    const isChecked = document.getElementById('rules-checkbox').checked;
    const startBtn = document.getElementById('start-exam-btn');
    
    if (isChecked) {
        startBtn.disabled = false;
        startBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        startBtn.classList.add('bg-blue-800', 'hover:bg-blue-900', 'text-white');
    } else {
        startBtn.disabled = true;
        startBtn.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        startBtn.classList.remove('bg-blue-800', 'hover:bg-blue-900', 'text-white');
    }
}

// ===== STEP 3: START EXAM =====
async function startExam() {
    const btn = document.getElementById('start-exam-btn');
    btn.textContent = 'Initializing Secure Environment...';
    btn.disabled = true;

    try {
        const testData = verifiedExam.data || {};
        const liveStudents = testData.liveStudents || {};

        // Add or update student in liveStudents
        if (!liveStudents[verifiedStudent.email]) {
            liveStudents[verifiedStudent.email] = {
                studentName: verifiedStudent.name,
                studentEmail: verifiedStudent.email,
                joinedAt: new Date().toISOString(),
                answered: 0,
                total: testData.questions ? testData.questions.length : 0,
                is_online: true,
                score: 0
            };

            testData.liveStudents = liveStudents;

            // Update Supabase
            const { error: updateErr } = await supabaseClient
                .from('tests')
                .update({ data: testData })
                .eq('code', verifiedExam.code);

            if (updateErr) {
                console.error("Failed to join exam on server:", updateErr);
                alert("Failed to connect to the exam server. Please retry.");
                btn.textContent = 'Acknowledge & Start Exam';
                btn.disabled = false;
                return;
            }
        }

        // Save local session state
        localStorage.setItem('loggedInStudent', JSON.stringify(verifiedStudent));
        localStorage.setItem('activeExamCode', verifiedExam.code);
        // Set a flag indicating they bypassed Supabase Auth
        localStorage.setItem('authBypass', 'true');

        window.location.replace('student-dashboard.html');

    } catch (err) {
        console.error('Start Exam Error:', err);
        alert('An unexpected error occurred. Please try again.');
        btn.textContent = 'Acknowledge & Start Exam';
        btn.disabled = false;
    }
}