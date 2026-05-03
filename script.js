// Solenz AI - Frontend Logic (Gemini Style)

const state = {
    isSidebarOpen: false,
    messages: [],
    theme: 'dark'
};

// --- DOM Elements ---
const getEl = id => document.getElementById(id);
const elements = {
    appLayout: getEl('appLayout'),
    sidebar: getEl('sidebar'),
    sidebarOverlay: getEl('sidebarOverlay'),
    menuOpenBtn: getEl('menuOpenBtn'),
    menuCloseBtn: getEl('menuCloseBtn'),
    chatInput: getEl('chatInput'),
    sendBtn: getEl('sendBtn'),
    messagesContainer: getEl('messagesContainer'),
    welcomeContainer: document.querySelector('.welcome-container'),
    themeToggleBtn: getEl('themeToggleBtn'),
    newChatBtn: getEl('newChatBtn')
};

// --- Initialization ---
const init = () => {
    setupEventListeners();
    setupMobileFixes();
};

// --- Event Listeners ---
const setupEventListeners = () => {
    // Sidebar Toggles
    elements.menuOpenBtn.addEventListener('click', toggleSidebar);
    elements.menuCloseBtn.addEventListener('click', toggleSidebar);
    elements.sidebarOverlay.addEventListener('click', toggleSidebar);

    // Input Handling
    elements.chatInput.addEventListener('input', handleInput);
    elements.chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !elements.sendBtn.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send Button
    elements.sendBtn.addEventListener('click', sendMessage);

    // Theme Toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // New Chat
    elements.newChatBtn.addEventListener('click', startNewChat);

    // Suggestion Cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const text = card.querySelector('p').textContent;
            elements.chatInput.value = text;
            handleInput();
            sendMessage();
        });
    });
};

// --- Functions ---

function toggleSidebar() {
    state.isSidebarOpen = !state.isSidebarOpen;
    elements.sidebar.classList.toggle('active', state.isSidebarOpen);
    elements.sidebarOverlay.classList.toggle('active', state.isSidebarOpen);
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
