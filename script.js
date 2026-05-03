document.addEventListener('DOMContentLoaded', () => {
    console.log("Solenz AI Premium v1.0 Başlatılıyor...");

    // --- 1. Konfigürasyon ve Global Durum ---
    const config = {
        firebase: {
            apiKey: "AIzaSyDDT_Hbzi6xVlESl3_lOryLoCKePi5We00",
            authDomain: "solenzzai.firebaseapp.com",
            projectId: "solenzzai",
            storageBucket: "solenzzai.firebasestorage.app",
            messagingSenderId: "1006831041210",
            appId: "1:1006831041210:web:cdb28fcea10a53fed1a083"
        }
    };

    let state = {
        user: null,
        chats: [],
        currentChatId: null,
        role: 'general',
        model: 'sonnet',
        systemPrompt: localStorage.getItem('solenz_system_prompt') || "",
        toggles: {
            webSearch: false,
            reasoning: false,
            imageGen: false,
            lastQuakes: false
        }
    };

    // --- 2. Yardımcı Fonksiyonlar ---
    const getEl = (id) => document.getElementById(id);
    const getAll = (sel) => document.querySelectorAll(sel);

    // --- 3. Firebase Başlatma ---
    if (!firebase.apps.length) firebase.initializeApp(config.firebase);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- 4. Çekirdek Fonksiyonlar ---

    const updateAuthUI = (user) => {
        state.user = user;
        const authScreen = getEl('authScreen');
        const appLayout = getEl('appLayout');

        if (user) {
            authScreen.style.display = 'none';
            appLayout.style.display = 'flex';
            getEl('userNameDisplay').textContent = user.displayName || 'Kullanıcı';
            getEl('userEmailDisplay').textContent = user.email;
            getEl('userAvatar').textContent = (user.displayName || user.email).charAt(0).toUpperCase();
            loadChats();
        } else {
            authScreen.style.display = 'flex';
            appLayout.style.display = 'none';
            getEl('authCard').style.display = 'block';
            getEl('authLoading').style.display = 'none';
        }
    };

    const loadChats = async () => {
        if (!state.user) return;
        try {
            const snap = await db.collection('users').doc(state.user.uid).collection('chats').orderBy('createdAt', 'desc').get();
            state.chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderHistory();
        } catch (e) { console.error("Chats yüklenemedi:", e); }
    };

    const renderHistory = () => {
        const hList = getEl('historyList');
        const pList = getEl('pinnedList');
        const pGroup = getEl('pinnedGroup');

        hList.innerHTML = ''; pList.innerHTML = '';
        const pinned = state.chats.filter(c => c.pinned);
        const normal = state.chats.filter(c => !c.pinned);

        pGroup.style.display = pinned.length > 0 ? 'block' : 'none';

        pinned.forEach(chat => pList.appendChild(createHistoryElement(chat)));
        normal.forEach(chat => hList.appendChild(createHistoryElement(chat)));
    };

    const createHistoryElement = (chat) => {
        const div = document.createElement('div');
        div.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        div.innerHTML = `
            <span class="item-text">${chat.title || 'Yeni Sohbet'}</span>
            <div class="history-actions">
                <button class="action-btn pin-btn" title="Sabitle"><span class="material-symbols-outlined">${chat.pinned ? 'keep_off' : 'keep'}</span></button>
                <button class="action-btn delete-btn" title="Sil"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
        div.onclick = (e) => { if (!e.target.closest('.action-btn')) switchChat(chat.id); };
        div.querySelector('.pin-btn').onclick = (e) => { e.stopPropagation(); togglePin(chat.id); };
        div.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); };
        return div;
    };

    const switchChat = (id) => {
        state.currentChatId = id;
        const chat = state.chats.find(c => c.id === id);
        if (!chat) return;

        getEl('messagesList').innerHTML = '';
        getEl('welcomeScreen').style.display = 'none';
        chat.messages.forEach(m => appendMessageUI(m.text, m.sender));
        renderHistory();
        if (window.innerWidth <= 768) getEl('sidebar').classList.remove('active');
    };

    const startNewChat = () => {
        state.currentChatId = null;
        getEl('messagesList').innerHTML = '';
        getEl('welcomeScreen').style.display = 'flex';
        getEl('userInput').value = '';
        getEl('userInput').style.height = 'auto';
        renderHistory();
    };

    const deleteChat = async (id) => {
        if (!confirm('Bu sohbeti silmek istediğine emin misin?')) return;
        state.chats = state.chats.filter(c => c.id !== id);
        if (state.currentChatId === id) startNewChat();
        renderHistory();
        await db.collection('users').doc(state.user.uid).collection('chats').doc(String(id)).delete();
    };

    const togglePin = async (id) => {
        const chat = state.chats.find(c => c.id === id);
        if (!chat) return;
        chat.pinned = !chat.pinned;
        renderHistory();
        await db.collection('users').doc(state.user.uid).collection('chats').doc(String(id)).update({ pinned: chat.pinned });
    };

    const appendMessageUI = (text, sender) => {
        const list = getEl('messagesList');
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerHTML = `<div class="message-wrapper"><div class="msg-content">${text}</div></div>`;
        list.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth' });
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

    const sendMessage = async () => {
        const input = getEl('userInput');
        const text = input.value.trim();
        if (!text) return;

        if (!state.currentChatId) {
            state.currentChatId = Date.now().toString();
            const newChat = {
                id: state.currentChatId,
                title: text.substring(0, 30),
                messages: [],
                pinned: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            state.chats.unshift(newChat);
            getEl('welcomeScreen').style.display = 'none';
        }

        const chat = state.chats.find(c => c.id === state.currentChatId);
        chat.messages.push({ text, sender: 'user' });
        appendMessageUI(text, 'user');
        input.value = '';
        input.style.height = 'auto';
        getEl('sendBtn').disabled = true;

        showTyping(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    role: state.role,
                    model: state.model,
                    states: state.toggles,
                    systemPrompt: state.systemPrompt,
                    history: chat.messages.slice(-6)
                })
            });
            const data = await response.json();
            showTyping(false);
            if (data.text) {
                chat.messages.push({ text: data.text, sender: 'bot' });
                appendMessageUI(data.text, 'bot');
                await db.collection('users').doc(state.user.uid).collection('chats').doc(state.currentChatId).set(chat, { merge: true });
            }
        } catch (e) {
            showTyping(false);
            appendMessageUI("Hata: " + e.message, 'bot');
        }
    };

    // --- 5. UI Etkileşimleri (Dropdowns, Modals, Toggles) ---

    const closeAllMenus = () => {
        getAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
    };

    const setupUI = () => {
        // Dropdown Tetikleyicileri
        const dropdownBinds = [
            ['userProfileBtn', 'userMenuDropdown'],
            ['modelSelectorBtn', 'modelDropdown'],
            ['roleMenuBtn', 'roleDropdown'],
            ['moreMenuBtn', 'moreDropdown'],
            ['attachMenuBtn', 'attachmentMenu'],
            ['featureMenuBtn', 'featureMenu']
        ];

        dropdownBinds.forEach(([btnId, menuId]) => {
            const btn = getEl(btnId);
            const menu = getEl(menuId);
            if (btn && menu) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const wasActive = menu.classList.contains('active');
                    closeAllMenus();
                    if (!wasActive) {
                        // Mobilde modelSelectorBtn sidebar açar
                        if (btnId === 'modelSelectorBtn' && window.innerWidth <= 768) {
                            getEl('sidebar').classList.add('active');
                            getEl('sidebarOverlay').classList.add('active');
                        } else {
                            menu.classList.add('active');
                        }
                    }
                };
            }
        });

        // Toggle Butonları
        const toggleBinds = [
            ['webSearchBtn', 'webSearch'],
            ['reasoningBtn', 'reasoning'],
            ['imageGenBtn', 'imageGen'],
            ['lastEarthquakesBtn', 'lastQuakes']
        ];

        toggleBinds.forEach(([id, key]) => {
            getEl(id).onclick = function(e) {
                e.stopPropagation();
                state.toggles[key] = !state.toggles[key];
                this.classList.toggle('active', state.toggles[key]);
            };
        });

        // Modallar
        getEl('themeSettingsOption').onclick = () => getEl('themeModal').classList.add('active');
        getEl('instructionsOption').onclick = () => alert('Solenz AI: Gelişmiş yapay zeka asistanı.');
        getEl('promptModalBtn').onclick = () => {
            getEl('systemPromptInput').value = state.systemPrompt;
            getEl('promptModal').classList.add('active');
        };
        getEl('openProfileBtn').onclick = () => {
            getEl('profileNameText').textContent = state.user.displayName || 'Kullanıcı';
            getEl('profileEmailText').textContent = state.user.email;
            getEl('chatCount').textContent = state.chats.length;
            getEl('profileModal').classList.add('active');
        };

        getAll('.close-modal').forEach(btn => {
            btn.onclick = () => getAll('.modal').forEach(m => m.classList.remove('active'));
        });

        // Tema Seçimi
        getAll('.theme-choice').forEach(choice => {
            choice.onclick = function() {
                const t = this.dataset.theme;
                document.body.setAttribute('data-theme', t);
                getAll('.theme-choice').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                localStorage.setItem('solenz_theme', t);
            };
        });

        // Sistem Komutu Kaydet
        getEl('saveSystemPrompt').onclick = () => {
            state.systemPrompt = getEl('systemPromptInput').value;
            localStorage.setItem('solenz_system_prompt', state.systemPrompt);
            getEl('promptModal').classList.remove('active');
            alert('Sistem komutu güncellendi.');
        };

        // Fullscreen
        getEl('fullscreenBtn').onclick = () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
        };

        // Sidebar Kapatma (Mobil)
        getEl('menuToggle').onclick = () => {
            getEl('sidebar').classList.add('active');
            getEl('sidebarOverlay').classList.add('active');
        };
        getEl('sidebarOverlay').onclick = () => {
            getEl('sidebar').classList.remove('active');
            getEl('sidebarOverlay').classList.remove('active');
        };

        // Yeni Sohbet Butonları
        getEl('newChatSidebarBtn').onclick = startNewChat;
        getEl('newChatTopBtn').onclick = startNewChat;

        // Input Alanı Dinamik Yükseklik
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

        // Öneri Kartları
        getAll('.suggestion-card').forEach(card => {
            card.onclick = () => {
                const text = card.querySelector('p').textContent;
                getEl('userInput').value = text;
                getEl('userInput').dispatchEvent(new Event('input'));
                sendMessage();
            };
        });

        // Global Tıklama ile Menüleri Kapat
        document.onclick = (e) => {
            if (!e.target.closest('.dropdown-wrapper') && !e.target.closest('.user-profile')) {
                closeAllMenus();
            }
        };
    };

    // --- 6. Auth İşlemleri ---

    const setupAuth = () => {
        getEl('toRegister').onclick = () => { getEl('loginForm').style.display = 'none'; getEl('registerForm').style.display = 'block'; };
        getEl('toLogin').onclick = () => { getEl('registerForm').style.display = 'none'; getEl('loginForm').style.display = 'block'; };

        getEl('loginSubmit').onclick = async () => {
            const email = getEl('loginEmail').value;
            const pass = getEl('loginPass').value;
            try {
                getEl('authCard').style.display = 'none';
                getEl('authLoading').style.display = 'flex';
                await auth.signInWithEmailAndPassword(email, pass);
            } catch (e) {
                alert(e.message);
                updateAuthUI(null);
            }
        };

        getEl('regSubmit').onclick = async () => {
            const name = getEl('regName').value;
            const email = getEl('regEmail').value;
            const pass = getEl('regPass').value;
            try {
                getEl('authCard').style.display = 'none';
                getEl('authLoading').style.display = 'flex';
                const res = await auth.createUserWithEmailAndPassword(email, pass);
                await res.user.updateProfile({ displayName: name });
                await db.collection('users').doc(res.user.uid).set({ name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                alert('Kayıt başarılı! Giriş yapılıyor...');
            } catch (e) {
                alert(e.message);
                updateAuthUI(null);
            }
        };

        getEl('googleLogin').onclick = () => {
            getEl('authCard').style.display = 'none';
            getEl('authLoading').style.display = 'flex';
            if (window.innerWidth <= 768) auth.signInWithRedirect(googleProvider);
            else auth.signInWithPopup(googleProvider).catch(e => { alert(e.message); updateAuthUI(null); });
        };

        getEl('logoutBtn').onclick = () => auth.signOut();
    };

    // --- 7. Başlatma ---
    setupUI();
    setupAuth();

    auth.onAuthStateChanged(user => updateAuthUI(user));
    auth.getRedirectResult().then(r => { if (r.user) updateAuthUI(r.user); });

    // Mobil Klavye Düzeltmesi
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const vh = window.visualViewport.height;
            getEl('appLayout').style.height = `${vh}px`;
            const list = getEl('messagesList');
            if (list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Kayıtlı Temayı Yükle
    const savedTheme = localStorage.getItem('solenz_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    getAll('.theme-choice').forEach(c => {
        if (c.dataset.theme === savedTheme) c.classList.add('active');
        else c.classList.remove('active');
    });
});
