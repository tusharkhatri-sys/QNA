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

function exitSafeBrowser() {
    if (window.qnaBrowser && typeof window.qnaBrowser.closeApp === 'function') {
        window.qnaBrowser.closeApp();
    } else {
        alert("This feature only works in the QNA Safe Browser.");
    }
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