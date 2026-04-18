import { Ollama } from 'ollama';
import { getToolDefinitions, executeTool } from './tool-registry.js';
import { log, logError } from '../utils/logger.js';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

const MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';

const SYSTEM_PROMPT = `You are a financial research coordinator agent. Your job is to gather comprehensive data about stocks, sectors, or financial assets by calling specialized tools.

AVAILABLE TOOLS:
{tools}

RESPONSE FORMAT:
You MUST respond with valid JSON only. Use this format:

{{
  "thought": "Your reasoning about what data to gather next",
  "tool_calls": [
    {{"name": "tool_name", "args": {{"arg1": "value1"}}}}
  ],
  "done": false
}}

When you have gathered sufficient data to write a comprehensive report, set "done": true and include your final analysis.

GUIDELINES:
1. For single ticker queries: get price data, news, analyst ratings, fundamentals, and calculate technicals
2. For sector queries: first scan_sector, then get details on top 3-5 tickers
3. Always get historical prices before calculating technical metrics
4. Fetch recent news for sentiment analysis
5. Limit parallel tool calls to 3-4 at a time
6. Be efficient - don't call redundant tools

FINAL REPORT FORMAT (when done=true):
{{
  "thought": "Analysis complete",
  "done": true,
  "report": {{
    "assets": [...],
    "sector_overview": "...",
    "macro_context": "...",
    "overall_sentiment": "bullish|bearish|neutral|mixed",
    "confidence_score": 0.85
  }}
}}`;

export class CoordinatorAgent {
  constructor(onProgress) {
    this.onProgress = onProgress;
    this.conversationHistory = [];
    this.maxIterations = 5;
    this.iteration = 0;
  }

  async run(intent) {
    const toolDefs = getToolDefinitions();
    const systemPrompt = SYSTEM_PROMPT.replace('{tools}', JSON.stringify(toolDefs, null, 2));

    this.conversationHistory = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Research request:
Type: ${intent.type}
Query: ${intent.raw_query}
Resolved intent: ${JSON.stringify(intent.resolved, null, 2)}

Begin gathering data. Start with the most important tools first.`
      }
    ];

    while (this.iteration < this.maxIterations) {
      this.iteration++;
      log(`Coordinator iteration ${this.iteration}`);

      const response = await this.callModel();
      const parsed = this.parseResponse(response);

      if (parsed.done) {
        log('Coordinator completed with final report');
        return parsed.report;
      }

      if (parsed.tool_calls && parsed.tool_calls.length > 0) {
        const toolResults = await this.executeTools(parsed.tool_calls);
        this.addToolResultsToHistory(parsed.tool_calls, toolResults);
      } else {
        // No tool calls and not done - prompt to continue
        this.conversationHistory.push({
          role: 'user',
          content: 'Please continue gathering data or provide your final analysis.'
        });
      }
    }

    logError('Max iterations reached, forcing completion');
    return this.forceComplete();
  }

  async callModel() {
    const response = await ollama.chat({
      model: MODEL,
      messages: this.conversationHistory,
      format: 'json',
      stream: false
    });

    return response.message.content;
  }

  parseResponse(content) {
    try {
      const parsed = JSON.parse(content);
      return {
        thought: parsed.thought,
        tool_calls: parsed.tool_calls || [],
        done: parsed.done || false,
        report: parsed.report || null
      };
    } catch (e) {
      logError('Failed to parse coordinator response:', content);
      return { done: false, tool_calls: [] };
    }
  }

  async executeTools(toolCalls) {
    const results = [];
    for (const call of toolCalls) {
      log(`Executing tool: ${call.name}`);
      this.onProgress?.({ agent: call.name, status: 'running' });

      const result = await executeTool(call.name, call.args || {});
      results.push({ tool: call.name, result });

      this.onProgress?.({
        agent: call.name,
        status: result.status,
        duration_ms: result.duration_ms
      });
    }
    return results;
  }

  addToolResultsToHistory(toolCalls, toolResults) {
    const toolMessage = {
      role: 'user',
      content: 'Tool execution results:\n' + toolResults.map((r, i) =>
        `Tool: ${toolCalls[i].name}\nResult: ${JSON.stringify(r.result, null, 2)}`
      ).join('\n\n')
    };
    this.conversationHistory.push(toolMessage);
  }

  async forceComplete() {
    this.conversationHistory.push({
      role: 'user',
      content: `Based on all the data gathered, provide a final research report in this JSON format:
{
  "assets": [array of asset objects with ticker, price, metrics, news, etc],
  "sector_overview": "string or null",
  "macro_context": "string or null",
  "overall_sentiment": "bullish|bearish|neutral|mixed",
  "confidence_score": number 0-1
}`
    });

    const response = await this.callModel();
    const parsed = this.parseResponse(response);
    return parsed.report || this.generateFallbackReport();
  }

  generateFallbackReport() {
    return {
      assets: [],
      sector_overview: 'Analysis incomplete due to data limitations',
      macro_context: null,
      overall_sentiment: 'neutral',
      confidence_score: 0.3
    };
  }
}
