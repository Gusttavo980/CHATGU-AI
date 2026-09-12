/* ==========================================================================
   🔑 CONFIGURAÇÃO DA API (API_CONFIG) - GROQ CLOUD
   ========================================================================== */
const API_CONFIG = {
    // Insira sua API Key da Groq aqui (começa com "gsk_"):
    API_KEY: "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",

    // Endpoint oficial da Groq Cloud para chat
    URL: "https://api.groq.com/openai/v1/chat/completions",

    // Modelos populares e gratuitos da Groq:
    // - "llama-3.3-70b-versatile" (Recomendado)
    // - "llama-3.1-8b-instant" (Extremamente rápido)
    // - "mixtral-8x7b-32768"
    // - "gemma2-9b-it"
    MODEL_NAME: "openai/gpt-oss-120b",

    // Headers exigidos pela Groq
    getHeaders: function () {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.API_KEY}`
        };
    },

    // Formata o payload no padrão da Groq
    getPayload: function (messagesHistory) {
        return JSON.stringify({
            model: this.MODEL_NAME,
            messages: messagesHistory.map(msg => ({
                role: msg.role, // 'user' ou 'assistant'
                content: msg.content
            })),
            temperature: 0.7,
            max_tokens: 2048
        });
    }
};

/* ==========================================================================
   ESTADO DA APLICAÇÃO & GERENCIAMENTO DE DADOS
   ========================================================================== */
let chats = JSON.parse(localStorage.getItem('chatgu_chats')) || [];
let currentChatId = null;

// ELEMENTOS DO DOM
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');
const searchInput = document.getElementById('searchInput');

const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messagesContainer');
const chatViewport = document.getElementById('chatViewport');
const headerTitle = document.getElementById('headerTitle');

const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const clearCurrentChatBtn = document.getElementById('clearCurrentChatBtn');

/* ==========================================================================
   INICIALIZAÇÃO & EVENTOS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    openSidebarBtn.addEventListener('click', toggleMobileSidebar);
    closeSidebarBtn.addEventListener('click', toggleMobileSidebar);
    sidebarOverlay.addEventListener('click', toggleMobileSidebar);

    document.querySelectorAll('.card-suggestion').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            messageInput.value = prompt;
            chatForm.dispatchEvent(new Event('submit'));
        });
    });

    newChatBtn.addEventListener('click', createNewChat);
    chatForm.addEventListener('submit', handleSendMessage);
    clearCurrentChatBtn.addEventListener('click', deleteCurrentChat);
    searchInput.addEventListener('input', filterChats);
});

/* ==========================================================================
   FUNÇÕES DA SIDEBAR E GERENCIAMENTO DE CHATS
   ========================================================================== */
function toggleMobileSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
}

function saveToStorage() {
    localStorage.setItem('chatgu_chats', JSON.stringify(chats));
}

function createNewChat() {
    currentChatId = null;
    welcomeScreen.style.display = 'flex';
    messagesContainer.innerHTML = '';
    headerTitle.textContent = 'ChatGu AI';
    renderSidebar();
    if (window.innerWidth <= 768) toggleMobileSidebar();
}

function renderSidebar() {
    chatList.innerHTML = '';
    chats.forEach(chat => {
        const li = document.createElement('li');
        li.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        li.onclick = () => loadChat(chat.id);

        li.innerHTML = `
            <span class="chat-item-title">${escapeHTML(chat.title)}</span>
            <div class="chat-item-actions">
                <button class="btn-icon-xs" onclick="renameChat('${chat.id}', event)" title="Renomear"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon-xs" onclick="deleteChat('${chat.id}', event)" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        chatList.appendChild(li);
    });
}

function filterChats() {
    const term = searchInput.value.toLowerCase();
    const items = chatList.getElementsByTagName('li');
    Array.from(items).forEach(item => {
        const title = item.querySelector('.chat-item-title').textContent.toLowerCase();
        item.style.display = title.includes(term) ? 'flex' : 'none';
    });
}

function loadChat(id) {
    currentChatId = id;
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    headerTitle.textContent = chat.title;
    welcomeScreen.style.display = 'none';
    messagesContainer.innerHTML = '';

    chat.messages.forEach(msg => {
        appendMessageUI(msg.role, msg.content);
    });

    renderSidebar();
    scrollToBottom();
    if (window.innerWidth <= 768) toggleMobileSidebar();
}

function renameChat(id, e) {
    e.stopPropagation();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    const newTitle = prompt('Novo nome para esta conversa:', chat.title);
    if (newTitle && newTitle.trim() !== '') {
        chat.title = newTitle.trim();
        saveToStorage();
        renderSidebar();
        if (currentChatId === id) headerTitle.textContent = chat.title;
    }
}

function deleteChat(id, e) {
    if (e) e.stopPropagation();
    chats = chats.filter(c => c.id !== id);
    saveToStorage();

    if (currentChatId === id) {
        createNewChat();
    } else {
        renderSidebar();
    }
}

function deleteCurrentChat() {
    if (currentChatId) {
        deleteChat(currentChatId);
    } else {
        messagesContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
    }
}

/* ==========================================================================
   FLUXO DE MENSAGENS E INTEGRAÇÃO COM GROQ CLOUD
   ========================================================================== */
async function handleSendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    if (!currentChatId) {
        const newChat = {
            id: Date.now().toString(),
            title: text.length > 25 ? text.substring(0, 25) + '...' : text,
            messages: []
        };
        chats.unshift(newChat);
        currentChatId = newChat.id;
        headerTitle.textContent = newChat.title;
    }

    welcomeScreen.style.display = 'none';

    const currentChat = chats.find(c => c.id === currentChatId);
    currentChat.messages.push({ role: 'user', content: text });
    saveToStorage();

    appendMessageUI('user', text);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    scrollToBottom();

    const thinkingRow = appendThinkingUI();
    scrollToBottom();

    try {
        const aiResponse = await fetchAIResponse(currentChat.messages);
        thinkingRow.remove();

        currentChat.messages.push({ role: 'assistant', content: aiResponse });
        saveToStorage();

        appendMessageUI('assistant', aiResponse);
    } catch (error) {
        thinkingRow.remove();
        appendMessageUI('assistant', `⚠️ **Erro na Groq API:** ${error.message}\n\n*Verifique se a sua chave está correta no arquivo script.js.*`);
    }

    renderSidebar();
    scrollToBottom();
}

async function fetchAIResponse(messagesHistory) {
    if (API_CONFIG.API_KEY === "SUA_CHAVE_GROQ_AQUI" || !API_CONFIG.API_KEY) {
        throw new Error("Adicione sua API Key da Groq Cloud no topo do arquivo script.js.");
    }

    const response = await fetch(API_CONFIG.URL, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: API_CONFIG.getPayload(messagesHistory)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
    } else {
        throw new Error("A API da Groq retornou uma resposta sem conteúdo válido.");
    }
}

/* ==========================================================================
   RENDERIZAÇÃO DE INTERFACE DA MENSAGEM (MARKDOWN E CÓDIGO)
   ========================================================================== */
function appendMessageUI(role, text) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const isUser = role === 'user';
    const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
    const avatarContent = isUser ? 'U' : '<i class="fa-solid fa-robot"></i>';

    const formattedContent = isUser ? escapeHTML(text) : marked.parse(text);

    row.innerHTML = `
        <div class="avatar ${avatarClass}">${avatarContent}</div>
        <div class="message-content">
            <div class="text-body">${formattedContent}</div>
            ${!isUser ? `
            <div class="message-actions">
                <button class="btn-icon-xs" onclick="copyMessageText(this)" title="Copiar"><i class="fa-regular fa-copy"></i> Copiar</button>
                <button class="btn-icon-xs" onclick="regenerateLastResponse()" title="Regenerar"><i class="fa-solid fa-rotate-right"></i> Regenerar</button>
            </div>` : ''}
        </div>
    `;

    messagesContainer.appendChild(row);

    if (!isUser) {
        row.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
            wrapCodeBlock(block);
        });
    }
}

function appendThinkingUI() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.innerHTML = `
        <div class="avatar ai-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="message-content">
            <div class="thinking-box">
                <span>ChatGu AI está pensando</span>
                <div class="dots">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(row);
    return row;
}

function wrapCodeBlock(codeElement) {
    const pre = codeElement.parentNode;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    
    const language = codeElement.className.replace('hljs ', '').replace('language-', '') || 'code';
    
    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `
        <span>${language}</span>
        <button class="btn-copy-code" onclick="copyCode(this)"><i class="fa-regular fa-copy"></i> Copiar código</button>
    `;
    
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
}

/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */
function scrollToBottom() {
    chatViewport.scrollTop = chatViewport.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function copyMessageText(button) {
    const messageContent = button.closest('.message-content').querySelector('.text-body').innerText;
    navigator.clipboard.writeText(messageContent).then(() => {
        button.innerHTML = `<i class="fa-solid fa-check"></i> Copiado!`;
        setTimeout(() => {
            button.innerHTML = `<i class="fa-regular fa-copy"></i> Copiar`;
        }, 2000);
    });
}

function copyCode(button) {
    const code = button.closest('.code-block-wrapper').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        button.innerHTML = `<i class="fa-solid fa-check"></i> Copiado!`;
        setTimeout(() => {
            button.innerHTML = `<i class="fa-regular fa-copy"></i> Copiar código`;
        }, 2000);
    });
}

async function regenerateLastResponse() {
    if (!currentChatId) return;
    const currentChat = chats.find(c => c.id === currentChatId);
    
    if (currentChat.messages.length > 0 && currentChat.messages[currentChat.messages.length - 1].role === 'assistant') {
        currentChat.messages.pop();
        saveToStorage();
        loadChat(currentChatId);
        
        const thinkingRow = appendThinkingUI();
        scrollToBottom();

        try {
            const aiResponse = await fetchAIResponse(currentChat.messages);
            thinkingRow.remove();

            currentChat.messages.push({ role: 'assistant', content: aiResponse });
            saveToStorage();
            appendMessageUI('assistant', aiResponse);
        } catch (error) {
            thinkingRow.remove();
            appendMessageUI('assistant', `⚠️ **Erro na Groq API:** ${error.message}`);
        }
        scrollToBottom();
    }
}