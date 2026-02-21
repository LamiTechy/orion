import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import axios from 'axios';
import dns from "dns";
import multer from 'multer';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', limiter);

// ─── File Upload Configuration ────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Only PDF and text files allowed.'));
    }
  }
});
// ──────────────────────────────────────────────────────────────────────────

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// Helper function
function generateTitle(firstMessage) {
  if (!firstMessage) return 'New Chat';
  const title = firstMessage.slice(0, 40);
  return title.length < firstMessage.length ? title + '...' : title;
}

// Web Search Function
async function searchWeb(query) {
  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return {
      answer: response.data.answer || '',
      results: response.data.results || []
    };
  } catch (error) {
    console.error('Web search error:', error.message);
    return {
      answer: '',
      results: []
    };
  }
}

// Check if query needs real-time information
function needsRealTimeInfo(message) {
  const keywords = [
    'weather', 'temperature', 'forecast', 'climate',
    'today', 'now', 'current', 'latest', 'recent',
    'news', 'breaking', 'happening',
    'price', 'stock', 'crypto', 'bitcoin', 'ethereum',
    'score', 'game', 'match', 'sports',
    'what is', 'when is', 'where is',
    'how is', 'did', 'has', 'will',
    'twitter', 'instagram', 'facebook', 'trending',
    'covid', 'pandemic', 'virus'
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

// ─── PDF TEXT EXTRACTION (PDF.js) ───────────────────────────────
async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer)
  });

  const pdf = await loadingTask.promise;

  // Safety cap (prevents huge PDFs from freezing server)
  const maxPages = Math.min(pdf.numPages, 50);

  let extractedText = '';

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    extractedText += strings.join(' ') + '\n';
  }

  return extractedText;
}

// ─── File Upload Route (PDF & Text Only) ──────────────────────────────────
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    let extractedText = '';

    // Handle PDFs
if (file.mimetype === 'application/pdf') {
  try {
    extractedText = await extractPdfText(file.buffer);
  } catch (pdfError) {
    console.error('PDF Parse Error:', pdfError);
    return res.status(500).json({ 
      error: 'Failed to parse PDF: ' + pdfError.message 
    });
  }
}
    // Handle text files
    else if (file.mimetype === 'text/plain' || file.mimetype === 'text/markdown') {
      extractedText = file.buffer.toString('utf-8');
    }

    res.json({
      success: true,
      filename: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      content: extractedText.substring(0, 50000) // Limit to 50k chars
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});
// ──────────────────────────────────────────────────────────────────────────

// AUTH ROUTES

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword
    });

    const token = jwt.sign(
      { userId: user._id.toString(), email }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { userId: user._id.toString(), email: user.email }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { userId: user._id.toString(), email: user.email }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ userId: user._id.toString(), email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get user.' });
  }
});

// CHAT ROUTES

app.post('/api/chat/stream', authenticateToken, async (req, res) => {
  const { message, conversationId, fileContent, fileName } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    let conversation;

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      
      if (!conversation || conversation.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied.' });
      }

    } else {
      conversation = await Conversation.create({
        userId: req.userId,
        title: generateTitle(message)
      });
    }

    // Prepare user message with file context
    let userMessageForDB = message;
    
    if (fileContent) {
      userMessageForDB = `[File: ${fileName}]\n\nFile content:\n${fileContent.substring(0, 1000)}...\n\n---\n\n${message}`;
    }

    await Message.create({
      conversationId: conversation._id,
      role: 'user',
      content: userMessageForDB
    });

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });

    const history = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ 
      type: 'start', 
      conversationId: conversation._id.toString(), 
      title: conversation.title 
    })}\n\n`);

    let fullResponse = '';

    // Build message content for AI
    let messageContent;
    
    if (fileContent) {
      // For PDF/text files
      messageContent = `[User uploaded file: ${fileName}]\n\nFile content:\n${fileContent}\n\n---\n\nUser question: ${message}`;
    } else {
      messageContent = message;
    }

    // Check if query needs real-time information
    let searchContext = '';
    if (needsRealTimeInfo(message)) {
      res.write(`data: ${JSON.stringify({ type: 'searching', query: message })}\n\n`);
      
      const searchResults = await searchWeb(message);
      
      if (searchResults.results && searchResults.results.length > 0) {
        searchContext = `\n\n[Recent web search results for: "${message}"]\n`;
        if (searchResults.answer) {
          searchContext += `Summary: ${searchResults.answer}\n\n`;
        }
        searchContext += 'Results:\n';
        searchResults.results.forEach((result, i) => {
          searchContext += `${i + 1}. ${result.title}\n   ${result.content}\n   Source: ${result.url}\n`;
        });
        searchContext += '\nBased on the above information, provide your response:\n';
      }
    }

    // Build messages for AI
    const messagesForAI = [
      { role: 'system', content: (process.env.SYSTEM_PROMPT || 'You are a helpful AI assistant.') + searchContext },
      ...history.slice(-5)
    ];
    
    // Add current message
    messagesForAI.push({ role: 'user', content: messageContent });

    // Stream response from AI
    const stream = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      stream: true,
      messages: messagesForAI
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    await Message.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: fullResponse
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Streaming error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed.' })}\n\n`);
    res.end();
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (conversation.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });

    res.json({
      id: conversation._id.toString(),
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load conversation.' });
  }
});

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.userId })
      .sort({ createdAt: -1 });

    const list = await Promise.all(
      conversations.map(async (conv) => {
        const messageCount = await Message.countDocuments({ 
          conversationId: conv._id 
        });
        
        return {
          id: conv._id.toString(),
          title: conv.title,
          createdAt: conv.createdAt,
          messageCount
        };
      })
    );

    res.json({ conversations: list });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

app.delete('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (conversation.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Conversation deleted.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Orion AI running at http://localhost:${PORT}`);
  console.log(`🤖 Model: ${MODEL} (via Groq)`);
  console.log(`💾 Database: MongoDB`);
  console.log(`🔐 Auth: JWT-based`);
  console.log(`📄 File support: PDF & Text files\n`);
});