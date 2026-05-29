// ===== SHARED CONFIG & UTILS =====
const SUPABASE_URL = 'https://gxfojevrtvexfootbzjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Zm9qZXZydHZleGZvb3Riemp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDg5MTMsImV4cCI6MjA5MzAyNDkxM30.0MP9rW4UdOYT3irbPqCjY352g8vr1b92zymXeqsnD8w';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});
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
    try {
        const saved = window.localStorage.getItem('loggedInStudent');
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || !parsed.email) {
            throw new Error('Invalid student data structure');
        }
        return parsed;
    } catch (e) {
        console.warn('[Defensive Recovery] Corrupted student session data cleared.', e);
        window.localStorage.removeItem('loggedInStudent');
        return null;
    }
}

// Global Dynamic Session Calculator
// Assumes academic year starts in June (month index 5)
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
        // Safe deep check
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
        return null; // Do not throw, return safe fallback
    }
}

// Background session maintainer
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
        console.log('Background session token secured.');
    }
});