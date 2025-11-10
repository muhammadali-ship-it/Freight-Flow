# 🚀 Quick Start Guide - FreightFlow

Get FreightFlow running locally in 5 minutes!

## Prerequisites

- Node.js v18+ installed
- Access to your Replit project (for database credentials)

---

## 🎯 Fast Setup (Recommended)

### 1. Run Setup Script

**Windows PowerShell:**
```powershell
.\setup-local.ps1
```

The script will:
- Check Node.js installation
- Create `.env` files from templates
- Install all dependencies

### 2. Get Replit Credentials

1. Go to **https://replit.com** and open your FreightFlow project
2. Click **Tools** → **Secrets** (🔒 icon)
3. Copy the `DATABASE_URL` value

### 3. Configure Server Environment

Open `server\.env` and update:

```env
DATABASE_URL=postgresql://your-replit-db-connection-string
SESSION_SECRET=run-this-command-below-to-generate
```

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Initialize Database (First Time Only)

```bash
cd server
npm run db:push
```

### 5. Start Both Servers

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```
Wait until you see: `serving on port 5000`

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```
Wait until you see: `Local: http://localhost:5173/`

### 6. Open Browser

Navigate to: **http://localhost:5173**

---

## 🛠️ Manual Setup (Alternative)

If you prefer to set up manually:

### Server

```bash
cd server
cp ENV_SETUP.txt .env
# Edit .env with your credentials
npm install
npm run db:push
npm run dev
```

### Client

```bash
cd client
cp ENV_SETUP.txt .env
npm install
npm run dev
```

---

## 📋 Environment Variables Checklist

### Server (`server/.env`)

**Required:**
- [x] `DATABASE_URL` - From Replit Secrets
- [x] `SESSION_SECRET` - Generate with crypto

**Optional (pre-configured):**
- [x] `NODE_ENV=development`
- [x] `PORT=5000`

### Client (`client/.env`)

- [x] `VITE_API_URL=http://localhost:5000`

---

## ✅ Verify Setup

Your setup is successful if:

1. **Server Terminal** shows:
   ```
   serving on port 5000
   ```

2. **Client Terminal** shows:
   ```
   ➜  Local:   http://localhost:5173/
   ```

3. **Browser** at `http://localhost:5173` loads the FreightFlow login page

4. **No errors** in either terminal

---

## 🎓 Default Login

An admin user is automatically created on first run. Check your server terminal logs for credentials.

To create a new admin:
```bash
cd server
node create-admin.ts
```

---

## ⚡ Daily Development Workflow

After initial setup, you only need:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

---

## 🐛 Common Issues

### "DATABASE_URL must be set"
→ Make sure you've updated `server/.env` with your Replit database URL

### "Port 5000 is already in use"
→ Change `PORT=5001` in `server/.env` and update `VITE_API_URL` in `client/.env`

### "Module not found"
→ Run `npm install` in the server or client directory

### Database connection fails
→ Check if your Replit database is active (free tier may sleep)

---

## 📚 More Help

- [**SETUP_GUIDE.md**](./SETUP_GUIDE.md) - Detailed setup with troubleshooting
- [**README.md**](./README.md) - Project overview and features
- Server docs: `server/README.md`
- Client docs: `client/README.md`

---

## 🎉 You're All Set!

Happy shipping! 🚢

