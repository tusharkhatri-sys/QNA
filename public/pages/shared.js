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

// Ensure session is fresh before critical operations
async function ensureSupabaseSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (!session || error) {
            console.log('Session expired or missing. Attempting refresh...');
            const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
            if (refreshError) throw refreshError;
            return refreshData.session;
        }
        return session;
    } catch (e) {
        console.error('Session refresh failed:', e);
        return null;
    }
}

// Background session maintainer
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
        console.log('Background session token secured.');
    }
});