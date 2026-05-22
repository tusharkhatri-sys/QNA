// ============================================================
// QNA SAFE BROWSER — preload.js
// Runs in renderer context with context isolation
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

// ─── EXPOSE SECURE EXIT API TO RENDERER ────────────────────
// Only exposes closeApp() — no raw IPC or Node access leaked
contextBridge.exposeInMainWorld('qnaBrowser', {
    closeApp: function () {
        ipcRenderer.send('close-app');
    }
});

// Block right-click context menu at the renderer level
window.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}, true);

// Block dangerous keyboard shortcuts at the renderer level (defense in depth)
window.addEventListener('keydown', function (e) {
    // F12 — DevTools
    if (e.key === 'F12') {
        e.preventDefault();
        return false;
    }

    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C — DevTools
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+U — View Source
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+S — Save page
    if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+P — Print
    if (e.ctrlKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+L — Address bar
    if (e.ctrlKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        return false;
    }

    // Alt+F4 — Close
    if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        return false;
    }

    // Ctrl+W / Ctrl+Q — Close tab/app
    if (e.ctrlKey && (e.key === 'W' || e.key === 'w' || e.key === 'Q' || e.key === 'q')) {
        e.preventDefault();
        return false;
    }

    // PrintScreen
    if (e.key === 'PrintScreen') {
        e.preventDefault();
        return false;
    }
}, true);

// Block drag and drop (prevent file drops)
window.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
}, true);

window.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
}, true);

// Disable text selection on body (optional — remove if students need to select text)
// document.addEventListener('DOMContentLoaded', function() {
//     document.body.style.userSelect = 'none';
//     document.body.style.webkitUserSelect = 'none';
// });

// Console warning
console.log('%c⚠️ QNA Safe Browser Active', 'color: #e11d48; font-size: 20px; font-weight: bold;');
console.log('%cThis browser is in lockdown mode. DevTools access is restricted.', 'color: #94a3b8; font-size: 12px;');
