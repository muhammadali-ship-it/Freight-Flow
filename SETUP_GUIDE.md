# FreightFlow Local Setup Guide

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Access to your Replit project (for database credentials)

## 🔧 Step-by-Step Setup

### 1. Get Database Credentials from Replit

1. Go to your Replit project: https://replit.com
2. Open your FreightFlow project
3. Click on **"Tools"** → **"Secrets"** (or the lock icon 🔒)
4. Find and copy the `DATABASE_URL` value

### 2. Configure Server Environment Variables

1. Open the `server/.env` file
2. Replace `your_replit_database_url_here` with your actual DATABASE_URL from Replit
3. Generate a secure SESSION_SECRET:

**Option A - Generate using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B - Use any random string (32+ characters):**
```
my-super-secret-session-key-12345678901234567890
```

4. Update the SESSION_SECRET in `server/.env`

Your `server/.env` should look like:
```env
DATABASE_URL=postgresql://username:password@host.neon.tech/database?sslmode=require
SESSION_SECRET=abc123def456...your-generated-secret
NODE_ENV=development
PORT=5000
```

### 3. Configure Client Environment Variables

The `client/.env` file is already configured to point to `http://localhost:5000`.
No changes needed unless you want to use a different port.

### 4. Install Dependencies

Open **two terminals** in the project root:

**Terminal 1 - Server:**
```bash
cd server
npm install
```

**Terminal 2 - Client:**
```bash
cd client
npm install
```

### 5. Set Up Database (First Time Only)

In the **server terminal**:
```bash
# Push the database schema to your Replit database
npm run db:push
```

### 6. Run the Application

Keep both terminals open:

**Terminal 1 - Start Server:**
```bash
cd server
npm run dev
```
You should see: `serving on port 5000`

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```
You should see: `Local: http://localhost:5173/`

### 7. Access the Application

Open your browser and go to:
```
http://localhost:5173
```

The client (React app) will automatically proxy API requests to the server on port 5000.

## 🎯 Quick Start Commands

After initial setup, you only need:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2  
cd client && npm run dev
```

## 🔍 Troubleshooting

### Database Connection Issues

If you get database connection errors:

1. **Check DATABASE_URL format:**
   ```
   postgresql://user:password@host.neon.tech/database?sslmode=require
   ```

2. **Verify Replit database is active:**
   - Go to your Replit project
   - Check if the database is running
   - The free tier may sleep after inactivity

3. **Test connection:**
   ```bash
   cd server
   node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
   ```

### Port Already in Use

If port 5000 or 5173 is already in use:

**For Server:**
- Change `PORT=5000` to `PORT=5001` in `server/.env`
- Update `VITE_API_URL` in `client/.env` to match

**For Client:**
- Vite will automatically try the next available port
- Update the proxy in `client/vite.config.ts` if needed

### Module Not Found Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# In client or server directory
npm run check
```

## 📦 Building for Production

### Build Server:
```bash
cd server
npm run build
npm start
```

### Build Client:
```bash
cd client
npm run build
```

The built files will be in `client/dist/`

## 🔐 Security Notes

1. **Never commit `.env` files** to git
2. **Use strong SESSION_SECRET** (32+ characters)
3. **Keep DATABASE_URL private**
4. The `.gitignore` files are already configured to exclude `.env` files

## 📝 Default Login Credentials

After running `npm run dev` for the first time, an admin user will be automatically created.
Check the server logs for the credentials, or create a new admin using:

```bash
cd server
npm run create-admin
```

## 🆘 Still Having Issues?

1. Check that both server and client are running
2. Verify `.env` files are configured correctly
3. Make sure you're using Node.js v18 or higher
4. Check server logs in Terminal 1 for detailed error messages
5. Check browser console (F12) for client-side errors

## 🎉 Success!

If everything is working, you should be able to:
- Access the application at http://localhost:5173
- Log in with your credentials
- See the dashboard and all features
- Make API calls to the Replit database

Happy shipping! 🚢

