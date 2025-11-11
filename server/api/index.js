// Vercel serverless function wrapper
import express from "express";
import { registerRoutes } from "../routes.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize routes
let routesInitialized = false;
let server;

async function initializeApp() {
  if (!routesInitialized) {
    server = await registerRoutes(app);
    routesInitialized = true;
  }
  return app;
}

// Export for Vercel
export default async function handler(req, res) {
  const app = await initializeApp();
  return app(req, res);
}
