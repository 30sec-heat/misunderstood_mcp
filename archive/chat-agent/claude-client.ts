/**
 * Claude API Client for Ysalis
 * Provides Claude integration with proper model management and conversation handling
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

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
   * Prompt user to select a model from available models
   */
  static async promptForModelSelection(apiKey?: string): Promise<string> {
    const client = new ClaudeClient(apiKey);
    
    try {
      console.log('\n🤖 Fetching available Claude models...');
      const models = await client.fetchAvailableModels();
      
      if (models.length === 0) {
        console.log('❌ No models available. Using default model.');
        return 'claude-3-5-sonnet-20241022';
      }
      
      console.log('\n📋 Available Claude Models:');
      models.forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.name} (${model.id})`);
        console.log(`     ${model.description}`);
        console.log(`     Cost: $${model.inputCostPer1M}/1M input, $${model.outputCostPer1M}/1M output tokens\n`);
      });
      
      // For now, return the first available model
      // In a real implementation, you'd prompt the user for input
      const selectedModel = models[0];
      console.log(`✅ Selected: ${selectedModel.name} (${selectedModel.id})`);
      return selectedModel.id;
      
    } catch (error) {
      console.log('❌ Could not fetch models. Using default.');
      return 'claude-3-5-sonnet-20241022';
    }
  }

  /**
   * Fetch available Claude models from the API
   */
  async fetchAvailableModels(): Promise<ClaudeModel[]> {
    try {
      const response = await this.client.models.list();
      
      return response.data.map(model => ({
        id: model.id,
        name: model.display_name || model.id,
        description: this.getModelDescription(model.id),
        maxTokens: this.getModelMaxTokens(model.id),
        inputCostPer1M: this.getModelInputCost(model.id),
        outputCostPer1M: this.getModelOutputCost(model.id),
      }));
    } catch (error) {
      console.warn('Could not fetch models from API, using fallback list:', error);
      return this.getFallbackModels();
    }
  }

  /**
   * Get available Claude models with current pricing and capabilities (fallback)
   */
  static getAvailableModels(): ClaudeModel[] {
    const client = new ClaudeClient();
    return client.getFallbackModels();
  }

  private getFallbackModels(): ClaudeModel[] {
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

  private getModelDescription(modelId: string): string {
    const descriptions: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'Most intelligent model, excellent for complex reasoning and coding',
      'claude-3-5-haiku-20241022': 'Fastest model, great for quick responses and simple tasks',
      'claude-3-opus-20240229': 'Most capable model for highly complex tasks',
      'claude-3-sonnet-20240229': 'Balanced performance and speed',
      'claude-3-haiku-20240307': 'Fast and cost-effective',
    };
    return descriptions[modelId] || 'Claude AI model';
  }

  private getModelMaxTokens(modelId: string): number {
    return 200000; // Most Claude models support 200k tokens
  }

  private getModelInputCost(modelId: string): number {
    const costs: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 3.00,
      'claude-3-5-haiku-20241022': 0.25,
      'claude-3-opus-20240229': 15.00,
      'claude-3-sonnet-20240229': 3.00,
      'claude-3-haiku-20240307': 0.25,
    };
    return costs[modelId] || 3.00;
  }

  private getModelOutputCost(modelId: string): number {
    const costs: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 15.00,
      'claude-3-5-haiku-20241022': 1.25,
      'claude-3-opus-20240229': 75.00,
      'claude-3-sonnet-20240229': 15.00,
      'claude-3-haiku-20240307': 1.25,
    };
    return costs[modelId] || 15.00;
  }

  /**
   * Get the default system prompt for Big John from markdown file
   */
  private getDefaultSystemPrompt(): string {
    try {
      const promptPath = path.join(process.cwd(), 'system-prompt.md');
      const promptContent = fs.readFileSync(promptPath, 'utf-8');
      
      // Remove markdown formatting for Claude API
      return promptContent
        .replace(/^# .+$/gm, '') // Remove headers
        .replace(/^## /gm, '') // Remove subheaders
        .replace(/^\- /gm, '- ') // Keep bullet points
        .replace(/^\d+\. /gm, (match) => match) // Keep numbered lists
        .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
        .trim();
    } catch (error) {
      console.warn('Could not read system-prompt.md, using fallback:', error);
      return this.getFallbackSystemPrompt();
    }
  }

  /**
   * Fallback system prompt if file cannot be read
   */
  private getFallbackSystemPrompt(): string {
    return `You are Big John, a professional AI trading agent and cryptocurrency expert. You have access to comprehensive crypto market data and trading tools through MCP (Model Context Protocol).

PERSONALITY & STYLE:
- Professional, direct, and knowledgeable
- Concise responses (avoid excessive emojis or formatting)
- Focus on actionable insights and data
- Explain complex concepts clearly
- Always mention risk management for trading advice

CAPABILITIES:
- Real-time crypto prices and market data
- Technical analysis and chart patterns  
- DeFi protocol analysis (Aave, liquidity pools, etc.)
- Social sentiment from Telegram, Reddit, Twitter
- Breaking news and market-moving events
- Trading strategy creation and automation
- On-chain data analysis (Solana, Ethereum)
- Options and derivatives data (Deribit)
- Liquidation and funding rate monitoring

RESPONSE GUIDELINES:
1. Give direct, helpful answers
2. Use MCP tools when current data is needed
3. Provide specific, actionable advice when appropriate
4. Always include "This is not financial advice" for trading suggestions
5. Keep responses focused and professional

Respond naturally but stay focused on crypto/trading topics. Avoid overly casual language or excessive formatting.`;
  }

  /**
   * Set a custom system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Reset to default system prompt
   */
  resetToDefaultPrompt(): void {
    this.systemPrompt = this.getDefaultSystemPrompt();
  }

  /**
   * Reload system prompt from file
   */
  reloadSystemPrompt(): void {
    this.systemPrompt = this.getDefaultSystemPrompt();
  }

  /**
   * Get current system prompt
   */
  getCurrentPrompt(): string {
    return this.systemPrompt;
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
    conversationHistory: ConversationMessage[] = [],
    enableMCP: boolean = false
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
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          return 'I need an Anthropic API key to respond. Please set ANTHROPIC_API_KEY in your environment or use /set ANTHROPIC_API_KEY your-key-here';
        }
        if (error.message.includes('not_found_error') || error.message.includes('404')) {
          return 'The Claude model is not available. This might be due to API key permissions or model access. Please check your Anthropic API key has access to Claude models.';
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