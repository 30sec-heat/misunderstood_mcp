/**
 * Claude API Client for Ysalis
 * Provides Claude integration with proper model management and conversation handling
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private systemPrompt: string;

  constructor(apiKey?: string, model?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    
    this.model = model || 'claude-3-5-sonnet-20241022';
    this.systemPrompt = this.getDefaultSystemPrompt();
  }

  /**
   * Get available Claude models with current pricing and capabilities
   */
  static getAvailableModels(): ClaudeModel[] {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent model, excellent for complex reasoning and coding',
        maxTokens: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model, great for quick responses and simple tasks',
        maxTokens: 200000,
        inputCostPer1M: 0.25,
        outputCostPer1M: 1.25,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most capable model for highly complex tasks (legacy)',
        maxTokens: 200000,
        inputCostPer1M: 15.00,
        outputCostPer1M: 75.00,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed (legacy)',
        maxTokens: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast and cost-effective (legacy)',
        maxTokens: 200000,
        inputCostPer1M: 0.25,
        outputCostPer1M: 1.25,
      },
    ];
  }

  /**
   * Get the default system prompt for Ysalis
   */
  private getDefaultSystemPrompt(): string {
    return `You are Ysalis, an AI trading agent and cryptocurrency expert. You have access to comprehensive crypto market data, trading tools, and analysis capabilities through MCP (Model Context Protocol) tools.

Your personality:
- Professional but friendly and approachable
- Knowledgeable about crypto markets, DeFi, trading strategies
- Always provide actionable insights when possible
- Explain complex concepts clearly
- Be concise but thorough in your responses

Your capabilities include:
- Real-time crypto price quotes and market data
- Technical analysis and chart patterns
- DeFi protocol analysis (Aave, liquidity pools, etc.)
- Social sentiment analysis from Telegram, Reddit, Twitter
- News aggregation and breaking news alerts
- Trading strategy creation and automation
- Portfolio analysis and risk management
- On-chain data analysis (Solana, Ethereum)
- Options and derivatives data (Deribit)
- Liquidation and funding rate monitoring

When users ask questions:
1. Provide direct, helpful answers
2. Use your MCP tools when relevant data is needed
3. Offer specific, actionable advice when appropriate
4. Explain your reasoning and data sources
5. Suggest follow-up questions or related insights

For trading-related queries, always mention risk management and that this is not financial advice.

Respond naturally to any question or request. You can engage in general conversation while being ready to help with crypto and trading topics when needed.`;
  }

  /**
   * Set a custom system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Set the model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(
    message: string,
    conversationHistory: ConversationMessage[] = []
  ): Promise<string> {
    try {
      const messages: Anthropic.Messages.MessageParam[] = [
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: message,
        },
      ];

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        system: this.systemPrompt,
        messages,
      });

      const textContent = response.content.find(
        (content): content is Anthropic.TextBlock => content.type === 'text'
      );

      return textContent?.text || 'I apologize, but I was unable to generate a response.';
    } catch (error) {
      console.error('Claude API error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          return 'I need an Anthropic API key to respond. Please set ANTHROPIC_API_KEY in your environment or use /set ANTHROPIC_API_KEY your-key-here';
        }
        return `I encountered an error: ${error.message}`;
      }
      
      return 'I encountered an unexpected error. Please try again.';
    }
  }

  /**
   * Parse natural language strategy using Claude
   */
  async parseStrategy(naturalLanguage: string): Promise<any> {
    const prompt = `Parse this natural language trading strategy into a structured format:

"${naturalLanguage}"

Return a JSON object with this structure:
{
  "symbol": "BTC" | "ETH" | etc,
  "action": "long" | "short" | "buy" | "sell",
  "condition": {
    "type": "price_above" | "price_below" | "percentage_change" | "technical_indicator",
    "value": number,
    "timeframe": "1m" | "5m" | "1h" | "1d" | etc (optional)
  },
  "size": number (optional, default 0.001),
  "exchange": "binance" | "bybit" (optional),
  "marketType": "spot" | "futures" (optional)
}

Examples:
- "when BTC goes above 100k go long" → {"symbol": "BTC", "action": "long", "condition": {"type": "price_above", "value": 100000}}
- "if ETH drops 5% go short" → {"symbol": "ETH", "action": "short", "condition": {"type": "percentage_change", "value": -5}}

Only return the JSON object, no other text.`;

    try {
      const response = await this.sendMessage(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse strategy from Claude response');
    } catch (error) {
      throw new Error(`Strategy parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default ClaudeClient;