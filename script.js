// Solenz AI - Frontend Logic (Gemini Style)

const state = {
    isSidebarOpen: false,
    messages: [],
    theme: 'dark'
};

// --- DOM Elements ---
const getEl = id => document.getElementById(id);

// Safe element selector
const elements = {};
const updateElements = () => {
    elements.appLayout = getEl('appLayout');
    elements.sidebar = getEl('sidebar');
    elements.sidebarOverlay = getEl('sidebarOverlay');
    elements.menuOpenBtn = getEl('menuOpenBtn');
    elements.menuCloseBtn = getEl('menuCloseBtn');
    elements.chatInput = getEl('chatInput');
    elements.sendBtn = getEl('sendBtn');
    elements.messagesContainer = getEl('messagesContainer');
    elements.welcomeContainer = document.querySelector('.welcome-container');
    elements.themeToggleBtn = getEl('themeToggleBtn');
    elements.newChatBtn = getEl('newChatBtn');
    elements.modelSelectorBtn = getEl('modelSelectorBtn');
    elements.userProfileBtn = getEl('userProfileBtn');
    elements.footerBtns = document.querySelectorAll('.footer-btn');
    elements.suggestionCards = document.querySelectorAll('.suggestion-card');
    elements.attachBtn = getEl('attachBtn');
    elements.attachmentMenu = getEl('attachmentMenu');
    elements.imageBtn = getEl('imageBtn');
    elements.micBtn = getEl('micBtn');
};

// --- Initialization ---
const init = () => {
    updateElements();
    setupEventListeners();
    setupMobileFixes();
    console.log("Solenz AI initialized");
};

// --- Event Listeners ---
const setupEventListeners = () => {
    // Sidebar Toggles
    if (elements.menuOpenBtn) elements.menuOpenBtn.onclick = toggleSidebar;
    if (elements.menuCloseBtn) elements.menuCloseBtn.onclick = toggleSidebar;
    if (elements.sidebarOverlay) elements.sidebarOverlay.onclick = toggleSidebar;

    // Input Handling
    if (elements.chatInput) {
        elements.chatInput.oninput = handleInput;
        elements.chatInput.onkeydown = e => {
            if (e.key === 'Enter' && !e.shiftKey && !elements.sendBtn.disabled) {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    // Send Button
    if (elements.sendBtn) elements.sendBtn.onclick = sendMessage;

    // Theme Toggle
    if (elements.themeToggleBtn) elements.themeToggleBtn.onclick = toggleTheme;

    // New Chat
    if (elements.newChatBtn) elements.newChatBtn.onclick = startNewChat;

    // Suggestion Cards
    elements.suggestionCards.forEach(card => {
        card.onclick = () => {
            const text = card.querySelector('p').textContent;
            elements.chatInput.value = text;
            handleInput();
            sendMessage();
        };
    });

    // Model Selector
    if (elements.modelSelectorBtn) {
        elements.modelSelectorBtn.onclick = () => alert("Model seçimi yakında eklenecek!");
    }

    // User Profile
    if (elements.userProfileBtn) {
        elements.userProfileBtn.onclick = () => alert("Profil ayarları yakında eklenecek!");
    }

    // Footer Buttons (Help, History, Settings)
    elements.footerBtns.forEach(btn => {
        btn.onclick = () => {
            const text = btn.querySelector('.btn-text').textContent;
            alert(`${text} yakında eklenecek!`);
        };
    });

    // Attach, Image, Mic Buttons
    if (elements.attachBtn) {
        elements.attachBtn.onclick = (e) => {
            e.stopPropagation();
            toggleAttachmentMenu();
        };
    }

    // Attachment Menu Items
    const menuItems = document.querySelectorAll('.attachment-menu .menu-item');
    menuItems.forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const type = item.querySelector('span:last-child').textContent;
            alert(`${type} seçildi!`);
            closeAttachmentMenu();
        };
    });

    // Document-wide click to close menus
    document.addEventListener('click', (e) => {
        if (elements.attachmentMenu && !elements.attachmentMenu.classList.contains('hidden')) {
            if (!elements.attachmentMenu.contains(e.target) && e.target !== elements.attachBtn) {
                closeAttachmentMenu();
            }
        }
    });

    if (elements.imageBtn) {
        elements.imageBtn.onclick = () => alert("Görsel analizi yakında eklenecek!");
    }
    if (elements.micBtn) {
        elements.micBtn.onclick = () => alert("Sesli komut yakında eklenecek!");
    }
};

// --- Functions ---

function toggleSidebar() {
    state.isSidebarOpen = !state.isSidebarOpen;
    elements.sidebar.classList.toggle('active', state.isSidebarOpen);
    elements.sidebarOverlay.classList.toggle('active', state.isSidebarOpen);
}

function toggleAttachmentMenu() {
    const isHidden = elements.attachmentMenu.classList.toggle('hidden');
    elements.attachBtn.classList.toggle('active', !isHidden);
}

function closeAttachmentMenu() {
    if (elements.attachmentMenu) {
        elements.attachmentMenu.classList.add('hidden');
        elements.attachBtn.classList.remove('active');
    }
}

function handleInput() {
    const input = elements.chatInput;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
    
    elements.sendBtn.disabled = !input.value.trim();
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    const icon = elements.themeToggleBtn.querySelector('.material-symbols-rounded');
    icon.textContent = state.theme === 'dark' ? 'dark_mode' : 'light_mode';
}

function startNewChat() {
    state.messages = [];
    elements.messagesContainer.innerHTML = '';
    elements.messagesContainer.classList.add('hidden');
    elements.welcomeContainer.classList.remove('hidden');
    elements.chatInput.value = '';
    handleInput();
    if (window.innerWidth <= 768) toggleSidebar();
}

function sendMessage() {
    const text = elements.chatInput.value.trim();
    if (!text) return;

    // UI Updates
    if (state.messages.length === 0) {
        elements.welcomeContainer.classList.add('hidden');
        elements.messagesContainer.classList.remove('hidden');
    }

    addMessage(text, 'user');
    elements.chatInput.value = '';
    handleInput();

    // Simulate Bot Response
    setTimeout(() => {
        addMessage("Bu bir simülasyon yanıtıdır. Solenz AI arayüzü başarıyla kuruldu!", 'bot');
    }, 1000);
}

function addMessage(text, role) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    const avatarImg = role === 'user' 
        ? 'https://ui-avatars.com/api/?name=User&background=random'
        : 'https://ui-avatars.com/api/?name=AI&background=0b57d0&color=fff';

    messageEl.innerHTML = `
        <img src="${avatarImg}" class="msg-avatar" alt="${role}">
        <div class="msg-content">${text}</div>
    `;

    elements.messagesContainer.appendChild(messageEl);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    
    state.messages.push({ role, text });
}

// --- Mobile Keyboard & Viewport Fixes ---
function setupMobileFixes() {
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const vh = window.visualViewport.height;
            elements.appLayout.style.height = `${vh}px`;
            
            // Auto-scroll to bottom if keyboard opens
            if (state.messages.length > 0) {
                elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
            }
        });
    }

    // iOS Safe Area Fix
    const setVHToken = () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', setVHToken);
    setVHToken();
}

// Start the app
init();
