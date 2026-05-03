document.addEventListener('DOMContentLoaded', () => {
    console.log("Solenz AI initialized.");

    // --- 1. State Management ---
    let state = {
        user: null,
        chats: [],
        currentChatId: null,
        theme: localStorage.getItem('solenz_theme') || 'light'
    };

    // --- 2. Helper Functions ---
    const getEl = (id) => document.getElementById(id);
    const getAll = (sel) => document.querySelectorAll(sel);

    // --- 3. Firebase Config ---
    const firebaseConfig = {
        apiKey: "AIzaSyDDT_Hbzi6xVlESl3_lOryLoCKePi5We00",
        authDomain: "solenzzai.firebaseapp.com",
        projectId: "solenzzai",
        storageBucket: "solenzzai.firebasestorage.app",
        messagingSenderId: "1006831041210",
        appId: "1:1006831041210:web:cdb28fcea10a53fed1a083"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- 4. Auth Logic ---
    const updateAuthUI = (user) => {
        state.user = user;
        if (user) {
            getEl('authScreen').style.display = 'none';
            getEl('appLayout').style.display = 'flex';
            getEl('userName').textContent = user.displayName || 'Kullanıcı';
            getEl('userEmail').textContent = user.email;
            getEl('userAvatar').textContent = (user.displayName || user.email).charAt(0).toUpperCase();
            loadChats();
        } else {
            getEl('authScreen').style.display = 'flex';
            getEl('appLayout').style.display = 'none';
        }
    };

    const loadChats = async () => {
        if (!state.user) return;
        const snap = await db.collection('users').doc(state.user.uid).collection('chats').orderBy('createdAt', 'desc').limit(20).get();
        state.chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistory();
    };

    const renderHistory = () => {
        const list = getEl('chatHistoryList');
        list.innerHTML = '';
        state.chats.forEach(chat => {
            const div = document.createElement('div');
            div.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
            div.textContent = chat.title || 'Yeni Sohbet';
            div.onclick = () => switchChat(chat.id);
            list.appendChild(div);
        });
    };

    const switchChat = (id) => {
        state.currentChatId = id;
        const chat = state.chats.find(c => c.id === id);
        if (!chat) return;
        getEl('messagesList').innerHTML = '';
        getEl('welcomeScreen').style.display = 'none';
        chat.messages.forEach(m => appendMessageUI(m.text, m.sender));
        renderHistory();
        if (window.innerWidth <= 768) toggleSidebar(false);
    };

    const startNewChat = () => {
        state.currentChatId = null;
        getEl('messagesList').innerHTML = '';
        getEl('welcomeScreen').style.display = 'flex';
        getEl('userInput').value = '';
        renderHistory();
    };

    // --- 5. UI Logic ---
    const toggleSidebar = (force) => {
        const sidebar = getEl('sidebar');
        const overlay = getEl('sidebarOverlay');
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('active', force);
            overlay.classList.toggle('active', force);
        } else {
            sidebar.classList.toggle('collapsed');
        }
    };

    const appendMessageUI = (text, sender) => {
        const list = getEl('messagesList');
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerHTML = `<div class="message-wrapper"><div class="msg-content">${text}</div></div>`;
        list.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth' });
    };

    const sendMessage = async () => {
        const input = getEl('userInput');
        const text = input.value.trim();
        if (!text) return;

        if (!state.currentChatId) {
            state.currentChatId = Date.now().toString();
            getEl('welcomeScreen').style.display = 'none';
        }

        appendMessageUI(text, 'user');
        input.value = '';
        input.style.height = 'auto';
        getEl('sendBtn').disabled = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history: [] })
            });
            const data = await res.json();
            if (data.text) {
                appendMessageUI(data.text, 'bot');
                // Save to Firebase (Optional: implemented in a real scenario)
            }
        } catch (e) {
            appendMessageUI("Bir sorun oluştu. Lütfen tekrar deneyin.", 'bot');
        }
    };

    // --- 6. Event Listeners ---
    getEl('menuBtn').onclick = () => toggleSidebar();
    getEl('mobileMenuBtn').onclick = () => toggleSidebar(true);
    getEl('sidebarOverlay').onclick = () => toggleSidebar(false);
    getEl('newChatBtn').onclick = startNewChat;
    
    getEl('userInput').oninput = function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        getEl('sendBtn').disabled = !this.value.trim();
    };

    getEl('userInput').onkeypress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    getEl('sendBtn').onclick = sendMessage;

    getEl('themeToggle').onclick = () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', state.theme);
        localStorage.setItem('solenz_theme', state.theme);
    };

    getEl('logoutBtn').onclick = () => auth.signOut();

    // Auth Form Toggles
    getEl('showRegister').onclick = (e) => {
        e.preventDefault();
        getEl('loginForm').style.display = 'none';
        getEl('registerForm').style.display = 'block';
    };
    getEl('showLogin').onclick = (e) => {
        e.preventDefault();
        getEl('registerForm').style.display = 'none';
        getEl('loginForm').style.display = 'block';
    };

    getEl('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = getEl('loginEmail').value;
        const pass = getEl('loginPass').value;
        try {
            getEl('authLoading').style.display = 'flex';
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (e) {
            alert(e.message);
            getEl('authLoading').style.display = 'none';
        }
    };

    getEl('googleBtn').onclick = () => {
        if (window.innerWidth <= 768) auth.signInWithRedirect(googleProvider);
        else auth.signInWithPopup(googleProvider);
    };

    // Initialize Theme
    document.body.setAttribute('data-theme', state.theme);

    // Auth Observer
    auth.onAuthStateChanged(user => updateAuthUI(user));
    auth.getRedirectResult().then(r => { if (r.user) updateAuthUI(r.user); });

    // Global quickAsk
    window.quickAsk = (text) => {
        getEl('userInput').value = text;
        getEl('userInput').dispatchEvent(new Event('input'));
        sendMessage();
    };
});
