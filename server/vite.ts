import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Lazy load vite - only needed if this function is called
  let createViteServer: any;
  let createLogger: any;
  
  try {
    const viteModule = await import("vite");
    createViteServer = viteModule.createServer;
    createLogger = viteModule.createLogger;
  } catch {
    throw new Error("Vite is not installed. Install it with: npm install vite --save-dev");
  }

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // Try to load vite config from client directory, or use defaults
  let viteConfig = {};
  const viteConfigPath = path.resolve(import.meta.dirname, "..", "client", "vite.config.ts");
  try {
    if (fs.existsSync(viteConfigPath)) {
      const configModule = await import(viteConfigPath);
      viteConfig = configModule.default || {};
    }
  } catch (e) {
    // If config can't be loaded, use defaults
    log("Could not load vite.config.ts, using defaults", "vite");
  }

  const vite = await createViteServer({
    ...viteConfig,
    configFile: path.resolve(import.meta.dirname, "..", "client", "vite.config.ts"),
    root: path.resolve(import.meta.dirname, "..", "client"),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      
      // Lazy load nanoid if available
      try {
        const nanoidModule = await import("nanoid");
        const nanoid = nanoidModule.nanoid;
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
      } catch {
        // Nanoid not available, skip cache busting
      }
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
