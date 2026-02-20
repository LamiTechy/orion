const token = localStorage.getItem('token');
if (!token) window.location.href = '/login.html';

const user = JSON.parse(localStorage.getItem('user') || '{}');

const chatArea = document.getElementById('chatArea');
const emptyState = document.getElementById('emptyState');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const clearBtn = document.getElementById('clearBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const chatTitle = document.getElementById('chatTitle');
const conversationsList = document.getElementById('conversationsList');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');

let conversationId = null;
let conversations = [];
let isStreaming = false;

userEmail.textContent = user.email || 'User';

loadConversations();

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);
newChatBtn.addEventListener('click', createNewConversation);
clearBtn.addEventListener('click', clearCurrentConversation);
logoutBtn.addEventListener('click', logout);

function setStatus(text, loading = false) {
  statusText.textContent = text;
  statusDot.className = 'status-dot' + (loading ? ' loading' : '');
}

function appendMessage(role, text = '', withCursor = false) {
  if (emptyState) emptyState.remove();

  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'ai' ? 'OR' : 'ME';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  if (withCursor) {
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    bubble.appendChild(cursor);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatArea.appendChild(wrap);
  
  // Smooth scroll to bottom
  setTimeout(() => {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
  }, 0);

  return bubble;
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isStreaming) return;

  isStreaming = true;
  sendBtn.disabled = true;
  messageInput.value = '';
  messageInput.style.height = 'auto';

  appendMessage('user', text);
  setStatus('Thinking...', true);

  const aiBubble = appendMessage('ai', '', true);
  const cursor = aiBubble.querySelector('.cursor');
  let accumulatedText = '';

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: text, conversationId }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const data = JSON.parse(line.slice(5).trim());

          // if (data.type === 'start') {
          //   conversationId = data.conversationId;
          //   if (data.title) chatTitle.textContent = data.title;
          //   loadConversations();
          // } else if (data.type === 'delta') {
          //   accumulatedText += data.text;
          if (data.type === 'start') {
            conversationId = data.conversationId;
            if (data.title) chatTitle.textContent = data.title;
            loadConversations();
          } else if (data.type === 'searching') {
            setStatus(`🔍 Searching: ${data.query}`, true);
          } else if (data.type === 'delta') {
            accumulatedText += data.text;
            aiBubble.textContent = accumulatedText;
            aiBubble.appendChild(cursor);
            // Scroll to bottom smoothly as new text arrives
            chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
          } else if (data.type === 'done') {
            cursor.remove();
            setStatus('Ready');
            loadConversations();
          } else if (data.type === 'error') {
            cursor.remove();
            aiBubble.textContent = '⚠️ Error';
            setStatus('Error');
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error(err);
    cursor?.remove();
    aiBubble.textContent = '⚠️ Network error';
    setStatus('Error');
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

async function loadConversations() {
  try {
    const res = await fetch('/api/conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    conversations = data.conversations;
    renderConversationsList();
  } catch (err) {
    console.error(err);
  }
}

function renderConversationsList() {
  conversationsList.innerHTML = '';
  
  if (conversations.length === 0) {
    conversationsList.innerHTML = '<div class="empty-sidebar">Start a new conversation</div>';
    return;
  }

  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    if (conv.id === conversationId) item.classList.add('active');

    const title = document.createElement('div');
    title.className = 'conversation-title';
    title.textContent = conv.title;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    };

    item.appendChild(title);
    item.appendChild(deleteBtn);
    item.onclick = () => switchConversation(conv.id);
    conversationsList.appendChild(item);
  });
}

async function switchConversation(id) {
  conversationId = id;
  chatArea.innerHTML = '';
  
  try {
    const res = await fetch(`/api/conversations/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    chatTitle.textContent = data.title;
    data.messages.forEach(msg => appendMessage(msg.role, msg.content));
    renderConversationsList();
  } catch (err) {
    console.error(err);
  }
}

function createNewConversation() {
  conversationId = null;
  chatArea.innerHTML = '<div class="empty-state" id="emptyState"><h2>Hey, I\'m Orion</h2><p>Your AI assistant</p></div>';
  chatTitle.textContent = 'New Chat';
  renderConversationsList();
  messageInput.focus();
}

async function clearCurrentConversation() {
  if (!conversationId) return;
  await deleteConversation(conversationId);
  createNewConversation();
}

async function deleteConversation(id) {
  try {
    await fetch(`/api/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await loadConversations();
    if (id === conversationId) createNewConversation();
  } catch (err) {
    console.error(err);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}
