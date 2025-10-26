import { BaseCryptoModule, ToolDefinition } from '../base/module.js';
import { TelegramModule } from '../telegram/index.js';

interface AlphaProject {
  ticker: string;
  name: string;
  mentions: number;
  first_mention: string;
  latest_mention: string;
  chat_sources: string[];
  confidence_score: number;
  trend_direction: 'up' | 'down' | 'stable';
  keywords: string[];
}

interface EmergingPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  confidence: number;
}

export class AlphaScannerModule extends BaseCryptoModule {
  name = 'alpha';
  private telegramModule: TelegramModule | null = null;

  protected setupTools() {
    this.addTool({
      name: 'alpha_search_ticker',
      description: 'Search for a specific ticker in Telegram chats and analyze its mentions, sentiment, and momentum',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Ticker symbol to search for (e.g., BTC, ETH, DOGE)'
          },
          timeRange: {
            type: 'string',
            description: 'Time range for search and analysis',
            enum: ['1h', '6h', '24h', '7d', '30d'],
            default: '24h'
          },
          includeAnalysis: {
            type: 'boolean',
            description: 'Include momentum and sentiment analysis',
            default: true
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to analyze',
            default: 100
          }
        },
        required: ['ticker']
      },
      handler: this.searchTicker.bind(this)
    });
  }

  async initialize(): Promise<void> {
    this.setupTools();
  }

  setTelegramModule(telegramModule: TelegramModule): void {
    this.telegramModule = telegramModule;
  }

  private async searchTicker(args: any) {
    if (!this.telegramModule) {
      return {
        ticker: args.ticker,
        error: 'Telegram module not available',
        message: 'Telegram integration not initialized'
      };
    }

    try {
      const { ticker, timeRange = '24h', includeAnalysis = true, limit = 100 } = args;
      
      // Search for mentions of the ticker using multiple patterns
      const searchPatterns = [
        ticker.toUpperCase(),
        `$${ticker.toUpperCase()}`,
        ticker.toLowerCase(),
        `${ticker.toUpperCase()} token`,
        `${ticker.toUpperCase()} coin`
      ];

      const allMentions = [];
      for (const pattern of searchPatterns) {
        try {
          const results = await this.telegramModule.searchTokenMentions({ 
            tokenSymbol: pattern, 
            timeRange, 
            limit: Math.ceil(limit / searchPatterns.length) 
          });
          if (results.mentions) {
            allMentions.push(...results.mentions);
          }
    } catch (error) {
          // Continue with other patterns if one fails
          console.warn(`Failed to search for pattern ${pattern}:`, error);
        }
      }

      // Remove duplicates based on message ID or content
      const uniqueMentions = this.removeDuplicateMentions(allMentions);
      
      if (uniqueMentions.length === 0) {
      return {
          ticker: ticker.toUpperCase(),
          mentions: 0,
        timeRange,
          message: `No mentions found for ${ticker.toUpperCase()} in the last ${timeRange}`,
          analysis: null
        };
      }

      // Basic response structure
      const response: any = {
        ticker: ticker.toUpperCase(),
        mentions: uniqueMentions.length,
        timeRange,
        first_mention: uniqueMentions[0]?.timestamp,
        latest_mention: uniqueMentions[uniqueMentions.length - 1]?.timestamp,
        chat_sources: [...new Set(uniqueMentions.map(m => m.chat_title).filter(Boolean))],
        sample_messages: uniqueMentions.slice(0, 5).map(m => ({
          chat: m.chat_title,
          username: m.username,
          message: m.message_text?.substring(0, 150) + '...',
          timestamp: m.timestamp
        }))
      };

      // Add analysis if requested
      if (includeAnalysis && uniqueMentions.length > 0) {
        const momentum = this.analyzeMomentum(uniqueMentions, timeRange);
        const sentiment = this.analyzeSentiment(uniqueMentions);
        const activity = this.analyzeActivity(uniqueMentions, timeRange);

        response.analysis = {
          momentum: {
            direction: momentum.direction,
            score: momentum.score,
            growth_rate: momentum.growthRate,
            peak_activity: momentum.peakActivity,
            recent_trend: momentum.recentTrend
          },
          sentiment: {
            overall: sentiment.overall,
            positive_percentage: sentiment.positivePercentage,
            negative_percentage: sentiment.negativePercentage,
            neutral_percentage: sentiment.neutralPercentage,
            bullish_keywords: sentiment.bullishKeywords,
            bearish_keywords: sentiment.bearishKeywords
          },
          activity: {
            mentions_per_hour: activity.mentionsPerHour,
            most_active_chat: activity.mostActiveChat,
            most_active_users: activity.mostActiveUsers,
            activity_distribution: activity.activityDistribution
          }
        };
      }

      // Format text summary
      const textSummary = this.formatTickerSearchSummary(response);
      
      return {
        content: [
          {
            type: 'text',
            text: textSummary
          }
        ],
        data: response // Include structured data for programmatic access
      };
    } catch (error) {
      return {
        ticker: args.ticker,
        error: `Search failed: ${error}`,
        message: 'Error searching for ticker in Telegram'
      };
    }
  }

  // Helper methods
  private removeDuplicateMentions(mentions: any[]): any[] {
    const seen = new Set();
    return mentions.filter(mention => {
      // Create a unique key based on message content and timestamp
      const key = `${mention.message_text?.substring(0, 50)}_${mention.timestamp}_${mention.chat_title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private analyzeSentiment(mentions: any[]): {
    overall: string;
    positivePercentage: number;
    negativePercentage: number;
    neutralPercentage: number;
    bullishKeywords: string[];
    bearishKeywords: string[];
  } {
    const bullishKeywords = [
      'moon', 'bullish', 'pump', 'rocket', 'buy', 'hold', 'hodl',
      'gem', 'undervalued', 'potential', 'breakout', 'rally',
      'strong', 'support', 'accumulate', 'long', 'calls'
    ];
    
    const bearishKeywords = [
      'dump', 'bearish', 'sell', 'crash', 'drop', 'fall',
      'overvalued', 'bubble', 'short', 'puts', 'resistance',
      'weak', 'decline', 'correction', 'exit', 'avoid'
    ];

    let positive = 0;
    let negative = 0;
    let neutral = 0;
    const foundBullish = new Set<string>();
    const foundBearish = new Set<string>();

    mentions.forEach(mention => {
      const text = mention.message_text?.toLowerCase() || '';
      let sentiment = 0;

      bullishKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          sentiment += 1;
          foundBullish.add(keyword);
        }
      });

      bearishKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          sentiment -= 1;
          foundBearish.add(keyword);
        }
      });

      if (sentiment > 0) positive++;
      else if (sentiment < 0) negative++;
      else neutral++;
    });

    const total = mentions.length;
    const positivePercentage = (positive / total) * 100;
    const negativePercentage = (negative / total) * 100;
    const neutralPercentage = (neutral / total) * 100;

    let overall = 'neutral';
    if (positivePercentage > negativePercentage + 10) overall = 'bullish';
    else if (negativePercentage > positivePercentage + 10) overall = 'bearish';
      
      return {
      overall,
      positivePercentage,
      negativePercentage,
      neutralPercentage,
      bullishKeywords: Array.from(foundBullish),
      bearishKeywords: Array.from(foundBearish)
    };
  }

  private analyzeActivity(mentions: any[], timeRange: string): {
    mentionsPerHour: number;
    mostActiveChat: string;
    mostActiveUsers: string[];
    activityDistribution: { [hour: string]: number };
  } {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const hours = timeRangeMs / (60 * 60 * 1000);
    const mentionsPerHour = mentions.length / hours;

    // Chat activity
    const chatCounts = new Map<string, number>();
    mentions.forEach(mention => {
      const chat = mention.chat_title || 'Unknown';
      chatCounts.set(chat, (chatCounts.get(chat) || 0) + 1);
    });
    const mostActiveChat = Array.from(chatCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    // User activity
    const userCounts = new Map<string, number>();
    mentions.forEach(mention => {
      const user = mention.username || 'Anonymous';
      userCounts.set(user, (userCounts.get(user) || 0) + 1);
    });
    const mostActiveUsers = Array.from(userCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user]) => user);

    // Hourly distribution
    const activityDistribution: { [hour: string]: number } = {};
    mentions.forEach(mention => {
      const hour = new Date(mention.timestamp).getHours();
      const hourKey = `${hour}:00`;
      activityDistribution[hourKey] = (activityDistribution[hourKey] || 0) + 1;
    });

    return {
      mentionsPerHour,
      mostActiveChat,
      mostActiveUsers,
      activityDistribution
    };
  }

  private formatTickerSearchSummary(data: any): string {
    let summary = `[SEARCH] Ticker Search Results for ${data.ticker}\n`;
    summary += ` Time Range: ${data.timeRange}\n`;
    summary += `[CHAT] Total Mentions: ${data.mentions}\n\n`;

    if (data.mentions === 0) {
      summary += `[ERROR] No mentions found for ${data.ticker} in the specified time range.\n`;
      return summary;
    }

    // Basic info
    summary += `[DATA] OVERVIEW\n`;
    summary += `• First Mention: ${new Date(data.first_mention).toLocaleString()}\n`;
    summary += `• Latest Mention: ${new Date(data.latest_mention).toLocaleString()}\n`;
    summary += `• Chat Sources: ${data.chat_sources.length} (${data.chat_sources.slice(0, 3).join(', ')}${data.chat_sources.length > 3 ? '...' : ''})\n\n`;

    // Analysis section
    if (data.analysis) {
      const { momentum, sentiment, activity } = data.analysis;
      
      summary += `UP: MOMENTUM ANALYSIS\n`;
      summary += `• Direction: ${momentum.direction.toUpperCase()} ${this.getMomentumEmoji(momentum.direction)}\n`;
      summary += `• Score: ${momentum.score.toFixed(2)}\n`;
      summary += `• Growth Rate: ${momentum.growth_rate.toFixed(2)} mentions/day\n`;
      summary += `• Peak Activity: ${momentum.peak_activity}\n`;
      summary += `• Recent Trend: ${momentum.recent_trend}\n\n`;

      summary += `💭 SENTIMENT ANALYSIS\n`;
      summary += `• Overall: ${sentiment.overall.toUpperCase()} ${this.getSentimentEmoji(sentiment.overall)}\n`;
      summary += `• Bullish: ${sentiment.positive_percentage.toFixed(1)}%\n`;
      summary += `• Bearish: ${sentiment.negative_percentage.toFixed(1)}%\n`;
      summary += `• Neutral: ${sentiment.neutral_percentage.toFixed(1)}%\n`;
      if (sentiment.bullish_keywords.length > 0) {
        summary += `• Bullish Keywords: ${sentiment.bullish_keywords.slice(0, 5).join(', ')}\n`;
      }
      if (sentiment.bearish_keywords.length > 0) {
        summary += `• Bearish Keywords: ${sentiment.bearish_keywords.slice(0, 5).join(', ')}\n`;
      }
      summary += `\n`;

      summary += `LIGHTNING: ACTIVITY ANALYSIS\n`;
      summary += `• Mentions/Hour: ${activity.mentions_per_hour.toFixed(2)}\n`;
      summary += `• Most Active Chat: ${activity.most_active_chat}\n`;
      summary += `• Top Users: ${activity.most_active_users.slice(0, 3).join(', ')}\n\n`;
    }

    // Sample messages
    if (data.sample_messages && data.sample_messages.length > 0) {
      summary += `[CHAT] SAMPLE MESSAGES\n`;
      data.sample_messages.forEach((msg: any, i: number) => {
        summary += `${i + 1}. [${msg.chat}] @${msg.username}: ${msg.message}\n`;
      });
    }

    return summary;
  }

  private getMomentumEmoji(direction: string): string {
    switch (direction) {
      case 'up': return 'LAUNCH:';
      case 'down': return 'DOWN:';
      default: return '➡';
    }
  }

  private getSentimentEmoji(sentiment: string): string {
    switch (sentiment) {
      case 'bullish': return '🟢';
      case 'bearish': return '🔴';
      default: return '🟡';
    }
  }

  private analyzeMomentum(mentions: any[], timeRange: string): { direction: string; score: number; growthRate: number; peakActivity: string; recentTrend: string } {
    // Sort mentions by timestamp
    const sortedMentions = mentions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Calculate growth rate
    const totalMentions = mentions.length;
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const growthRate = totalMentions / (timeRangeMs / (24 * 60 * 60 * 1000)); // mentions per day
    
    // Find peak activity period
    const hourlyMentions = new Map<number, number>();
    sortedMentions.forEach(mention => {
      const hour = new Date(mention.timestamp).getHours();
      hourlyMentions.set(hour, (hourlyMentions.get(hour) || 0) + 1);
    });
    
    const peakHour = Array.from(hourlyMentions.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
    
    // Analyze recent trend
    const recentMentions = sortedMentions.slice(-Math.floor(sortedMentions.length / 3));
    const olderMentions = sortedMentions.slice(0, Math.floor(sortedMentions.length / 3));
    
    const recentRate = recentMentions.length / (timeRangeMs / (24 * 60 * 60 * 1000));
    const olderRate = olderMentions.length / (timeRangeMs / (24 * 60 * 60 * 1000));
    
    let direction = 'stable';
    let score = 0;
    
    if (recentRate > olderRate * 1.5) {
      direction = 'up';
      score = (recentRate - olderRate) / olderRate;
    } else if (recentRate < olderRate * 0.5) {
      direction = 'down';
      score = (olderRate - recentRate) / olderRate;
    } else {
      direction = 'stable';
      score = 0;
    }
    
    return {
      direction,
      score: Math.abs(score),
      growthRate,
      peakActivity: `${peakHour}:00`,
      recentTrend: recentRate > olderRate ? 'increasing' : 'decreasing'
    };
  }

  private getTimeRangeMs(timeRange: string): number {
    const now = Date.now();
    switch (timeRange) {
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }
}
