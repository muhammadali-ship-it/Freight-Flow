import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "../routes.js";
import cors from "cors";
import { ensureAdminExists } from "../ensure-admin.js";
import { log } from "../vite.js";

const app = express();
// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative dev server
    'https://freight-flow-steel.vercel.app', // Production frontend (if deployed)
    // Add your production frontend URL here when deployed
  ],
  credentials: true, // Allow cookies and credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'], // Expose Set-Cookie header
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Debug middleware for session issues
app.use((req, res, next) => {
  if (req.path.includes('/api/user') || req.path.includes('/login')) {
    console.log('[Session Debug]', {
      path: req.path,
      method: req.method,
      sessionID: req.sessionID,
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
      cookies: req.headers.cookie,
      origin: req.headers.origin
    });
  }
  next();
});


app.get("/", (_req, res) => {
  res.json({ message: "FreightFlow backend is running 🚀" });
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

await ensureAdminExists();
await registerRoutes(app);

// Error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// ---- ENVIRONMENT-BASED STARTUP ----
import { createServer } from "http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Check if we're running on Vercel (serverless) or locally (traditional server)
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

// ---- SERVERLESS WRAPPER FOR VERCEL ----
const server = createServer(app);

// Export for Vercel (always export, but only used in serverless)
export default (req: VercelRequest, res: VercelResponse) => {
  server.emit("request", req, res);
};

// ---- LOCAL DEVELOPMENT SERVER ----
if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API docs available at http://localhost:${PORT}/api`);
  });
}
