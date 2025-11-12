# Environment Configuration Guide

This guide explains how to configure the frontend to connect to different backend URLs using environment variables.

## Environment Variables

The frontend supports the following environment variables:

### `VITE_API_URL`
- **Purpose**: Base URL for the backend server
- **Default**: 
  - Development: `http://localhost:5000`
  - Production: `https://freight-flow-steel.vercel.app`
- **Example**: `VITE_API_URL=https://my-custom-backend.com`

### `VITE_API_BASE_URL`
- **Purpose**: Full API base URL including the `/api` path
- **Default**: 
  - Development: `/api` (uses Vite proxy)
  - Production: `https://freight-flow-steel.vercel.app/api`
- **Example**: `VITE_API_BASE_URL=https://my-custom-backend.com/api`

## Setup Instructions

### 1. Create Environment File

Create a `.env` file in the client directory:

```bash
# Copy the example file
cp .env.example .env
```

### 2. Configure for Different Environments

#### Local Development with Proxy (Default)
```env
# .env - Uses Vite proxy, requests go through localhost:5173/api/*
# No environment variables needed - this is the default behavior
```

#### Local Development with Direct Backend Connection
```env
# .env - Bypasses proxy, connects directly to backend
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000/api
```

#### Custom Backend URL
```env
# .env
VITE_API_URL=https://your-backend-url.com
VITE_API_BASE_URL=https://your-backend-url.com/api
```

#### Production Deployment
```env
# .env
VITE_API_URL=https://freight-flow-steel.vercel.app
VITE_API_BASE_URL=https://freight-flow-steel.vercel.app/api
```

### 3. Restart Development Server

After changing environment variables, restart the development server:

```bash
npm run dev
```

## How It Works

### Vite Proxy Configuration
- In development, the Vite config uses `VITE_API_URL` for the proxy target
- API requests to `/api/*` are automatically proxied to the backend

### API Request Handling
- The `buildApiUrl()` function automatically constructs the correct URLs
- In development: Uses relative URLs (`/api/endpoint`) that go through the proxy
- In production: Uses full URLs (`https://backend.com/api/endpoint`)

### Automatic Fallbacks
- If no environment variables are set, sensible defaults are used
- Development defaults to `localhost:5000`
- Production defaults to the deployed Vercel app

## Troubleshooting

### CORS Issues
If you encounter CORS errors when connecting to a custom backend:

1. Ensure your backend allows requests from your frontend domain
2. Check that credentials are properly configured
3. Verify the backend URL is accessible

### Environment Variables Not Loading
1. Ensure the `.env` file is in the client directory
2. Restart the development server after changes
3. Check that variable names start with `VITE_`

### Proxy Not Working
1. Verify `VITE_API_URL` is set correctly
2. Check that the backend server is running on the specified port
3. Ensure no firewall is blocking the connection

## Examples

### Connecting to Different Ports
```env
# Backend running on port 3000
VITE_API_URL=http://localhost:3000
```

### Connecting to Remote Development Server
```env
# Remote development server
VITE_API_URL=https://dev-api.mycompany.com
VITE_API_BASE_URL=https://dev-api.mycompany.com/api
```

### Using Different Protocols
```env
# HTTPS local development (if using SSL)
VITE_API_URL=https://localhost:5000
```
