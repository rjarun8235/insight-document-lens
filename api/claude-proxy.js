// Simple proxy server for Claude API to avoid CORS issues
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(bodyParser.json({ limit: '50mb' }));

// Proxy endpoint for Claude API
app.post('/api/claude', async (req, res) => {
  try {
    // Get API key from environment variables
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Missing API key. Please set VITE_ANTHROPIC_API_KEY environment variable.' 
      });
    }

    // Forward the request to Anthropic API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Return the response from Claude
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying request to Claude API:', error);
    
    // Return a more detailed error response
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'No additional details available'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Claude proxy server is running' });
});

// Start the server
app.listen(port, () => {
  console.log(`Claude proxy server running on port ${port}`);
});

export default app;
