// Vercel serverless function wrapper
import express from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from parent directory (server root)
const { registerRoutes } = await import(join(__dirname, '..', 'routes.js'));
const { setupAuth } = await import(join(__dirname, '..', 'auth.js'));

let app = null;

async function getApp() {
  if (app) return app;
  
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Setup authentication
  setupAuth(app);
  
  // Register routes
  await registerRoutes(app);
  
  return app;
}

export default async function handler(req, res) {
  try {
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
