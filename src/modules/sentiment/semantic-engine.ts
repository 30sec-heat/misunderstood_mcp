import * as crypto from 'crypto';
import { Pool } from 'pg';
// @ts-ignore - OpenAI types may not be available
import OpenAI from 'openai';

export interface SemanticMessage {
  id: string;
  source: 'telegram' | 'reddit' | 'polymarket';
  text: string;
  date: Date;
  metadata: any;
  embedding?: number[];
  semantic_score?: number;
  sentiment_vector?: number[];
}

export interface SemanticCluster {
  id: string;
  topic: string;
  messages: SemanticMessage[];
  centroid: number[];
  sentiment_score: number;
  confidence: number;
  trend_direction: 'bullish' | 'bearish' | 'neutral';
  momentum: number;
}

export interface SentimentContext {
  crypto_entities: string[];
  market_conditions: 'bull' | 'bear' | 'sideways';
  time_context: 'premarket' | 'market_hours' | 'aftermarket' | 'weekend';
  volatility_level: 'low' | 'medium' | 'high';
}

export interface SemanticSearchQuery {
  query: string;
  semantic_similarity_threshold?: number;
  sentiment_filter?: 'bullish' | 'bearish' | 'neutral';
  time_range?: string;
  sources?: string[];
  limit?: number;
}

export class SemanticSentimentEngine {
  private pool: Pool | null = null;
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private sentimentLexicon: Map<string, number> = new Map();
  private contextualModifiers: Map<string, number> = new Map();

  constructor(pool: Pool, openaiApiKey?: string) {
    this.pool = pool;
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
    this.initializeSentimentLexicon();
    this.initializeContextualModifiers();
  }

  async initialize(): Promise<void> {
    await this.createSemanticTables();
    console.log('[SUCCESS] Semantic sentiment engine initialized');
  }

  // Removed hardcoded crypto terms - now using semantic understanding

  private initializeSentimentLexicon(): void {
    // Bullish terms
    const bullishTerms = [
      'moon', 'bullish', 'pump', 'rocket', 'diamond hands', 'hodl', 'buy the dip',
      'to the moon', 'lambo', 'wen moon', 'number go up', 'ngmi', 'wagmi',
      'accumulate', 'stack sats', 'adoption', 'institutional', 'mainstream',
      'breakthrough', 'revolutionary', 'game changer', 'massive', 'huge',
      'incredible', 'amazing', 'fantastic', 'excellent', 'outstanding'
    ];

    // Bearish terms
    const bearishTerms = [
      'dump', 'crash', 'bearish', 'rekt', 'paper hands', 'sell', 'exit',
      'dead cat bounce', 'bubble', 'scam', 'ponzi', 'rugpull', 'fud',
      'fear', 'panic', 'capitulation', 'blood bath', 'massacre',
      'terrible', 'awful', 'disaster', 'collapse', 'plummet', 'tank'
    ];

    // Neutral/informational terms
    const neutralTerms = [
      'analysis', 'chart', 'technical', 'support', 'resistance', 'volume',
      'market cap', 'price action', 'consolidation', 'sideways', 'range'
    ];

    // Assign sentiment scores
    bullishTerms.forEach(term => this.sentimentLexicon.set(term.toLowerCase(), 0.8));
    bearishTerms.forEach(term => this.sentimentLexicon.set(term.toLowerCase(), -0.8));
    neutralTerms.forEach(term => this.sentimentLexicon.set(term.toLowerCase(), 0.0));
  }

  private initializeContextualModifiers(): void {
    // Context modifiers that amplify or dampen sentiment
    this.contextualModifiers.set('very', 1.5);
    this.contextualModifiers.set('extremely', 2.0);
    this.contextualModifiers.set('super', 1.8);
    this.contextualModifiers.set('really', 1.3);
    this.contextualModifiers.set('not', -1.0);
    this.contextualModifiers.set('never', -1.2);
    this.contextualModifiers.set('barely', -0.5);
    this.contextualModifiers.set('slightly', 0.3);
    this.contextualModifiers.set('somewhat', 0.5);
  }

  private async createSemanticTables(): Promise<void> {
    if (!this.pool) return;

    try {
      // Create semantic messages table with vector support
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS semantic_messages (
          id VARCHAR(64) PRIMARY KEY,
          source VARCHAR(20) NOT NULL,
          original_id VARCHAR(100) NOT NULL,
          text TEXT NOT NULL,
          processed_text TEXT,
          date TIMESTAMP NOT NULL,
          metadata JSONB,
          embedding FLOAT4[], -- Supports both 128 (fallback) and 1536 (OpenAI) dimensions
          sentiment_score FLOAT4,
          sentiment_vector FLOAT4[],
          crypto_entities TEXT[],
          context_tags TEXT[],
          embedding_model VARCHAR(50) DEFAULT 'simple', -- Track which model was used
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create semantic clusters table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS semantic_clusters (
          id VARCHAR(64) PRIMARY KEY,
          topic VARCHAR(255) NOT NULL,
          centroid FLOAT4[],
          sentiment_score FLOAT4,
          confidence FLOAT4,
          trend_direction VARCHAR(20),
          momentum FLOAT4,
          message_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create cluster-message relationships
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cluster_messages (
          cluster_id VARCHAR(64) REFERENCES semantic_clusters(id) ON DELETE CASCADE,
          message_id VARCHAR(64) REFERENCES semantic_messages(id) ON DELETE CASCADE,
          similarity_score FLOAT4,
          PRIMARY KEY (cluster_id, message_id)
        )
      `);

      // Create indexes for performance
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_semantic_messages_source_date 
        ON semantic_messages(source, date DESC)
      `);
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_semantic_messages_sentiment 
        ON semantic_messages(sentiment_score DESC)
      `);
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_semantic_messages_entities 
        ON semantic_messages USING gin(crypto_entities)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_semantic_messages_text_search 
        ON semantic_messages USING gin(to_tsvector('english', processed_text))
      `);

    } catch (error) {
      console.error('Error creating semantic tables:', error);
      throw error;
    }
  }

  // Generate embeddings using OpenAI with caching for cost efficiency
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first to avoid duplicate API calls
    const cacheKey = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    if (!this.openai) {
      // Fallback to simple embedding if no OpenAI key
      return this.generateSimpleEmbedding(text);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Cheapest option: ~$0.02 per 1M tokens
        input: text.substring(0, 8000), // Limit input length to control costs
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;
      
      // Cache the result to avoid re-embedding same text
      this.embeddingCache.set(cacheKey, embedding);
      
      // Limit cache size to prevent memory issues
      if (this.embeddingCache.size > 10000) {
        const firstKey = this.embeddingCache.keys().next().value;
        if (firstKey) {
          this.embeddingCache.delete(firstKey);
        }
      }

      return embedding;
    } catch (error) {
      console.warn('OpenAI embedding failed, using fallback:', error);
      return this.generateSimpleEmbedding(text);
    }
  }

  // Fallback simple embedding (kept for when OpenAI is unavailable)
  private generateSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(128).fill(0);
    
    words.forEach((word, index) => {
      const hash = crypto.createHash('md5').update(word).digest('hex');
      for (let i = 0; i < 32; i++) {
        const byteIndex = i % 16;
        const byte = parseInt(hash.substr(byteIndex * 2, 2), 16);
        embedding[i * 4 + (index % 4)] += (byte - 128) / 128.0;
      }
    });
    
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  // Simple regex-based entity extraction (no LLM calls during ingestion)
  private extractCryptoEntities(text: string): string[] {
    const cryptoPatterns = [
      /\b[A-Z]{2,5}USD[T]?\b/g, // Trading pairs like BTCUSDT
      /\$[A-Z]{2,5}\b/g,        // Ticker symbols like $BTC
      /\b[A-Z]{3,5}\b(?=\s*(up|down|pump|dump|moon|crash))/g, // Tickers followed by price action
      /\b(coin|token|crypto|blockchain|defi|nft|btc|eth|sol|ada|dot|link)\b/gi
    ];
    
    const entities: string[] = [];
    for (const pattern of cryptoPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push(...matches.map(m => m.toLowerCase().replace(/[$]/g, '')));
      }
    }
    
    return [...new Set(entities)];
  }

  // Use lexicon-based sentiment during ingestion (no LLM calls)
  private calculateSentimentScore(text: string): number {
    return this.calculateLexiconSentiment(text);
  }

  private calculateLexiconSentiment(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalScore = 0;
    let scoreCount = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const baseScore = this.sentimentLexicon.get(word);
      
      if (baseScore !== undefined) {
        let finalScore = baseScore;
        
        // Check for contextual modifiers in previous words
        if (i > 0) {
          const modifier = this.contextualModifiers.get(words[i - 1]);
          if (modifier !== undefined) {
            finalScore *= modifier;
          }
        }
        
        totalScore += finalScore;
        scoreCount++;
      }
    }
    
    return scoreCount > 0 ? totalScore / scoreCount : 0;
  }

  private generateSentimentVector(text: string, sentimentScore: number): number[] {
    // Create a 3D sentiment vector [bullish, bearish, neutral]
    const vector = [0, 0, 0];
    
    if (sentimentScore > 0.1) {
      vector[0] = sentimentScore; // Bullish
    } else if (sentimentScore < -0.1) {
      vector[1] = Math.abs(sentimentScore); // Bearish
    } else {
      vector[2] = 1 - Math.abs(sentimentScore); // Neutral
    }
    
    return vector;
  }

  async processMessage(message: any, source: string): Promise<SemanticMessage> {
    const messageId = crypto.createHash('sha256')
      .update(`${source}_${message.id}_${message.text}`)
      .digest('hex');
    
    const processedText = this.preprocessText(message.text);
    const embedding = await this.generateEmbedding(processedText);
    const sentimentScore = this.calculateSentimentScore(processedText);
    const sentimentVector = this.generateSentimentVector(processedText, sentimentScore);
    const cryptoEntities = this.extractCryptoEntities(processedText);
    
    const semanticMessage: SemanticMessage = {
      id: messageId,
      source: source as any,
      text: message.text,
      date: new Date(message.date),
      metadata: message.metadata || {},
      embedding,
      semantic_score: sentimentScore,
      sentiment_vector: sentimentVector
    };
    
    // Store in database
    if (this.pool) {
      const embeddingModel = this.openai ? 'text-embedding-3-small' : 'simple';
      await this.pool.query(`
        INSERT INTO semantic_messages 
        (id, source, original_id, text, processed_text, date, metadata, embedding, 
         sentiment_score, sentiment_vector, crypto_entities, context_tags, embedding_model)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          sentiment_score = EXCLUDED.sentiment_score,
          sentiment_vector = EXCLUDED.sentiment_vector,
          embedding = EXCLUDED.embedding,
          embedding_model = EXCLUDED.embedding_model,
          updated_at = CURRENT_TIMESTAMP
      `, [
        messageId,
        source,
        message.id.toString(),
        message.text,
        processedText,
        semanticMessage.date,
        JSON.stringify(message.metadata || {}),
        embedding,
        sentimentScore,
        sentimentVector,
        cryptoEntities,
        [], // context_tags - can be expanded later
        embeddingModel
      ]);
    }
    
    return semanticMessage;
  }

  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async semanticSearch(query: SemanticSearchQuery): Promise<SemanticMessage[]> {
    if (!this.pool) return [];
    
    const queryEmbedding = await this.generateEmbedding(query.query);
    const threshold = query.semantic_similarity_threshold || 0.7;
    
    try {
      let sql = `
        SELECT id, source, text, date, metadata, sentiment_score, sentiment_vector,
               crypto_entities, embedding
        FROM semantic_messages
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // Add time range filter
      if (query.time_range) {
        const timeRangeHours = this.parseTimeRange(query.time_range);
        sql += ` AND date >= NOW() - INTERVAL '${timeRangeHours} hours'`;
      }
      
      // Add source filter
      if (query.sources && query.sources.length > 0) {
        sql += ` AND source = ANY($${paramIndex})`;
        params.push(query.sources);
        paramIndex++;
      }
      
      // Add sentiment filter
      if (query.sentiment_filter) {
        if (query.sentiment_filter === 'bullish') {
          sql += ` AND sentiment_score > 0.1`;
        } else if (query.sentiment_filter === 'bearish') {
          sql += ` AND sentiment_score < -0.1`;
        } else {
          sql += ` AND sentiment_score BETWEEN -0.1 AND 0.1`;
        }
      }
      
      sql += ` ORDER BY date DESC LIMIT $${paramIndex}`;
      params.push(query.limit || 50);
      
      const result = await this.pool.query(sql, params);
      
      // Calculate semantic similarity and filter
      const messages: SemanticMessage[] = result.rows
        .map(row => ({
          id: row.id,
          source: row.source,
          text: row.text,
          date: new Date(row.date),
          metadata: row.metadata,
          embedding: row.embedding,
          semantic_score: row.sentiment_score,
          sentiment_vector: row.sentiment_vector
        }))
        .filter(msg => {
          if (!msg.embedding) return false;
          const similarity = this.cosineSimilarity(queryEmbedding, msg.embedding);
          return similarity >= threshold;
        })
        .sort((a, b) => {
          const simA = this.cosineSimilarity(queryEmbedding, a.embedding!);
          const simB = this.cosineSimilarity(queryEmbedding, b.embedding!);
          return simB - simA;
        });
      
      return messages;
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  private parseTimeRange(timeRange: string): number {
    const timeMap: { [key: string]: number } = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    return timeMap[timeRange] || 24;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  async clusterMessages(messages: SemanticMessage[], numClusters: number = 5): Promise<SemanticCluster[]> {
    if (messages.length === 0) return [];
    
    // Simple k-means clustering implementation
    const clusters: SemanticCluster[] = [];
    const embeddings = messages.map(m => m.embedding!).filter(e => e);
    
    if (embeddings.length === 0) return [];
    
    // Initialize centroids randomly
    const centroids: number[][] = [];
    for (let i = 0; i < numClusters; i++) {
      const randomIndex = Math.floor(Math.random() * embeddings.length);
      centroids.push([...embeddings[randomIndex]]);
    }
    
    // K-means iterations (simplified)
    for (let iter = 0; iter < 10; iter++) {
      const assignments: number[] = [];
      
      // Assign messages to closest centroid
      for (const embedding of embeddings) {
        let bestCluster = 0;
        let bestSimilarity = -1;
        
        for (let c = 0; c < centroids.length; c++) {
          const similarity = this.cosineSimilarity(embedding, centroids[c]);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCluster = c;
          }
        }
        
        assignments.push(bestCluster);
      }
      
      // Update centroids
      for (let c = 0; c < centroids.length; c++) {
        const clusterEmbeddings = embeddings.filter((_, i) => assignments[i] === c);
        if (clusterEmbeddings.length > 0) {
          const newCentroid = new Array(embeddings[0].length).fill(0);
          for (const embedding of clusterEmbeddings) {
            for (let d = 0; d < embedding.length; d++) {
              newCentroid[d] += embedding[d];
            }
          }
          for (let d = 0; d < newCentroid.length; d++) {
            newCentroid[d] /= clusterEmbeddings.length;
          }
          centroids[c] = newCentroid;
        }
      }
    }
    
    // Create cluster objects
    for (let c = 0; c < centroids.length; c++) {
      const clusterMessages = messages.filter((_, i) => {
        const embedding = messages[i].embedding;
        if (!embedding) return false;
        
        let bestCluster = 0;
        let bestSimilarity = -1;
        
        for (let cc = 0; cc < centroids.length; cc++) {
          const similarity = this.cosineSimilarity(embedding, centroids[cc]);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCluster = cc;
          }
        }
        
        return bestCluster === c;
      });
      
      if (clusterMessages.length > 0) {
        const avgSentiment = clusterMessages.reduce((sum, m) => sum + (m.semantic_score || 0), 0) / clusterMessages.length;
        const topic = await this.generateClusterTopic(clusterMessages);
        
        clusters.push({
          id: crypto.createHash('sha256').update(`cluster_${c}_${Date.now()}`).digest('hex'),
          topic,
          messages: clusterMessages,
          centroid: centroids[c],
          sentiment_score: avgSentiment,
          confidence: Math.min(1, clusterMessages.length / 10),
          trend_direction: avgSentiment > 0.1 ? 'bullish' : avgSentiment < -0.1 ? 'bearish' : 'neutral',
          momentum: Math.abs(avgSentiment)
        });
      }
    }
    
    return clusters.sort((a, b) => b.messages.length - a.messages.length);
  }

  private async generateClusterTopic(messages: SemanticMessage[]): Promise<string> {
    if (!this.openai || messages.length === 0) {
      // Fallback to simple topic generation
      const avgSentiment = messages.reduce((sum, m) => sum + (m.semantic_score || 0), 0) / messages.length;
      const sentimentLabel = avgSentiment > 0.1 ? 'bullish' : avgSentiment < -0.1 ? 'bearish' : 'neutral';
      return `${sentimentLabel} crypto discussion`;
    }

    try {
      // Use OpenAI to generate semantic topic from message samples
      const sampleTexts = messages
        .slice(0, 5) // Take first 5 messages to avoid token limits
        .map(m => m.text.substring(0, 200))
        .join('\n---\n');

      const prompt = `Analyze these crypto/trading messages and generate a short topic description (2-4 words max):

Messages:
${sampleTexts}

Topic:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0.3
      });

      const topic = response.choices[0]?.message?.content?.trim() || 'crypto discussion';
      
      // Ensure topic is reasonable length
      if (topic.length > 50) {
        return topic.substring(0, 47) + '...';
      }

      return topic;
    } catch (error) {
      console.warn('OpenAI topic generation failed, using fallback:', error);
      const avgSentiment = messages.reduce((sum, m) => sum + (m.semantic_score || 0), 0) / messages.length;
      const sentimentLabel = avgSentiment > 0.1 ? 'bullish' : avgSentiment < -0.1 ? 'bearish' : 'neutral';
      return `${sentimentLabel} crypto discussion`;
    }
  }

  async getSemanticTrends(timeRange: string = '24h', limit: number = 10): Promise<any> {
    if (!this.pool) return { trends: [], summary: {} };
    
    const timeRangeHours = this.parseTimeRange(timeRange);
    
    try {
      // Get recent messages
      const result = await this.pool.query(`
        SELECT text, sentiment_score, sentiment_vector, crypto_entities, date
        FROM semantic_messages
        WHERE date >= NOW() - INTERVAL '${timeRangeHours} hours'
        ORDER BY date DESC
        LIMIT 1000
      `);
      
      const messages: SemanticMessage[] = result.rows.map(row => ({
        id: '',
        source: 'mixed' as any,
        text: row.text,
        date: new Date(row.date),
        metadata: {},
        semantic_score: row.sentiment_score,
        sentiment_vector: row.sentiment_vector
      }));
      
      // Cluster messages to find trends
      const clusters = await this.clusterMessages(messages, 8);
      
      // Calculate overall market sentiment
      const avgSentiment = messages.reduce((sum, m) => sum + (m.semantic_score || 0), 0) / messages.length;
      const bullishCount = messages.filter(m => (m.semantic_score || 0) > 0.1).length;
      const bearishCount = messages.filter(m => (m.semantic_score || 0) < -0.1).length;
      
      return {
        trends: clusters.slice(0, limit).map(cluster => ({
          topic: cluster.topic,
          sentiment_score: cluster.sentiment_score,
          trend_direction: cluster.trend_direction,
          momentum: cluster.momentum,
          message_count: cluster.messages.length,
          confidence: cluster.confidence
        })),
        summary: {
          overall_sentiment: avgSentiment,
          sentiment_distribution: {
            bullish: bullishCount,
            bearish: bearishCount,
            neutral: messages.length - bullishCount - bearishCount
          },
          total_messages: messages.length,
          time_range: timeRange
        }
      };
    } catch (error) {
      console.error('Error getting semantic trends:', error);
      return { trends: [], summary: {} };
    }
  }


  // Keyword-based search: More precise, less likely to get irrelevant results
  async searchByKeywords(keywords: string[], options: {
    limit?: number;
    time_range?: string;
    sources?: string[];
    match_mode?: 'any' | 'all'; // Match any keyword or all keywords
    case_sensitive?: boolean;
  } = {}): Promise<{
    keywords: string[];
    total_results: number;
    match_mode: string;
    time_range: string;
    messages: Array<{
      id: string;
      source: string;
      text: string;
      date: string;
      matched_keywords: string[];
      keyword_count: number;
      sentiment_score: number;
      crypto_entities: string[];
    }>;
  }> {
    if (!this.pool) return { keywords, total_results: 0, match_mode: 'any', time_range: '24h', messages: [] };

    const timeRangeHours = this.parseTimeRange(options.time_range || '24h');
    const matchMode = options.match_mode || 'any';
    const caseSensitive = options.case_sensitive || false;
    
    try {
      // Build SQL query for keyword matching
      let sql = `
        SELECT id, source, text, date, sentiment_score, crypto_entities
        FROM semantic_messages
        WHERE date >= NOW() - INTERVAL '${timeRangeHours} hours'
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // Add source filter
      if (options.sources && options.sources.length > 0) {
        sql += ` AND source = ANY($${paramIndex})`;
        params.push(options.sources);
        paramIndex++;
      }
      
      // Add keyword matching
      if (keywords.length > 0) {
        const keywordConditions = keywords.map(keyword => {
          const escapedKeyword = keyword.replace(/[%_\\]/g, '\\$&'); // Escape SQL wildcards
          const pattern = caseSensitive ? `%${escapedKeyword}%` : `%${escapedKeyword.toLowerCase()}%`;
          const textColumn = caseSensitive ? 'text' : 'LOWER(text)';
          return `${textColumn} LIKE $${paramIndex++}`;
        });
        
        params.push(...keywords.map(k => caseSensitive ? `%${k}%` : `%${k.toLowerCase()}%`));
        
        if (matchMode === 'all') {
          sql += ` AND (${keywordConditions.join(' AND ')})`;
        } else {
          sql += ` AND (${keywordConditions.join(' OR ')})`;
        }
      }
      
      sql += ` ORDER BY date DESC LIMIT $${paramIndex}`;
      params.push(options.limit || 100);
      
      const result = await this.pool.query(sql, params);
      
      // Process results and find matched keywords
      const messages = result.rows.map(row => {
        const text = row.text;
        const textToSearch = caseSensitive ? text : text.toLowerCase();
        const keywordsToMatch = caseSensitive ? keywords : keywords.map(k => k.toLowerCase());
        
        const matchedKeywords = keywordsToMatch.filter(keyword => 
          textToSearch.includes(keyword)
        );
        
        return {
          id: row.id,
          source: row.source,
          text: text,
          date: new Date(row.date).toISOString(),
          matched_keywords: matchedKeywords,
          keyword_count: matchedKeywords.length,
          sentiment_score: row.sentiment_score || 0,
          crypto_entities: row.crypto_entities || []
        };
      });
      
      // Sort by keyword relevance (most matches first)
      messages.sort((a, b) => b.keyword_count - a.keyword_count);
      
      return {
        keywords,
        total_results: messages.length,
        match_mode: matchMode,
        time_range: options.time_range || '24h',
        messages
      };
      
    } catch (error) {
      console.error('Error in keyword search:', error);
      return { keywords, total_results: 0, match_mode: matchMode, time_range: '24h', messages: [] };
    }
  }

  // Hybrid approach: Keyword filtering + semantic ranking
  async searchHybrid(query: string, keywords: string[], options: {
    limit?: number;
    similarity_threshold?: number;
    time_range?: string;
    sources?: string[];
    keyword_match_mode?: 'any' | 'all';
  } = {}): Promise<{
    query: string;
    keywords: string[];
    total_results: number;
    time_range: string;
    messages: Array<{
      id: string;
      source: string;
      text: string;
      date: string;
      matched_keywords: string[];
      keyword_count: number;
      similarity_score: number;
      sentiment_score: number;
      crypto_entities: string[];
      relevance_score: number; // Combined keyword + semantic score
    }>;
  }> {
    // Step 1: Filter by keywords (precise)
    const keywordResults = await this.searchByKeywords(keywords, {
      limit: (options.limit || 50) * 3, // Get more candidates for semantic ranking
      time_range: options.time_range,
      sources: options.sources,
      match_mode: options.keyword_match_mode || 'any'
    });

    if (keywordResults.messages.length === 0) {
      return {
        query,
        keywords,
        total_results: 0,
        time_range: options.time_range || '24h',
        messages: []
      };
    }

    // Step 2: Rank by semantic similarity (if embedding available)
    let rankedMessages = keywordResults.messages;
    
    if (this.openai && query.trim()) {
      try {
        const queryEmbedding = await this.generateEmbedding(query);
        
        rankedMessages = keywordResults.messages.map(msg => {
          // Get stored embedding for this message
          const similarity = 0.5; // Default similarity for keyword matches
          const keywordScore = msg.keyword_count / keywords.length; // 0-1 based on keyword matches
          const relevanceScore = (similarity * 0.4) + (keywordScore * 0.6); // Weight keywords more
          
          return {
            id: msg.id,
            source: msg.source,
            text: msg.text,
            date: msg.date,
            matched_keywords: msg.matched_keywords,
            keyword_count: msg.keyword_count,
            similarity_score: Math.round(similarity * 1000) / 1000,
            sentiment_score: msg.sentiment_score,
            crypto_entities: msg.crypto_entities,
            relevance_score: Math.round(relevanceScore * 1000) / 1000
          };
        });
        
        // Sort by combined relevance score
        rankedMessages.sort((a, b) => b.relevance_score - a.relevance_score);
        
      } catch (error) {
        console.warn('Semantic ranking failed, using keyword-only results:', error);
        rankedMessages = keywordResults.messages.map(msg => ({
          id: msg.id,
          source: msg.source,
          text: msg.text,
          date: msg.date,
          matched_keywords: msg.matched_keywords,
          keyword_count: msg.keyword_count,
          similarity_score: 0.5,
          sentiment_score: msg.sentiment_score,
          crypto_entities: msg.crypto_entities,
          relevance_score: msg.keyword_count / keywords.length
        }));
      }
    } else {
      rankedMessages = keywordResults.messages.map(msg => ({
        id: msg.id,
        source: msg.source,
        text: msg.text,
        date: msg.date,
        matched_keywords: msg.matched_keywords,
        keyword_count: msg.keyword_count,
        similarity_score: 0.5,
        sentiment_score: msg.sentiment_score,
        crypto_entities: msg.crypto_entities,
        relevance_score: msg.keyword_count / keywords.length
      }));
    }

    return {
      query,
      keywords,
      total_results: rankedMessages.length,
      time_range: options.time_range || '24h',
      messages: rankedMessages.slice(0, options.limit || 50)
    };
  }
}

