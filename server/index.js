import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { parseQueryRoute } from './routes/parse-query.js';
import { researchRoute, researchStreamRoute } from './routes/research.js';
import { trendingRoute } from './routes/trending.js';
import { sparklineRoute } from './routes/sparkline.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
  message: { error: 'Too many requests, please try again later' }
});

// Routes
app.post('/api/parse-query', parseQueryRoute);
app.post('/api/research', limiter, researchRoute);
app.get('/api/research/stream', limiter, researchStreamRoute);
app.get('/api/trending', trendingRoute);
app.get('/api/sparkline/:ticker', sparklineRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: process.env.OLLAMA_MODEL || 'gemma4:e2b' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Using Ollama model: ${process.env.OLLAMA_MODEL || 'gemma4:e2b'}`);
});
