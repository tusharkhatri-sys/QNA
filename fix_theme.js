const fs = require('fs');
const path = require('path');

const filesToProcess = [
    'public/pages/landing.html',
    'public/index.html',
    'public/pages/admin-dashboard.html',
    'public/pages/admin-students.html',
    'public/pages/admin-tests.html',
    'public/pages/admin-live.html',
    'public/pages/admin-results.html'
];

function transformHtml(content) {
    let newContent = content;

    // Convert Admin Layouts background and text colors
    newContent = newContent.replace(/body \{ background: #[0-9a-fA-F]+; color: #[0-9a-fA-F]+;/g, 'body { background: #FFFFFF; color: #111827;');
    newContent = newContent.replace(/bg-slate-900/g, 'bg-white');
    newContent = newContent.replace(/bg-slate-800/g, 'bg-gray-50');
    newContent = newContent.replace(/text-slate-300/g, 'text-slate-700');
    newContent = newContent.replace(/text-slate-400/g, 'text-slate-600');
    newContent = newContent.replace(/text-white/g, 'text-slate-900'); // General white text to dark text
    newContent = newContent.replace(/border-white\/5/g, 'border-gray-200');
    newContent = newContent.replace(/border-white\/10/g, 'border-gray-300');
    newContent = newContent.replace(/border-white\/20/g, 'border-gray-400');
    newContent = newContent.replace(/glass-card/g, 'bg-white border border-gray-200 shadow-sm');
    
    // Fix Landing page inline style and gradient text
    newContent = newContent.replace(/background: linear-gradient\(135deg, var\(--accent\), #312e81\);/g, 'color: #1D4ED8;');
    newContent = newContent.replace(/-webkit-background-clip: text;/g, '');
    newContent = newContent.replace(/background-clip: text;/g, '');
    newContent = newContent.replace(/-webkit-text-fill-color: transparent;/g, '');
    newContent = newContent.replace(/color: transparent;/g, '');
    newContent = newContent.replace(/background: rgba\(255, 255, 255, 0\.8\);/g, 'background: #FFFFFF;');
    newContent = newContent.replace(/border: 1px solid var\(--border\);/g, 'border: 1px solid #CCCCCC;');
    newContent = newContent.replace(/box-shadow: var\(--shadow-glow\);/g, 'box-shadow: 0 4px 6px rgba(0,0,0,0.1);');
    
    // Ensure the download .exe button is visible and proper blue
    newContent = newContent.replace(/class="download-btn"/g, 'class="download-btn bg-blue-600 text-white"');
    newContent = newContent.replace(/background: var\(--accent\);/g, 'background: #1D4ED8;');
    
    return newContent;
}

filesToProcess.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const updated = transformHtml(content);
        fs.writeFileSync(fullPath, updated);
        console.log(`Updated ${filePath}`);
    } else {
        console.warn(`Could not find ${filePath}`);
    }
});
