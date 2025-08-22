const serverless = require('serverless-http');
const { createApp } = require('../../server/app.ts');

// Initialize and wrap Express app for Netlify Functions
let app;

const handler = async (event, context) => {
  if (!app) {
    app = await createApp();
  }
  return serverless(app)(event, context);
};

module.exports = { handler };