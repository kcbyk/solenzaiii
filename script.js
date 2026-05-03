document.addEventListener('DOMContentLoaded', () => {
    console.log("Solenzi Core Final v1.0 Başlatılıyor...");

    // --- 1. Global Değişkenler ---
    let chats = JSON.parse(localStorage.getItem('solenz_chats')) || [];
    let currentChatId = null;
    let currentRole = 'general';
    let systemPrompt = localStorage.getItem('solenz_system_prompt') || "";
    let currentUserUid = null;

    // Durumlar (Toggles)
    let states = {
        webSearch: false,
        reasoning: false,
        imageGen: false,
        lastQuakes: false
    };

    // --- 2. Yardımcı Fonksiyonlar ---
    const getEl = (id) => document.getElementById(id);
    const saveToLocal = () => localStorage.setItem('solenz_chats', JSON.stringify(chats));

    // --- 3. Firebase Yapılandırması ---
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

    // --- 4. UI Yönetimi ---
    const showAuthLoading = (show) => getEl('authLoading').style.display = show ? 'flex' : 'none';
    const showAuthCard = (show) => getEl('authCard').style.display = show ? 'block' : 'none';

    const updateAuthUI = (user) => {
        if (user) {
            getEl('authScreen').style.display = 'none';
            getEl('appLayout').style.display = 'flex';
            getEl('userNameDisplay').textContent = user.displayName || 'Kullanıcı';
            getEl('userEmailDisplay').textContent = user.email;
            getEl('userAvatar').textContent = (user.displayName || user.email).charAt(0).toUpperCase();
            loadUserChats(user.uid);
        } else {
            getEl('authScreen').style.display = 'flex';
            getEl('appLayout').style.display = 'none';
            showAuthCard(true);
            showAuthLoading(false);
        }
    };

    const loadUserChats = async (uid) => {
        currentUserUid = uid;
        try {
            const snap = await db.collection('users').doc(uid).collection('chats').orderBy('createdAt', 'desc').get();
            chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderHistory();
        } catch (e) { console.error("Geçmiş yüklenemedi:", e); }
    };

    const renderHistory = () => {
        const hList = getEl('historyList');
        const pList = getEl('pinnedList');
        if (!hList || !pList) return;

        hList.innerHTML = ''; pList.innerHTML = '';
        const pinned = chats.filter(c => c.pinned);
        const normal = chats.filter(c => !c.pinned);

        getEl('pinnedGroup').style.display = pinned.length > 0 ? 'block' : 'none';

        pinned.forEach(c => pList.appendChild(createHistoryItem(c)));
        normal.forEach(c => hList.appendChild(createHistoryItem(c)));
    };

    const createHistoryItem = (chat) => {
        const div = document.createElement('div');
        div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.innerHTML = `
            <span class="item-text">${chat.title || 'Yeni Sohbet'}</span>
            <div class="history-actions">
                <button class="action-btn pin-btn ${chat.pinned ? 'active' : ''}"><span class="material-symbols-outlined">${chat.pinned ? 'keep_off' : 'keep'}</span></button>
                <button class="action-btn delete-btn"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
        div.onclick = (e) => { if (!e.target.closest('.action-btn')) loadChat(chat.id); };
        div.querySelector('.pin-btn').onclick = (e) => { e.stopPropagation(); chat.pinned = !chat.pinned; syncChat(chat); renderHistory(); };
        div.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); if (confirm('Silinsin mi?')) deleteChat(chat.id); };
        return div;
    };

    const loadChat = (id) => {
        currentChatId = id;
        const chat = chats.find(c => c.id === id);
        if (!chat) return;
        getEl('messagesList').innerHTML = '';
        getEl('welcomeScreen').style.display = 'none';
        chat.messages.forEach(m => addMessageToUI(m.text, m.sender));
        renderHistory();
        if (window.innerWidth <= 768) getEl('sidebar').classList.remove('active');
    };

    const startNewChat = () => {
        currentChatId = null;
        getEl('messagesList').innerHTML = '';
        getEl('welcomeScreen').style.display = 'flex';
        getEl('userInput').value = '';
        getEl('userInput').style.height = 'auto';
        renderHistory();
    };

    const deleteChat = async (id) => {
        chats = chats.filter(c => c.id !== id);
        if (currentChatId === id) startNewChat();
        renderHistory();
        if (currentUserUid) await db.collection('users').doc(currentUserUid).collection('chats').doc(String(id)).delete();
    };

    const syncChat = async (chat) => {
        saveToLocal();
        if (currentUserUid) await db.collection('users').doc(currentUserUid).collection('chats').doc(String(chat.id)).set(chat, { merge: true });
    };

    const addMessageToUI = (text, sender) => {
        const list = getEl('messagesList');
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        
        // Markdown/HTML sanitization could go here, for now simple:
        div.innerHTML = `<div class="message-wrapper"><div class="msg-content">${text}</div></div>`;
        list.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth' });
    };

    const sendMessage = async () => {
        const input = getEl('userInput');
        const text = input.value.trim();
        if (!text) return;

        if (!currentChatId) {
            currentChatId = Date.now();
            chats.unshift({ id: currentChatId, title: text.substring(0, 30), messages: [], pinned: false, createdAt: Date.now() });
            getEl('welcomeScreen').style.display = 'none';
        }

        const chat = chats.find(c => c.id === currentChatId);
        chat.messages.push({ text: text, sender: 'user' });
        addMessageToUI(text, 'user');
        input.value = '';
        input.style.height = 'auto';
        getEl('sendBtn').disabled = true;

        showTyping(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, role: currentRole, states, history: chat.messages.slice(-5) })
            });
            const data = await res.json();
            showTyping(false);
            if (data.text) {
                chat.messages.push({ text: data.text, sender: 'bot' });
                addMessageToUI(data.text, 'bot');
                syncChat(chat);
            }
        } catch (e) {
            showTyping(false);
            addMessageToUI("Bir hata oluştu: " + e.message, 'bot');
        }
    };

    const showTyping = (show) => {
        const existing = getEl('typingIndicator');
        if (show && !existing) {
            const div = document.createElement('div');
            div.id = 'typingIndicator';
            div.className = 'message bot';
            div.innerHTML = `<div class="message-wrapper"><div class="msg-content">...</div></div>`;
            getEl('messagesList').appendChild(div);
        } else if (!show && existing) {
            existing.remove();
        }
    };

    // --- 5. Event Listeners ---
    const setupEvents = () => {
        // Auth
        getEl('toRegister').onclick = () => { getEl('loginForm').style.display = 'none'; getEl('registerForm').style.display = 'block'; };
        getEl('toLogin').onclick = () => { getEl('registerForm').style.display = 'none'; getEl('loginForm').style.display = 'block'; };
        
        getEl('loginSubmit').onclick = async () => {
            const email = getEl('loginEmail').value;
            const pass = getEl('loginPass').value;
            try {
                showAuthLoading(true); showAuthCard(false);
                const res = await auth.signInWithEmailAndPassword(email, pass);
                if (!res.user.emailVerified) { alert("E-postayı doğrulayın."); auth.signOut(); }
            } catch (e) { alert(e.message); showAuthUI(null); }
        };

        getEl('regSubmit').onclick = async () => {
            const name = getEl('regName').value;
            const email = getEl('regEmail').value;
            const pass = getEl('regPass').value;
            try {
                showAuthLoading(true); showAuthCard(false);
                const res = await auth.createUserWithEmailAndPassword(email, pass);
                await res.user.updateProfile({ displayName: name });
                await res.user.sendEmailVerification();
                alert("Doğrulama e-postası gönderildi.");
                auth.signOut();
            } catch (e) { alert(e.message); showAuthUI(null); }
        };

        getEl('googleLogin').onclick = () => {
            showAuthLoading(true); showAuthCard(false);
            if (window.innerWidth <= 768) auth.signInWithRedirect(googleProvider);
            else auth.signInWithPopup(googleProvider).then(r => updateAuthUI(r.user)).catch(e => alert(e.message));
        };

        getEl('logoutBtn').onclick = () => auth.signOut();

        // Chat UI
        getEl('userInput').oninput = function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            getEl('sendBtn').disabled = !this.value.trim();
        };

        getEl('userInput').onkeypress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
        getEl('sendBtn').onclick = sendMessage;
        getEl('newChatSidebarBtn').onclick = startNewChat;
        getEl('newChatTopBtn').onclick = startNewChat;

        // Toggles
        getEl('menuToggle').onclick = () => getEl('sidebar').classList.toggle('active');
        
        const bindToggle = (id, key) => {
            getEl(id).onclick = function(e) {
                e.stopPropagation();
                states[key] = !states[key];
                this.classList.toggle('active', states[key]);
            };
        };
        bindToggle('webSearchBtn', 'webSearch');
        bindToggle('reasoningBtn', 'reasoning');
        bindToggle('imageGenBtn', 'imageGen');
        bindToggle('lastEarthquakesBtn', 'lastEarthquakes');

        // Dropdowns
        const bindDropdown = (btnId, menuId) => {
            getEl(btnId).onclick = (e) => {
                e.stopPropagation();
                const menu = getEl(menuId);
                const isAct = menu.classList.contains('active');
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
                if (!isAct) menu.classList.add('active');
            };
        };
        bindDropdown('modelSelectorBtn', 'modelDropdown');
        bindDropdown('roleMenuBtn', 'roleDropdown');
        bindDropdown('moreMenuBtn', 'moreDropdown');
        bindDropdown('userProfileBtn', 'userMenuDropdown');
        bindDropdown('attachMenuBtn', 'attachmentMenu');
        bindDropdown('featureMenuBtn', 'featureMenu');

        // Modals
        getEl('themeSettingsOption').onclick = () => getEl('themeModal').classList.add('active');
        getEl('instructionsOption').onclick = () => getEl('instructionsModal').classList.add('active');
        getEl('promptModalBtn').onclick = () => {
            getEl('systemPromptInput').value = systemPrompt;
            getEl('promptModal').classList.add('active');
        };
        getEl('openProfileBtn').onclick = () => {
            const u = auth.currentUser;
            if (u) {
                getEl('profileNameText').textContent = u.displayName || 'Kullanıcı';
                getEl('profileEmailText').textContent = u.email;
                getEl('profileAvatarLarge').textContent = (u.displayName || u.email).charAt(0).toUpperCase();
            }
            getEl('profileModal').classList.add('active');
        };

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });

        getEl('saveSystemPrompt').onclick = () => {
            systemPrompt = getEl('systemPromptInput').value;
            localStorage.setItem('solenz_system_prompt', systemPrompt);
            getEl('promptModal').classList.remove('active');
            alert("Sistem komutu kaydedildi.");
        };

        // Theme Switch
        document.querySelectorAll('.theme-choice').forEach(btn => {
            btn.onclick = function() {
                const t = this.dataset.theme;
                document.body.setAttribute('data-theme', t);
                document.querySelectorAll('.theme-choice').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            };
        });

        // Fullscreen
        getEl('fullscreenBtn').onclick = () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
        };

        // Global Click to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-wrapper') && !e.target.closest('.model-select-wrapper') && !e.target.closest('.user-profile')) {
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
            }
        });
    };

    // --- 6. Init ---
    setupEvents();

    auth.onAuthStateChanged(user => {
        updateAuthUI(user);
    });

    auth.getRedirectResult().then(r => {
        if (r.user) updateAuthUI(r.user);
    }).catch(e => {
        console.error("Redirect hatası:", e);
        showAuthCard(true); showAuthLoading(false);
    });

    // Mobile Keyboard Fix
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const vh = window.visualViewport.height;
            getEl('appLayout').style.height = `${vh}px`;
            setTimeout(() => {
                const list = getEl('messagesList');
                if (list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });
    }
});
