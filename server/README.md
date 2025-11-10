# FreightFlow Server

Express-based backend API for FreightFlow logistics tracking system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env` file in the server directory with:
```env
DATABASE_URL=your_database_url
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NODE_ENV=development
PORT=5000
```

3. Push database schema:
```bash
npm run db:push
```

## Development

Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`.

## Build & Production

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Technology Stack

- Node.js
- Express
- TypeScript
- Drizzle ORM
- PostgreSQL (Neon)
- Passport.js (authentication)
- WebSockets (real-time updates)

