const fs = require('fs');
const path = require('path');

const shellHead = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Examination Management Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css?v=5">
    <style>
        body { font-family: 'Inter', Arial, sans-serif; background-color: #F3F4F6; color: #111827; margin: 0; padding: 0; }
        * { transition: none !important; animation: none !important; }
        .border-navy { border-color: #1E3A8A; }
        .bg-navy { background-color: #1E3A8A; }
        .text-navy { color: #1E3A8A; }
        .sidebar-link {
            display: flex; align-items: center; gap: 12px; padding: 12px 16px;
            color: #4B5563; font-weight: 500; border-bottom: 1px solid #E5E7EB; text-decoration: none;
        }
        .sidebar-link:hover, .sidebar-link.active {
            background-color: #F9FAFB; color: #1E3A8A; border-left: 4px solid #1E3A8A; padding-left: 12px;
        }
    </style>
</head>
<body class="flex flex-col h-screen overflow-hidden">

    <!-- Top Navbar -->
    <header class="bg-navy text-white flex items-center justify-between px-6 py-3 border-b-4 border-yellow-500 z-10">
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-navy font-bold">NIC</div>
            <div>
                <h1 class="text-lg font-bold tracking-wide">COPA COMPUTER LAB</h1>
                <div class="text-xs text-blue-200">EXAMINATION MANAGEMENT PORTAL</div>
            </div>
        </div>
        <div class="flex items-center gap-4 text-sm font-medium">
            <span>Admin Control Panel</span>
            <button onclick="logout()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-sm border border-red-800">Logout</button>
        </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar Navigation -->
        <aside class="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
            <nav class="flex-1 mt-4">
                <a href="admin-dashboard.html" class="sidebar-link __DASH_ACTIVE__"><i data-lucide="layout-dashboard" class="w-5 h-5"></i> Dashboard Home</a>
                <a href="admin-live.html" class="sidebar-link"><i data-lucide="activity" class="w-5 h-5"></i> Live Tracking</a>
                <a href="admin-tests.html" class="sidebar-link __TESTS_ACTIVE__"><i data-lucide="server" class="w-5 h-5"></i> Test Sessions</a>
                <a href="admin-students.html" class="sidebar-link __STUDENTS_ACTIVE__"><i data-lucide="users" class="w-5 h-5"></i> Student Management</a>
                <a href="admin-results.html" class="sidebar-link"><i data-lucide="file-text" class="w-5 h-5"></i> Examination Results</a>
            </nav>
            <div class="p-4 border-t border-gray-200 text-xs text-gray-500 text-center">
                System Version 2.0.1<br>Secured by Supabase
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-y-auto bg-gray-50 p-8">`;

const shellTail = `
        </main>
    </div>
    
    <script src="../questions.js"></script>
    <script src="shared.js"></script>
    <script src="admin-core.js"></script>
    <script>
        if(typeof lucide !== 'undefined') { lucide.createIcons(); }
    </script>
</body>
</html>`;

function wrapPage(filePath, activeKey) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Extract everything between <main...> and </main>
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (!mainMatch) {
        console.log("No main tag found in " + filePath);
        return;
    }
    
    let mainContent = mainMatch[1];
    
    // Customize sidebar active state
    let customHead = shellHead
        .replace('__DASH_ACTIVE__', activeKey === 'dash' ? 'active' : '')
        .replace('__TESTS_ACTIVE__', activeKey === 'tests' ? 'active' : '')
        .replace('__STUDENTS_ACTIVE__', activeKey === 'students' ? 'active' : '');
        
    let newFullContent = customHead + mainContent + shellTail;
    
    fs.writeFileSync(fullPath, newFullContent);
    console.log("Updated " + filePath);
}

wrapPage('public/pages/admin-tests.html', 'tests');
wrapPage('public/pages/admin-students.html', 'students');
