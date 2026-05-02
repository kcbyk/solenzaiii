document.addEventListener('DOMContentLoaded', () => {
    console.log("Solenzi Core Başlatılıyor...");
    
    // --- 1. Global State ---
    let chats = JSON.parse(localStorage.getItem('solenz_chats')) || [];
    let currentChatId = null;
    let currentRole = 'general';
    let systemPrompt = localStorage.getItem('solenz_system_prompt') || "";
    let selectedAttachments = [];
    let currentUserUid = null;

    // Feature Toggles
    let isWebSearchActive = false;
    let isReasoningActive = false;
    let isImageGenActive = false;
    let isLastQuakesActive = false;

    // --- 2. DOM Elements ---
    const getEl = (id) => document.getElementById(id);

    // Auth Elements
    const authScreen = getEl('authScreen');
    const appLayout = getEl('appLayout');
    const loginForm = getEl('loginForm');
    const registerForm = getEl('registerForm');
    const loginEmail = getEl('loginEmail');
    const loginPass = getEl('loginPass');
    const regName = getEl('regName');
    const regEmail = getEl('regEmail');
    const regPass = getEl('regPass');

    // Chat UI Elements
    const userInput = getEl('userInput');
    const sendBtn = getEl('sendBtn');
    const messagesList = getEl('messagesList');
    const welcomeScreen = getEl('welcomeScreen');
    const sidebar = getEl('sidebar');
    const sidebarOverlay = getEl('sidebarOverlay');
    const historyList = getEl('historyList');
    const pinnedList = getEl('pinnedList');
    const pinnedGroup = getEl('pinnedGroup');
    const modelDropdown = getEl('modelDropdown');
    const roleDropdown = getEl('roleDropdown');
    const moreDropdown = getEl('moreDropdown');
    const userMenuDropdown = getEl('userMenuDropdown');

    // --- 3. Firebase Configuration ---
    const firebaseConfig = { 
        apiKey: "AIzaSyDDT_Hbzi6xVlESl3_lOryLoCKePi5We00", 
        authDomain: "solenzzai.firebaseapp.com", 
        projectId: "solenzzai", 
        storageBucket: "solenzzai.firebasestorage.app", 
        messagingSenderId: "1006831041210", 
        appId: "1:1006831041210:web:cdb28fcea10a53fed1a083" 
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const auth = firebase.auth();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- 4. Core Functions ---

    async function loadUserChats(uid) {
        currentUserUid = uid;
        try {
            const snapshot = await db.collection('users').doc(uid).collection('chats').orderBy('createdAt', 'desc').get();
            chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderHistory();
        } catch (error) { console.error("Sohbet yükleme hatası:", error); }
    }

    function renderHistory() {
        if (!historyList || !pinnedList) return;
        historyList.innerHTML = '';
        pinnedList.innerHTML = '';
        const pinnedChats = chats.filter(c => c.pinned);
        const unpinnedChats = chats.filter(c => !c.pinned);
        if (pinnedGroup) pinnedGroup.style.display = pinnedChats.length > 0 ? 'block' : 'none';
        pinnedChats.forEach(chat => pinnedList.appendChild(createHistoryItem(chat)));
        unpinnedChats.forEach(chat => historyList.appendChild(createHistoryItem(chat)));
    }

    function createHistoryItem(chat) {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        item.innerHTML = `
            <span class="item-text">${chat.title || "Yeni Sohbet"}</span>
            <div class="history-actions">
                <button class="action-btn pin ${chat.pinned ? 'active' : ''}"><span class="material-symbols-outlined">${chat.pinned ? 'keep_off' : 'keep'}</span></button>
                <button class="action-btn delete"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
        item.addEventListener('click', (e) => { if (!e.target.closest('.action-btn')) loadChat(chat.id); });
        item.querySelector('.pin').addEventListener('click', (e) => { e.stopPropagation(); chat.pinned = !chat.pinned; saveChats(); });
        item.querySelector('.delete').addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Silmek istediğine emin misin?')) { chats = chats.filter(c => c.id !== chat.id); if (currentChatId === chat.id) startNewChat(); saveChats(); } });
        return item;
    }

    function loadChat(id) {
        currentChatId = id;
        const chat = chats.find(c => c.id === id);
        if (!chat) return;
        if (messagesList) messagesList.innerHTML = '';
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        chat.messages.forEach(msg => addMessageToUI(msg.text, msg.sender, true));
        renderHistory();
        closeSidebar();
    }

    function startNewChat() {
        currentChatId = null;
        if (messagesList) messagesList.innerHTML = '';
        if (welcomeScreen) welcomeScreen.style.display = 'block';
        if (userInput) { userInput.value = ''; userInput.style.height = 'auto'; }
        if (sendBtn) sendBtn.disabled = true;
        renderHistory();
        closeSidebar();
    }

    function closeSidebar() {
        if (window.innerWidth <= 768) {
            sidebar?.classList.remove('active');
            sidebarOverlay?.classList.remove('active');
        }
    }

    function saveChats() {
        localStorage.setItem('solenz_chats', JSON.stringify(chats));
        renderHistory();
        if (currentChatId && currentUserUid) {
            const chat = chats.find(c => c.id === currentChatId);
            if (chat) db.collection('users').doc(currentUserUid).collection('chats').doc(String(chat.id)).set(chat, { merge: true });
        }
    }

    function addMessageToUI(text, sender, isHtml = false) {
        if (!messagesList) return;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        let processedText = text || "";
        if (sender === 'bot') {
            const pollinationsRegex = /(?:!\[.*?\]\()?https:\/\/pollinations\.ai\/p\/[^\s\)\n]+(?:\?[^\s\)\n]*)?\)?/g;
            processedText = processedText.replace(pollinationsRegex, (match) => {
                let url = match.replace(/^!\[.*?\]\(/, '').replace(/\)$/, '').trim().split(' ')[0].split('\n')[0];
                return `<div class="ai-generated-container" style="margin:20px 0;background:#000;border-radius:16px;padding:4px;border:1px solid var(--border-color);width:fit-content;max-width:100%;">
                    <img src="${url}" alt="AI Image" style="width:100%;max-height:512px;object-fit:contain;border-radius:12px;display:block;cursor:zoom-in;" onclick="window.open('${url}','_blank')">
                    <div style="font-size:10px;color:#888;padding:8px;text-align:center;">Solenzi Core tarafından oluşturuldu</div></div>`;
            });
        }
        const content = isHtml ? processedText : `<p>${processedText.replace(/\n/g, '<br>')}</p>`;
        messageDiv.innerHTML = `<div class="message-wrapper"><div class="avatar">${sender === 'bot' ? 'S' : 'U'}</div><div class="msg-content">${content}</div></div>`;
        messagesList.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    async function sendMessage() {
        const text = userInput?.value.trim();
        if (!text) return;
        if (!currentChatId) {
            currentChatId = Date.now();
            chats.unshift({ id: currentChatId, title: text.substring(0, 30) || "Yeni Sohbet", messages: [], pinned: false, createdAt: Date.now() });
            if (welcomeScreen) welcomeScreen.style.display = 'none';
        }
        const chat = chats.find(c => c.id === currentChatId);
        const messageHtml = `<p>${text.replace(/\n/g, '<br>')}</p>`;
        chat.messages.push({ text: messageHtml, sender: 'user' });
        addMessageToUI(messageHtml, 'user', true);
        if (userInput) { userInput.value = ''; userInput.style.height = 'auto'; if (sendBtn) sendBtn.disabled = true; }
        
        showTypingIndicator();
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, role: currentRole, states: { search: isWebSearchActive, reasoning: isReasoningActive, imageGen: isImageGenActive, lastQuakes: isLastQuakesActive }, history: chat.messages.slice(-5) })
            });
            const data = await response.json();
            getEl('typingIndicator')?.remove();
            if (data.error) throw new Error(data.error);
            chat.messages.push({ text: data.text, sender: 'bot' });
            addMessageToUI(data.text, 'bot');
            saveChats();
        } catch (error) {
            getEl('typingIndicator')?.remove();
            addMessageToUI(error.message || "Bağlantı hatası!", 'bot');
        }
    }

    function showTypingIndicator() {
        if (!messagesList) return;
        const div = document.createElement('div');
        div.id = 'typingIndicator';
        div.className = 'message bot typing';
        div.innerHTML = `<div class="message-wrapper"><div class="avatar">S</div><div class="msg-content">Solenzi yazıyor...</div></div>`;
        messagesList.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth' });
    }

    // --- 5. Event Listeners ---
    const addSafeListener = (id, event, callback) => {
        const el = getEl(id);
        if (el) el.addEventListener(event, callback);
    };

    addSafeListener('toRegister', 'click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'block'; });
    addSafeListener('toLogin', 'click', (e) => { e.preventDefault(); registerForm.style.display = 'none'; loginForm.style.display = 'block'; });
    
    addSafeListener('loginSubmit', 'click', async () => {
        const email = loginEmail?.value.trim(); const pass = loginPass?.value.trim();
        if (!email || !pass) return alert('Doldurun.');
        try {
            const res = await auth.signInWithEmailAndPassword(email, pass);
            if (!res.user.emailVerified) { alert('E-postanızı doğrulayın.'); await auth.signOut(); }
        } catch (e) { alert('Hata: ' + e.message); }
    });

    addSafeListener('regSubmit', 'click', async () => {
        const name = regName?.value.trim(); const email = regEmail?.value.trim(); const pass = regPass?.value.trim();
        if (!name || !email || !pass) return alert('Doldurun.');
        try {
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: name });
            await res.user.sendEmailVerification();
            await db.collection('users').doc(res.user.uid).set({ name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            alert('Başarılı! E-postanızı kontrol edin.');
            await auth.signOut();
        } catch (e) { alert('Hata: ' + e.message); }
    });

    addSafeListener('googleLogin', 'click', async () => {
        try { if (window.innerWidth <= 768) await auth.signInWithRedirect(googleProvider); else await auth.signInWithPopup(googleProvider); }
        catch (e) { alert('Google hatası: ' + e.message); }
    });

    addSafeListener('logoutBtn', 'click', () => auth.signOut());
    addSafeListener('sendBtn', 'click', sendMessage);
    addSafeListener('newChatSidebarBtn', 'click', startNewChat);
    addSafeListener('newChatTopBtn', 'click', startNewChat);
    addSafeListener('menuToggle', 'click', () => { sidebar?.classList.toggle('active'); sidebarOverlay?.classList.toggle('active'); });
    addSafeListener('sidebarOverlay', 'click', () => { sidebar?.classList.remove('active'); sidebarOverlay?.classList.remove('active'); });

    // Feature Toggles
    addSafeListener('webSearchBtn', 'click', function() { isWebSearchActive = !isWebSearchActive; this.classList.toggle('active', isWebSearchActive); });
    addSafeListener('reasoningBtn', 'click', function() { isReasoningActive = !isReasoningActive; this.classList.toggle('active', isReasoningActive); });
    addSafeListener('imageGenBtn', 'click', function() { isImageGenActive = !isImageGenActive; this.classList.toggle('active', isImageGenActive); });
    addSafeListener('lastEarthquakesBtn', 'click', function() { isLastQuakesActive = !isLastQuakesActive; this.classList.toggle('active', isLastQuakesActive); });

    // Dropdowns
    addSafeListener('userProfileBtn', 'click', (e) => { e.stopPropagation(); userMenuDropdown?.classList.toggle('active'); });
    addSafeListener('modelSelectorBtn', 'click', (e) => { e.stopPropagation(); modelDropdown?.classList.toggle('active'); });
    addSafeListener('roleMenuBtn', 'click', (e) => { e.stopPropagation(); roleDropdown?.classList.toggle('active'); });
    addSafeListener('moreMenuBtn', 'click', (e) => { e.stopPropagation(); moreDropdown?.classList.toggle('active'); });
    addSafeListener('attachMenuBtn', 'click', (e) => { e.stopPropagation(); getEl('attachmentMenu')?.classList.toggle('active'); });
    addSafeListener('featureMenuBtn', 'click', (e) => { e.stopPropagation(); getEl('featureMenu')?.classList.toggle('active'); });
    addSafeListener('visionMenuBtn', 'click', (e) => { e.stopPropagation(); getEl('visionMenu')?.classList.toggle('active'); });
    addSafeListener('earthquakeMenuBtn', 'click', (e) => { e.stopPropagation(); getEl('earthquakeMenu')?.classList.toggle('active'); });

    document.addEventListener('click', () => {
        [userMenuDropdown, modelDropdown, roleDropdown, moreDropdown, getEl('attachmentMenu'), getEl('featureMenu'), getEl('visionMenu'), getEl('earthquakeMenu')].forEach(el => el?.classList.remove('active'));
    });

    if (userInput) {
        userInput.addEventListener('input', () => { userInput.style.height = 'auto'; userInput.style.height = (userInput.scrollHeight) + 'px'; if (sendBtn) sendBtn.disabled = userInput.value.trim() === ''; });
        userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    }

    // --- 6. Auth Observer ---
    auth.onAuthStateChanged(user => {
        console.log("Auth:", user ? user.email : "Yok");
        if (user) {
            const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
            if (user.emailVerified || isGoogle) {
                if (authScreen) authScreen.style.display = 'none';
                if (appLayout) { appLayout.style.display = 'flex'; appLayout.classList.add('active'); }
                const nDisp = getEl('userNameDisplay'); const eDisp = getEl('userEmailDisplay'); const av = getEl('userAvatar');
                if (nDisp) nDisp.textContent = user.displayName || 'Kullanıcı';
                if (eDisp) eDisp.textContent = user.email;
                if (av) av.textContent = (user.displayName || user.email).charAt(0).toUpperCase();
                loadUserChats(user.uid);
            } else {
                if (authScreen) authScreen.style.display = 'flex';
                if (appLayout) appLayout.style.display = 'none';
            }
        } else {
            if (authScreen) authScreen.style.display = 'flex';
            if (appLayout) { appLayout.style.display = 'none'; appLayout.classList.remove('active'); }
            startNewChat();
        }
    });

    auth.getRedirectResult().catch(e => console.error("Google error:", e));
});
