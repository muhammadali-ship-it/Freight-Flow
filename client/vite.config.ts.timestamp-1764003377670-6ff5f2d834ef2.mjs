// vite.config.ts
import { defineConfig } from "file:///C:/Users/Muhammad%20Ali/Desktop/code/Freight/Freight-Flow/client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Muhammad%20Ali/Desktop/code/Freight/Freight-Flow/client/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Muhammad Ali\\Desktop\\code\\Freight\\Freight-Flow\\client";
var vite_config_default = defineConfig(({ mode }) => {
  const defaultApiUrl = mode === "production" ? "https://freight-flow-steel.vercel.app" : "http://localhost:5000";
  const apiUrl = process.env.VITE_API_URL || defaultApiUrl;
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "src"),
        "@shared": path.resolve(__vite_injected_original_dirname, "..", "server", "shared")
      }
    },
    build: {
      outDir: path.resolve(__vite_injected_original_dirname, "dist"),
      emptyOutDir: true
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true
        }
      }
    },
    optimizeDeps: {
      exclude: ["drizzle-orm"]
    },
    ssr: {
      noExternal: ["drizzle-orm", "drizzle-zod"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNdWhhbW1hZCBBbGlcXFxcRGVza3RvcFxcXFxjb2RlXFxcXEZyZWlnaHRcXFxcRnJlaWdodC1GbG93XFxcXGNsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcTXVoYW1tYWQgQWxpXFxcXERlc2t0b3BcXFxcY29kZVxcXFxGcmVpZ2h0XFxcXEZyZWlnaHQtRmxvd1xcXFxjbGllbnRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL011aGFtbWFkJTIwQWxpL0Rlc2t0b3AvY29kZS9GcmVpZ2h0L0ZyZWlnaHQtRmxvdy9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgLy8gRGVmYXVsdCBBUEkgVVJMIC0gY2FuIGJlIG92ZXJyaWRkZW4gYnkgZW52aXJvbm1lbnQgdmFyaWFibGVzXHJcbiAgY29uc3QgZGVmYXVsdEFwaVVybCA9IG1vZGUgPT09ICdwcm9kdWN0aW9uJyBcclxuICAgID8gJ2h0dHBzOi8vZnJlaWdodC1mbG93LXN0ZWVsLnZlcmNlbC5hcHAnXHJcbiAgICA6ICdodHRwOi8vbG9jYWxob3N0OjUwMDAnO1xyXG5cclxuICBjb25zdCBhcGlVcmwgPSBwcm9jZXNzLmVudi5WSVRFX0FQSV9VUkwgfHwgZGVmYXVsdEFwaVVybDtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwic3JjXCIpLFxyXG4gICAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCIuLlwiLCBcInNlcnZlclwiLCBcInNoYXJlZFwiKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lLCBcImRpc3RcIiksXHJcbiAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBwb3J0OiA1MTczLFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgICcvYXBpJzoge1xyXG4gICAgICAgICAgdGFyZ2V0OiBhcGlVcmwsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgZXhjbHVkZTogWydkcml6emxlLW9ybSddLFxyXG4gICAgfSxcclxuICAgIHNzcjoge1xyXG4gICAgICBub0V4dGVybmFsOiBbJ2RyaXp6bGUtb3JtJywgJ2RyaXp6bGUtem9kJ10sXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThYLFNBQVMsb0JBQW9CO0FBQzNaLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFFeEMsUUFBTSxnQkFBZ0IsU0FBUyxlQUMzQiwwQ0FDQTtBQUVKLFFBQU0sU0FBUyxRQUFRLElBQUksZ0JBQWdCO0FBRTNDLFNBQU87QUFBQSxJQUNMLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxJQUNqQixTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBcUIsS0FBSztBQUFBLFFBQzVDLFdBQVcsS0FBSyxRQUFRLGtDQUFxQixNQUFNLFVBQVUsUUFBUTtBQUFBLE1BQ3ZFO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUSxLQUFLLFFBQVEsa0NBQXFCLE1BQU07QUFBQSxNQUNoRCxhQUFhO0FBQUEsSUFDZjtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFVBQ04sUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFFBQ2hCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaLFNBQVMsQ0FBQyxhQUFhO0FBQUEsSUFDekI7QUFBQSxJQUNBLEtBQUs7QUFBQSxNQUNILFlBQVksQ0FBQyxlQUFlLGFBQWE7QUFBQSxJQUMzQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
