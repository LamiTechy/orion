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

const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileIcon = document.getElementById('fileIcon');
const fileRemove = document.getElementById('fileRemove');

let uploadedFile = null;
let fileContent = null;
let uploadedFileIsImage = false;

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

// ─── File Upload Handlers ──────────────────────────────────────────────────

fileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    alert('File too large. Maximum size is 10MB.');
    return;
  }

  uploadedFile = file;
  
  // Determine file type icon
  const isImage = file.type.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  fileIcon.textContent = isImage ? '🖼️' : (isPDF ? '📄' : '📝');
  
  // Show preview
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  filePreview.style.display = 'flex';

  // Upload and process file
  setStatus('Processing file...', true);
  
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    
    if (data.success) {
      fileContent = data.content;
      uploadedFileIsImage = data.isImage;
      setStatus(`✓ File ready: ${file.name}`);
    } else {
      throw new Error(data.error || 'Failed to process file');
    }
  } catch (err) {
    console.error('Upload error:', err);
    alert('Failed to upload file: ' + err.message);
    removeFile();
  }
});

fileRemove.addEventListener('click', removeFile);

function removeFile() {
  uploadedFile = null;
  fileContent = null;
  uploadedFileIsImage = false;
  fileInput.value = '';
  filePreview.style.display = 'none';
  setStatus('Ready');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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
      body: JSON.stringify({ 
        message: text, 
        conversationId,
        fileContent: fileContent,
        fileName: uploadedFile?.name,
        isImage: uploadedFileIsImage
      }),
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
