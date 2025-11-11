// Vercel serverless function wrapper
// This file is in JavaScript to avoid TypeScript compilation issues

// Import the built Express app
import('../dist/index.js').then(module => {
  // The module should export the Express app
  if (module.default) {
    module.exports = module.default;
  }
}).catch(err => {
  console.error('Failed to load Express app:', err);
});
