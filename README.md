# Stock Research App

AI-powered stock/asset research application with a multi-agent harness powered by Gemma 4.

## Features

- **Natural Language Queries**: Search with plain English ("clean energy stocks", "dividend aristocrats")
- **Multi-Agent Analysis**: 7 specialized AI agents (Price, News, Fundamentals, Math/Quant, Sector Scanner, Web Search, Analyst Ratings)
- **Real-Time Data**: Live market data from Yahoo Finance
- **Dark Theme UI**: Bloomberg Terminal-inspired design with neon accents

## Prerequisites

1. **Ollama** - Install from https://ollama.com
2. **Node.js 18+** - Install from https://nodejs.org

## Setup

### 1. Install Ollama and Gemma 4

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Pull Gemma 4 model
ollama pull gemma4:e2b

# Verify installation
ollama list
# Should show: gemma4:e2b
```

### 2. Install Dependencies

```bash
cd stock-research-app

# Install all dependencies (root, server, client)
npm run install:all
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example server/.env

# Edit server/.env with your settings
# Ollama configuration is pre-filled for local use
```

### 4. Run Development Servers

```bash
# From project root
npm run dev
```

This starts:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

## Usage

1. Open http://localhost:5173 in your browser
2. Enter a query:
   - Single ticker: `AAPL`, `NVDA`, `BTC-USD`
   - Sector: `clean energy stocks`, `tech sector`
   - Asset class: `investment-grade bonds`, `crypto`
3. Watch AI agents gather data in real-time
4. View comprehensive research results

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse-query` | POST | Parse natural language query |
| `/api/research` | POST | Execute full research report |
| `/api/trending` | GET | Get trending tickers |
| `/api/health` | GET | Health check |

## Architecture

```
/
├── server/
│   ├── agents/          # Tool implementations
│   │   ├── price-agent.js
│   │   ├── news-agent.js
│   │   ├── web-search-agent.js
│   │   ├── fundamentals-agent.js
│   │   ├── sector-scanner-agent.js
│   │   ├── math-agent.js
│   │   └── analyst-ratings-agent.js
│   ├── harness/         # AI coordinator
│   │   ├── coordinator.js
│   │   └── tool-registry.js
│   ├── routes/          # API endpoints
│   └── utils/
├── client/
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Landing, Results
│   │   └── lib/         # API client, formatters
│   └── index.html
└── .env.example
```

## Troubleshooting

### Ollama Connection Errors

```bash
# Check if Ollama is running
ollama list

# Restart Ollama
ollama serve
```

### Model Not Found

```bash
# Re-pull the model
ollama pull gemma4:e2b
```

### Port Conflicts

Edit `server/.env`:
```
PORT=3002  # Change server port
```

Edit `client/vite.config.js`:
```js
server: { port: 5174 }  // Change client port
```

## License

MIT
