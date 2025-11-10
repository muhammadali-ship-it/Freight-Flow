# FreightFlow

Complete logistics tracking and management system with real-time container tracking, shipment management, and analytics.

## 🚀 Quick Start (Local Setup)

This project was built on Replit with a Neon PostgreSQL database. Follow these steps to run it locally:

### Step 1: Get Database Credentials

1. Go to your Replit project
2. Click **"Tools"** → **"Secrets"** (🔒 icon)
3. Copy the `DATABASE_URL` value

### Step 2: Configure Environment Variables

**Server Setup:**
```bash
cd server
# Create .env file from the template
cp ENV_SETUP.txt .env
# Edit .env and add your DATABASE_URL and SESSION_SECRET
```

**Client Setup:**
```bash
cd client
# Create .env file from the template
cp ENV_SETUP.txt .env
# (Already configured for local development)
```

### Step 3: Install & Run

Open **two terminals**:

**Terminal 1 - Server:**
```bash
cd server
npm install
npm run db:push    # First time only - sets up database schema
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm install
npm run dev
```

### Step 4: Access the Application

Open your browser: **http://localhost:5173**

---

## 📁 Project Structure

```
FreightFlow1/
├── client/              # React frontend application
│   ├── src/
│   ├── package.json
│   ├── ENV_SETUP.txt   # Environment setup guide
│   └── README.md
│
├── server/              # Express backend API
│   ├── services/
│   ├── shared/         # Database schema
│   ├── routes.ts
│   ├── package.json
│   ├── ENV_SETUP.txt   # Environment setup guide
│   └── README.md
│
├── SETUP_GUIDE.md      # Detailed setup instructions
└── README.md
```

## ✨ Features

- 📦 **Container Tracking** - Real-time container tracking with status updates
- 🚢 **Shipment Management** - Complete shipment lifecycle management
- 📊 **Analytics Dashboard** - Comprehensive analytics and reporting
- 🗺️ **Interactive Maps** - Live vessel positions and route tracking
- 📄 **Document Management** - Upload and manage shipping documents
- 🔔 **Real-time Notifications** - Instant alerts for shipment updates
- 👥 **Multi-user Support** - Role-based access control
- 🔗 **API Integrations** - Connect with shipping lines and carriers
- ⚠️ **Risk Assessment** - Automated demurrage and delay detection

## 📚 Documentation

- [**SETUP_GUIDE.md**](./SETUP_GUIDE.md) - Detailed setup instructions
- [Client Documentation](./client/README.md) - Frontend setup
- [Server Documentation](./server/README.md) - Backend setup

## 🛠️ Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- TailwindCSS + Radix UI
- React Query (TanStack)
- Recharts (Analytics)
- Leaflet (Maps)

**Backend:**
- Node.js + Express
- TypeScript
- Drizzle ORM
- PostgreSQL (Neon)
- Passport.js (Auth)
- WebSockets

## 🔧 Environment Variables

### Server (Required)
- `DATABASE_URL` - Your Replit/Neon database connection string
- `SESSION_SECRET` - Random secret key for sessions (32+ characters)

### Server (Optional)
- `PORT` - Server port (default: 5000)
- `CARGOES_FLOW_API_KEY` - Cargoes Flow API integration
- `SHIPNEXUS_API_URL` - ShipNexus API integration

### Client
- `VITE_API_URL` - Backend API URL (default: http://localhost:5000)

## 🆘 Troubleshooting

**Database Connection Error?**
- Verify your `DATABASE_URL` is correct
- Check if your Replit database is active
- Ensure the connection string includes `?sslmode=require`

**Port Already in Use?**
- Change the `PORT` in `server/.env`
- Vite will auto-assign a new port for the client

**Missing Dependencies?**
- Run `npm install` in both `client/` and `server/` directories

For detailed troubleshooting, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## 📝 License

MIT

