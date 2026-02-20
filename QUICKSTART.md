# ⚡ QUICKSTART - Get Running in 3 Minutes

## Step 1: Install
```bash
npm install
```

## Step 2: Get MongoDB Connection String

Go to https://www.mongodb.com/cloud/atlas

1. Sign up (free)
2. Create cluster (M0 Free)
3. Create user: `orion_user` + password
4. Click "Connect" → "Connect your application"
5. **Copy connection string**

## Step 3: Configure
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb+srv://orion_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/orion

GROQ_API_KEY=gsk_YOUR_KEY_FROM_CONSOLE_GROQ_COM

JWT_SECRET=RUN_THIS_COMMAND_BELOW
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Run
```bash
npm run dev
```

## Step 5: Test
Open http://localhost:3000

1. Click "Get Started"
2. Create account
3. Chat with Orion!

---

## ✅ Checklist

- [ ] MongoDB connection string in .env
- [ ] Groq API key in .env
- [ ] JWT secret generated
- [ ] `npm install` completed
- [ ] Server running (`npm run dev`)
- [ ] Can create account
- [ ] Can send messages
- [ ] Data persists after restart

---

## 🆘 Quick Fixes

**Can't connect to MongoDB?**
- Check password in connection string
- Whitelist your IP in MongoDB Atlas

**Server won't start?**
- Run `npm install` again
- Check all .env variables are set

**Token errors?**
- Clear browser localStorage
- Login again

---

That's it! You're done. 🎉
