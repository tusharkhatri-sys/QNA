// ===== SHARED CONFIG & UTILS =====
const SUPABASE_URL = 'https://gxfojevrtvexfootbzjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Zm9qZXZydHZleGZvb3Riemp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDg5MTMsImV4cCI6MjA5MzAyNDkxM30.0MP9rW4UdOYT3irbPqCjY352g8vr1b92zymXeqsnD8w';

// ─── Capacitor-Aware Persistent Storage for Supabase Auth ───
// window.localStorage is wiped by Android when process is killed.
// @capacitor/preferences uses Android SharedPreferences — survives kills.
// This adapter tries Capacitor first, falls back to localStorage on web.
const CapacitorStorage = {
    _cap: null,

    _getPlugin() {
        if (this._cap !== null) return this._cap;
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
                this._cap = window.Capacitor.Plugins.Preferences;
            } else {
                this._cap = false; // not available
            }
        } catch (e) {
            this._cap = false;
        }
        return this._cap;
    },

    async getItem(key) {
        const cap = this._getPlugin();
        if (cap) {
            try {
                const { value } = await cap.get({ key });
                return value; // null if not found
            } catch (e) { /* fall through */ }
        }
        return window.localStorage.getItem(key);
    },

    async setItem(key, value) {
        const cap = this._getPlugin();
        if (cap) {
            try {
                await cap.set({ key, value });
                // Mirror to localStorage for same-session reads
                window.localStorage.setItem(key, value);
                return;
            } catch (e) { /* fall through */ }
        }
        window.localStorage.setItem(key, value);
    },

    async removeItem(key) {
        const cap = this._getPlugin();
        if (cap) {
            try {
                await cap.remove({ key });
                window.localStorage.removeItem(key);
                return;
            } catch (e) { /* fall through */ }
        }
        window.localStorage.removeItem(key);
    }
};

// 1. Supabase init with Capacitor-aware persistent storage
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        storage: CapacitorStorage,   // ← uses SharedPreferences on Android
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});


const API_URL = '/api';

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function getLoggedInStudent() {
    try {
        const saved = window.localStorage.getItem('loggedInStudent');
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        // Forgiving: only reject if completely not an object (genuine corruption)
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed; // Return whatever is there, even if email/name is missing
    } catch (e) {
        // Only clear on actual JSON parse failure, not structural mismatch
        console.warn('[getLoggedInStudent] JSON parse failed, clearing.', e);
        window.localStorage.removeItem('loggedInStudent');
        return null;
    }
}



// Global Dynamic Session Calculator
function getCurrentSession() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 5) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

// Ensure session is fresh before critical operations
async function ensureSupabaseSession() {
    try {
        if (!supabaseClient || !supabaseClient.auth) {
            console.error('Supabase client or auth module is missing.');
            return null;
        }
        const { data, error } = await supabaseClient.auth.getSession();
        if (!data || !data.session || error) {
            console.warn('Session expired or missing. Attempting refresh...');
            const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
            if (refreshError) {
                console.error('Session refresh failed due to error:', refreshError);
                return null;
            }
            if (!refreshData || !refreshData.session) {
                console.error('Session refresh failed: no session returned.');
                return null;
            }
            return refreshData.session;
        }
        return data.session;
    } catch (e) {
        console.error('Session refresh threw a fatal error:', e);
        return null; 
    }
}

// 2. The Boot Lock: Await Capacitor Hydration Complete Before Any UI Checks
async function ensureSupabaseAuthReady() {
    return new Promise((resolve) => {
        let isResolved = false;

        const complete = (session) => {
            if (isResolved) return;
            isResolved = true;
            if (authListener && authListener.subscription) {
                authListener.subscription.unsubscribe();
            }
            resolve(session);
        };

        // Fallback timeout: 3s for Capacitor Preferences hydration on slow Android devices
        const timeout = setTimeout(() => {
            console.warn('[Boot Lock] Supabase hydration check timed out (3000ms). Releasing lock.');
            complete(null);
        }, 3000);

        // Listen for the exact moment Supabase finishes resolving local storage
        // NOTE: SIGNED_OUT must NOT resolve the boot lock — it would cause a redirect loop
        const { data: authListener } = supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                console.log(`[Boot Lock] Supabase Auth State Hydrated: ${event}`);
                clearTimeout(timeout);
                complete(session);
            } else if (event === 'SIGNED_OUT') {
                console.log('[Boot Lock] SIGNED_OUT detected. Releasing with null.');
                clearTimeout(timeout);
                complete(null);
            }
        });

        // Defensive redundant check: Catch if hydration happened milliseconds before listener bound
        supabaseClient.auth.getSession().then(({ data }) => {
            if (data && data.session) {
                clearTimeout(timeout);
                complete(data.session);
            }
        }).catch(() => { /* Silent catch, listener/timeout will handle failure */ });
    });
}

// Background session maintainer
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
        console.log('Background session token secured.');
    }
});