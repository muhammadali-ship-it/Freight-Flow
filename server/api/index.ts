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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


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

// ---- SERVERLESS WRAPPER ----
import { createServer } from "http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const server = createServer(app);

export default (req: VercelRequest, res: VercelResponse) => {
  server.emit("request", req, res);
};




// import express, { type Request, type Response, type NextFunction } from "express";
// import cors from "cors";
// import { registerRoutes } from "../routes.js";
// import { ensureAdminExists } from "../ensure-admin.js";
// import { log } from "../vite.js";

// const app = express();

// // CORS configuration
// const corsOptions = {
//   origin: [
//     'http://localhost:5173', // Vite dev server
//     'http://localhost:3000', // Alternative dev server
//     'https://freight-flow-steel.vercel.app', // Production frontend (if deployed)
//     // Add your production frontend URL here when deployed
//   ],
//   credentials: true, // Allow cookies and credentials
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
// };

// app.use(cors(corsOptions));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// // Logging middleware
// app.use((req, res, next) => {
//   const start = Date.now();
//   const path = req.path;
//   let capturedJsonResponse: Record<string, any> | undefined = undefined;

//   const originalResJson = res.json;
//   res.json = function (bodyJson, ...args) {
//     capturedJsonResponse = bodyJson;
//     return originalResJson.apply(res, [bodyJson, ...args]);
//   };

//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     if (path.startsWith("/api")) {
//       let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
//       if (capturedJsonResponse) {
//         logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
//       }

//       if (logLine.length > 80) {
//         logLine = logLine.slice(0, 79) + "…";
//       }

//       log(logLine);
//     }
//   });

//   next();
// });

// (async () => {
//   try {
//     // Ensure admin user exists
//     await ensureAdminExists();

//     // Register all routes
//     const server = await registerRoutes(app);

//     // Global error handler
//     app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
//       const status = err.status || err.statusCode || 500;
//       const message = err.message || "Internal Server Error";

//       res.status(status).json({ message });
//       // Optional: log the error
//       console.error(err);
//     });

//     // Start server (Windows-compatible)
//     const port = parseInt(process.env.PORT || "5000", 10);
//     server.listen(port, "0.0.0.0", () => {
//       log(`serving on port ${port}`);
//     });
//   } catch (err) {
//     console.error("Failed to start server:", err);
//   }
// })();

