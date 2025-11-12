import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "../routes";
import { ensureAdminExists } from "../ensure-admin";
import { log } from "../vite";

const app = express();
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
