# 🌟 Orion AI - Complete with MongoDB

**Full-stack AI assistant with MongoDB database, JWT authentication, and production-ready chat interface.**

---

## ✅ What's Included

- 🎨 **Landing Page** - Professional cosmic-themed homepage
- 🔐 **JWT Authentication** - Secure signup/login system
- 💬 **Chat Interface** - Real-time streaming AI responses
- 📁 **Multiple Conversations** - Organized chat history
- 💾 **MongoDB Database** - Permanent data storage
- 👤 **User Management** - Profile, logout, session handling
- ⚡ **Groq AI Integration** - Fast, free AI responses

---

## 🚀 Quick Start (5 Steps)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up MongoDB

**Option A: Free Cloud Database (Recommended)**

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up (free tier)
3. Create a cluster (M0 Free)
4. Create database user:
   - Username: `orion_user`
   - Password: (save this!)
5. Get connection string:
   - Click "Connect"
   - Choose "Connect your application"
   - Copy connection string

**Option B: Local MongoDB**
```bash
# Mac
brew install mongodb-community

# Ubuntu
sudo apt install mongodb

# Windows: Download from mongodb.com
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add:

```env
# MongoDB (replace <password> with your actual password)
MONGODB_URI=mongodb+srv://orion_user:<password>@cluster0.xxxxx.mongodb.net/orion?retryWrites=true&w=majority

# Groq API (get from console.groq.com)
GROQ_API_KEY=gsk_your_key_here

# JWT Secret (generate with command below)
JWT_SECRET=your_generated_secret_here
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start Server
```bash
npm run dev
```

### 5. Open Browser
```
http://localhost:3000
```

**Done!** You should see the landing page.

---

## 📁 Project Structure

```
orion-mongodb/
├── models/
│   ├── User.js              # User schema
│   ├── Conversation.js      # Conversation schema
│   └── Message.js           # Message schema
├── server/
│   └── index.js             # Express server + MongoDB
├── public/
│   ├── index.html           # Landing page
│   ├── signup.html          # User registration
│   ├── login.html           # User login
│   ├── chat.html            # Chat interface
│   ├── css/
│   │   ├── landing.css
│   │   ├── auth.css
│   │   └── chat.css
│   └── js/
│       ├── auth.js          # Auth logic
│       └── chat.js          # Chat functionality
├── package.json
├── .env.example
└── README.md
```

---

## 💾 MongoDB Data Structure

### Collections

#### **users**
```javascript
{
  _id: ObjectId("..."),
  email: "alice@test.com",
  password: "$2b$10$...",  // hashed
  createdAt: ISODate("2025-02-19T10:00:00Z")
}
```

#### **conversations**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),  // references user
  title: "AI Chat",
  createdAt: ISODate("2025-02-19T10:00:00Z")
}
```

#### **messages**
```javascript
{
  _id: ObjectId("..."),
  conversationId: ObjectId("..."),  // references conversation
  role: "user" | "assistant",
  content: "What is AI?",
  createdAt: ISODate("2025-02-19T10:00:00Z")
}
```

---

## 🔐 Authentication Flow

```
1. User signs up → Password hashed with bcrypt → Saved to MongoDB
2. User logs in → Password verified → JWT token issued
3. Token stored in localStorage
4. All API calls include: Authorization: Bearer <token>
5. Server verifies token → Identifies user → Returns data
```

---

## 📡 API Endpoints

### **Public Routes**
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in

### **Protected Routes** (require JWT token)
- `GET /api/auth/me` - Get current user
- `POST /api/chat/stream` - Send message (streaming)
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/:id` - Get conversation details
- `DELETE /api/conversations/:id` - Delete conversation

---

## 🧪 Testing Checklist

After `npm run dev`:

1. ✅ Open http://localhost:3000
2. ✅ Landing page loads with animations
3. ✅ Click "Get Started" → Signup form
4. ✅ Create account → Auto-redirects to chat
5. ✅ Send message → AI responds with streaming
6. ✅ Click "+ New" → New conversation
7. ✅ Refresh page → Conversations still there
8. ✅ Restart server → Data persists!
9. ✅ Logout → Redirects to landing
10. ✅ Login again → Your data is there

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **AI** | Groq (LLaMA 3.3) |
| **Auth** | JWT + bcrypt |
| **Frontend** | Vanilla JavaScript |
| **Styling** | Custom CSS |

---

## 🔒 Security Features

✅ Password hashing with bcrypt (10 rounds)  
✅ JWT tokens with 7-day expiration  
✅ Protected API routes  
✅ User data isolation  
✅ Rate limiting (60 req/min)  
✅ Input validation  

---

## 📚 What You Learned

### **MongoDB Concepts**
- Collections (like tables)
- Documents (like rows, but flexible JSON)
- ObjectId (unique identifiers)
- References (linking documents)
- Mongoose schemas

### **CRUD Operations**
```javascript
// Create
await User.create({ email, password });

// Read
await User.findOne({ email });
await Conversation.find({ userId });

// Update
await User.findByIdAndUpdate(id, { ... });

// Delete
await Conversation.findByIdAndDelete(id);
```

### **Relationships**
```javascript
// One user → Many conversations
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}
```

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
❌ MongoDB connection error
```
**Fix:**
- Check MONGODB_URI in .env
- Make sure password doesn't have special characters (or URL-encode them)
- Verify IP is whitelisted in MongoDB Atlas

### "Invalid token" Error
**Fix:**
- Logout and login again
- Check JWT_SECRET is set in .env

### Server won't start
**Fix:**
- Run `npm install` again
- Check .env has all required variables
- Verify port 3000 isn't in use

---

## ⏭️ Next Steps (Phase 3+)

Now you can add:

**A) Web Search** - Let Orion search the internet  
**B) File Upload** - PDF/image support  
**C) Deploy to Production** - Make it live  
**D) Google OAuth** - Sign in with Google  

---

## 📞 Support

Check MongoDB connection:
```bash
# In MongoDB Atlas dashboard
# Click "Connect" → "Connect your application"
# Verify connection string format
```

Check server logs:
```bash
npm run dev
# Watch for "✅ Connected to MongoDB"
```

---

**Built with Node.js, MongoDB, Groq, and JWT 🚀**

Your data now persists forever. Ready for production!
