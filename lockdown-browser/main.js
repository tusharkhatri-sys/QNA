// ============================================================
// QNA SAFE LOCKDOWN BROWSER — main.js
// Enterprise-grade exam browser with kiosk mode & security locks
// ============================================================

const { app, BrowserWindow, globalShortcut, session, dialog, Menu, ipcMain } = require('electron');
const path = require('path');

// ─── DEV MODE FLAG ──────────────────────────────────────────
// Pass --dev via CLI to run in a normal resizable window.
//   npm run start:dev   (or: npx electron . --dev)
// Without the flag, full lockdown/kiosk mode is active.
const DEV_MODE = process.argv.includes('--dev');

// ─── CONFIGURATION ───────────────────────────────────────────────
const EXAM_URL = 'https://qnacopa.vercel.app/pages/auth.html';
const ADMIN_DASHBOARD_URL = 'https://qnacopa.vercel.app/pages/admin-login.html';
const CUSTOM_USER_AGENT = 'QnaCopa-Safe-Browser-v1';
const APP_TITLE = 'QNA Safe Browser';

// Paths where the user is allowed to completely close the safe browser
const ALLOWED_EXIT_PATHS = [
    '/pages/landing.html', '/pages/auth.html', '/auth.html', '/landing.html',
    '/pages/landing', '/pages/auth', '/auth', '/landing', '/pages/student.html', '/student.html'
];

// ─── AUTO-UPDATER (Ready to enable) ─────────────────────────
// Uncomment the lines below when you set up GitHub Releases:
//
// const { autoUpdater } = require('electron-updater');
// autoUpdater.autoDownload = true;
// autoUpdater.autoInstallOnAppQuit = true;

// ─── PREVENT MULTIPLE INSTANCES ─────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

let mainWindow = null;

// ─── REMOVE APPLICATION MENU ────────────────────────────────
Menu.setApplicationMenu(null);

// ─── CREATE LOCKDOWN WINDOW ─────────────────────────────────
function createLockdownWindow() {
    mainWindow = new BrowserWindow({
        // ── Window mode: dev = normal window, prod = kiosk ──
        fullscreen: !DEV_MODE,
        kiosk: !DEV_MODE,
        alwaysOnTop: !DEV_MODE,

        // ── Chrome: dev = normal frame, prod = frameless ──
        frame: DEV_MODE,
        titleBarStyle: DEV_MODE ? 'default' : 'hidden',
        closable: DEV_MODE,
        minimizable: DEV_MODE,
        maximizable: DEV_MODE,
        resizable: DEV_MODE,
        movable: DEV_MODE,
        skipTaskbar: !DEV_MODE,

        // Dev-mode window size (ignored in kiosk)
        width: DEV_MODE ? 1200 : undefined,
        height: DEV_MODE ? 800 : undefined,

        // Security settings
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,  // Required for contextBridge IPC
            devTools: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            navigateOnDragDrop: false,
            spellcheck: false
        },

        // Visual
        backgroundColor: '#0f172a',
        title: DEV_MODE ? APP_TITLE + ' [DEV]' : APP_TITLE,
        show: false,
        autoHideMenuBar: !DEV_MODE
    });

    // ─── SET CUSTOM USER-AGENT ──────────────────────────────
    mainWindow.webContents.setUserAgent(CUSTOM_USER_AGENT);

    // ─── LOAD EXAM URL ──────────────────────────────────────
    if (DEV_MODE) {
        mainWindow.loadFile(path.join(__dirname, '../public/pages/landing.html'));
    } else {
        mainWindow.loadURL(EXAM_URL);
    }

    // Show window when page is ready (prevents white flash)
    mainWindow.webContents.once('did-finish-load', function () {
        mainWindow.show();
        mainWindow.focus();
        if (!DEV_MODE) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }

        // Open DevTools call removed as per user request
        if (DEV_MODE) {
            console.log('\n  🔧 DEV MODE ACTIVE — kiosk/security locks disabled\n');
        }

        // Auto-updater check (uncomment when ready)
        // autoUpdater.checkForUpdatesAndNotify();
    });

    // ─── BLOCK ALL NAVIGATION AWAY FROM EXAM ────────────────
    mainWindow.webContents.on('will-navigate', function (event, url) {
        if (DEV_MODE) return; // Skip in dev mode

        // Allow navigation within same origin
        var examOrigin = new URL(EXAM_URL).origin;
        var targetOrigin = new URL(url).origin;
        if (targetOrigin !== examOrigin) {
            event.preventDefault();
        }
    });

    // Block new window/tab (window.open, target="_blank")
    mainWindow.webContents.setWindowOpenHandler(function () {
        return { action: 'deny' };
    });

    // ─── BLOCK RIGHT-CLICK CONTEXT MENU ─────────────────────
    mainWindow.webContents.on('context-menu', function (event) {
        event.preventDefault();
    });

    // ─── HANDLE WINDOW CLOSE ATTEMPT ────────────────────────
    mainWindow.on('close', function (event) {
        // In dev mode, close instantly without confirmation
        if (DEV_MODE) return;

        event.preventDefault();
        var response = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning',
            buttons: ['Cancel', 'Exit Exam'],
            defaultId: 0,
            title: 'QNA Safe Browser',
            message: 'Are you sure you want to exit the exam?',
            detail: 'WARNING: Leaving the exam browser may result in your test being marked as incomplete. Only exit if you have submitted your test.',
            noLink: true
        });

        if (response === 1) {
            // User confirmed exit
            mainWindow.destroy();
            app.quit();
        }
    });

    // ─── PREVENT FOCUS LOSS (production only) ───────────────
    if (!DEV_MODE) {
        mainWindow.on('blur', function () {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.focus();
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
            }
        });
    }

    // Handle crashed renderer
    mainWindow.webContents.on('render-process-gone', function (event, details) {
        dialog.showErrorBox('QNA Safe Browser Error', 'The browser encountered an error. Restarting...');
        if (DEV_MODE) {
            mainWindow.loadFile(path.join(__dirname, '../public/pages/landing.html'));
        } else {
            mainWindow.loadURL(EXAM_URL);
        }
    });
}

// ─── REGISTER SECURITY SHORTCUTS ────────────────────────────
function registerSecurityLocks() {
    // Block ALL dangerous keyboard shortcuts
    var blockedShortcuts = [
        // Window management
        'Alt+Tab',
        'Alt+F4',
        'Alt+Escape',
        'Alt+Space',

        // Task manager / System
        'Control+Shift+Escape',
        'Control+Alt+Delete',

        // Developer tools
        'Control+Shift+I',
        'Control+Shift+J',
        'Control+Shift+C',
        'F12',

        // Browser shortcuts
        'Control+T',        // New tab
        'Control+N',        // New window
        'Control+W',        // Close tab
        'Control+Q',        // Quit
        'Control+R',        // Refresh (optional — you may want to allow this)
        'Control+Shift+R',  // Hard refresh
        'Control+L',        // Address bar
        'Control+D',        // Bookmark
        'Control+H',        // History
        'Control+J',        // Downloads
        'Control+P',        // Print
        'Control+S',        // Save
        'Control+U',        // View source
        'Control+G',        // Find next
        'Control+F',        // Find (optional)
        'F5',               // Refresh
        'F11',              // Fullscreen toggle

        // Windows key combinations
        'Super+D',          // Show desktop
        'Super+E',          // File explorer
        'Super+R',          // Run dialog
        'Super+L',          // Lock screen
        'Super+Tab',        // Task view
        'Super+Up',
        'Super+Down',
        'Super+Left',
        'Super+Right',

        // Clipboard (optional — may want to allow for exam)
        // 'Control+C',
        // 'Control+V',
        // 'Control+X',

        // Screenshot
        'PrintScreen',
        'Alt+PrintScreen',
        'Super+Shift+S',    // Windows Snipping Tool
        'Control+PrintScreen'
    ];

    blockedShortcuts.forEach(function (shortcut) {
        try {
            globalShortcut.register(shortcut, function () {
                // Silently block — do nothing
                return;
            });
        } catch (e) {
            // Some shortcuts may not be registerable on all platforms
            console.log('Could not register shortcut: ' + shortcut);
        }
    });
}

// ─── BLOCK EXTERNAL PROTOCOL REQUESTS ───────────────────────
function setupSessionSecurity() {
    // Block requests to non-exam domains
    var examOrigin = new URL(EXAM_URL).origin;

    session.defaultSession.webRequest.onBeforeRequest(function (details, callback) {
        if (DEV_MODE) {
            callback({ cancel: false });
            return;
        }

        var requestUrl = details.url;
        var examOrigin = new URL(EXAM_URL).origin;

        // Allow data URIs, blob URIs, and same-origin requests
        if (requestUrl.startsWith('data:') ||
            requestUrl.startsWith('blob:') ||
            requestUrl.startsWith(examOrigin)) {
            callback({ cancel: false });
            return;
        }

        // Allow CDN resources (fonts, Supabase, etc.)
        var allowedDomains = [
            'fonts.googleapis.com',
            'fonts.gstatic.com',
            'cdn.jsdelivr.net',
            'supabase.co',
            'supabase.in',
            'vercel.app',
            'vercel-scripts.com',
            'vercel-insights.com'
        ];

        var isAllowed = allowedDomains.some(function (domain) {
            return requestUrl.includes(domain);
        });

        callback({ cancel: !isAllowed });
    });

    // Set custom user agent for all requests
    session.defaultSession.webRequest.onBeforeSendHeaders(function (details, callback) {
        details.requestHeaders['User-Agent'] = CUSTOM_USER_AGENT;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
}

// ─── IPC: EXIT BROWSER FROM AUTH PAGE ───────────────────────
ipcMain.on('exit-app', function () {
    app.quit();
});

ipcMain.on('close-app', function () {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    var currentUrl = mainWindow.webContents.getURL();
    var isOnAuthPage = ALLOWED_EXIT_PATHS.some(function (p) {
        return currentUrl.includes(p);
    });

    if (isOnAuthPage) {
        // User is on login/register — safe to exit
        mainWindow.destroy();
        app.quit();
    } else {
        // User is on exam/quiz page — block the exit request
        console.log('Exit blocked: user is not on auth page. Current URL: ' + currentUrl);
    }
});

// ─── APP LIFECYCLE ──────────────────────────────────────────
app.whenReady().then(function () {
    setupSessionSecurity();
    createLockdownWindow();
    // Skip shortcut blocking in dev mode so Alt+Tab, F12 etc. work normally
    if (!DEV_MODE) {
        registerSecurityLocks();
    }

    // Critical Backup: globalShortcut for Ctrl+Shift+X or Escape
    globalShortcut.register('CommandOrControl+Shift+X', function () {
        app.quit();
    });
    globalShortcut.register('Escape', function () {
        app.quit();
    });
});

// Second instance tried to launch — focus existing window
app.on('second-instance', function () {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// Prevent all windows from being closed without confirmation
app.on('window-all-closed', function () {
    app.quit();
});

// Re-register shortcuts when app regains focus (production only)
if (!DEV_MODE) {
    app.on('browser-window-focus', function () {
        if (!globalShortcut.isRegistered('Alt+Tab')) {
            registerSecurityLocks();
        }
    });
}

// Clean up shortcuts on quit
app.on('will-quit', function () {
    globalShortcut.unregisterAll();
});

// ─── AUTO-UPDATER EVENTS (Uncomment when ready) ─────────────
// autoUpdater.on('update-available', function (info) {
//     dialog.showMessageBox(mainWindow, {
//         type: 'info',
//         title: 'Update Available',
//         message: 'A new version (' + info.version + ') is being downloaded...'
//     });
// });
//
// autoUpdater.on('update-downloaded', function () {
//     var response = dialog.showMessageBoxSync(mainWindow, {
//         type: 'info',
//         buttons: ['Restart Now', 'Later'],
//         title: 'Update Ready',
//         message: 'A new version has been downloaded. Restart to apply the update?'
//     });
//     if (response === 0) {
//         autoUpdater.quitAndInstall();
//     }
// });
//
// autoUpdater.on('error', function (err) {
//     console.error('Auto-update error:', err);
// });
