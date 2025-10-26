import * as crypto from 'crypto';
import { Pool } from 'pg';
// @ts-ignore - OpenAI types may not be available
import OpenAI from 'openai';

export interface KnowledgeDocument {
  id: string;
  filename: string;
  filepath: string;
  content: string;
  metadata: {
    fileType: string;
    size: number;
    lastModified: Date;
    headers?: string[];
    rowCount?: number;
    encoding?: string;
  };
  chunks: KnowledgeChunk[];
  embedding?: number[];
  indexed_at: Date;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  start_position: number;
  end_position: number;
  metadata?: any;
  embedding?: number[];
}

export interface SemanticSearchQuery {
  query: string;
  semantic_similarity_threshold?: number;
  file_type_filter?: string;
  filename_filter?: string;
  time_range?: string;
  limit?: number;
}

export interface SemanticSearchResult {
  document: KnowledgeDocument;
  chunk: KnowledgeChunk;
  similarity_score: number;
  relevance_score: number;
  matched_keywords?: string[];
}

export class SemanticKnowledgeEngine {
  private pool: Pool | null = null;
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(pool: Pool, openaiApiKey?: string) {
    this.pool = pool;
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  async initialize(): Promise<void> {
    await this.createSemanticTables();
    console.log('[SUCCESS] Semantic knowledge engine initialized');
  }

  private async createSemanticTables(): Promise<void> {
    if (!this.pool) return;

    try {
      // Add embedding columns to existing tables
      await this.pool.query(`
        ALTER TABLE knowledge_documents 
        ADD COLUMN IF NOT EXISTS embedding FLOAT4[],
        ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'simple'
      `);

      await this.pool.query(`
        ALTER TABLE knowledge_chunks 
        ADD COLUMN IF NOT EXISTS embedding FLOAT4[],
        ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'simple'
      `);

      // Create indexes for vector similarity (if using pgvector extension)
      // Note: This requires pgvector extension to be installed
      try {
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
          ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
        `);
      } catch (error) {
        console.warn('Vector index creation failed (pgvector not available):', error.message);
      }

    } catch (error) {
      console.error('Error creating semantic knowledge tables:', error);
      throw error;
    }
  }

  // Generate embeddings using OpenAI with caching
  private async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    if (!this.openai) {
      return this.generateSimpleEmbedding(text);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000),
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;
      
      this.embeddingCache.set(cacheKey, embedding);
      
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

  // Fallback simple embedding
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

  // Process and embed a document chunk
  async processChunk(chunk: KnowledgeChunk): Promise<void> {
    if (!this.pool) return;

    const embedding = await this.generateEmbedding(chunk.content);
    const embeddingModel = this.openai ? 'text-embedding-3-small' : 'simple';

    try {
      await this.pool.query(`
        UPDATE knowledge_chunks 
        SET embedding = $1, embedding_model = $2
        WHERE id = $3
      `, [embedding, embeddingModel, chunk.id]);
    } catch (error) {
      console.error('Error updating chunk embedding:', error);
    }
  }

  // Process all chunks in a document
  async processDocument(document: KnowledgeDocument): Promise<void> {
    if (!this.pool) return;

    // Process document-level embedding
    const docEmbedding = await this.generateEmbedding(document.content.substring(0, 4000));
    const embeddingModel = this.openai ? 'text-embedding-3-small' : 'simple';

    try {
      await this.pool.query(`
        UPDATE knowledge_documents 
        SET embedding = $1, embedding_model = $2
        WHERE id = $3
      `, [docEmbedding, embeddingModel, document.id]);

      // Process all chunks
      for (const chunk of document.chunks) {
        await this.processChunk(chunk);
      }
    } catch (error) {
      console.error('Error processing document embeddings:', error);
    }
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

  // Semantic search through knowledge base
  async semanticSearch(query: SemanticSearchQuery): Promise<SemanticSearchResult[]> {
    if (!this.pool) return [];
    
    const queryEmbedding = await this.generateEmbedding(query.query);
    const threshold = query.semantic_similarity_threshold || 0.6;
    
    try {
      let sql = `
        SELECT 
          d.id, d.filename, d.filepath, d.content, d.metadata as doc_metadata, d.indexed_at,
          c.id as chunk_id, c.content as chunk_content, c.chunk_index, 
          c.start_position, c.end_position, c.metadata as chunk_metadata, c.embedding
        FROM knowledge_documents d
        JOIN knowledge_chunks c ON d.id = c.document_id
        WHERE c.embedding IS NOT NULL
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // Add file type filter
      if (query.file_type_filter) {
        sql += ` AND d.metadata->>'fileType' = $${paramIndex}`;
        params.push(query.file_type_filter);
        paramIndex++;
      }
      
      // Add filename filter
      if (query.filename_filter) {
        sql += ` AND d.filename ILIKE $${paramIndex}`;
        params.push(`%${query.filename_filter}%`);
        paramIndex++;
      }
      
      sql += ` ORDER BY d.indexed_at DESC LIMIT $${paramIndex}`;
      params.push((query.limit || 50) * 3); // Get more candidates for similarity filtering
      
      const result = await this.pool.query(sql, params);
      
      // Calculate semantic similarity and filter
      const candidates: SemanticSearchResult[] = result.rows
        .map(row => {
          if (!row.embedding) return null;
          
          const similarity = this.cosineSimilarity(queryEmbedding, row.embedding);
          if (similarity < threshold) return null;
          
          return {
            document: {
              id: row.id,
              filename: row.filename,
              filepath: row.filepath,
              content: row.content,
              metadata: row.doc_metadata,
              chunks: [],
              indexed_at: new Date(row.indexed_at)
            },
            chunk: {
              id: row.chunk_id,
              document_id: row.id,
              content: row.chunk_content,
              chunk_index: row.chunk_index,
              start_position: row.start_position,
              end_position: row.end_position,
              metadata: row.chunk_metadata,
              embedding: row.embedding
            },
            similarity_score: Math.round(similarity * 1000) / 1000,
            relevance_score: similarity
          };
        })
        .filter(result => result !== null)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, query.limit || 50);
      
      return candidates;
    } catch (error) {
      console.error('Error in semantic knowledge search:', error);
      return [];
    }
  }

  // Keyword-based search for precise matching
  async searchByKeywords(keywords: string[], options: {
    limit?: number;
    file_type_filter?: string;
    filename_filter?: string;
    match_mode?: 'any' | 'all';
    case_sensitive?: boolean;
  } = {}): Promise<{
    keywords: string[];
    total_results: number;
    match_mode: string;
    results: Array<{
      document: KnowledgeDocument;
      chunk: KnowledgeChunk;
      matched_keywords: string[];
      keyword_count: number;
    }>;
  }> {
    if (!this.pool) return { keywords, total_results: 0, match_mode: 'any', results: [] };

    const matchMode = options.match_mode || 'any';
    const caseSensitive = options.case_sensitive || false;
    
    try {
      let sql = `
        SELECT 
          d.id, d.filename, d.filepath, d.content, d.metadata as doc_metadata, d.indexed_at,
          c.id as chunk_id, c.content as chunk_content, c.chunk_index, 
          c.start_position, c.end_position, c.metadata as chunk_metadata
        FROM knowledge_documents d
        JOIN knowledge_chunks c ON d.id = c.document_id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // Add file type filter
      if (options.file_type_filter) {
        sql += ` AND d.metadata->>'fileType' = $${paramIndex}`;
        params.push(options.file_type_filter);
        paramIndex++;
      }
      
      // Add filename filter
      if (options.filename_filter) {
        sql += ` AND d.filename ILIKE $${paramIndex}`;
        params.push(`%${options.filename_filter}%`);
        paramIndex++;
      }
      
      // Add keyword matching
      if (keywords.length > 0) {
        const keywordConditions = keywords.map(keyword => {
          const escapedKeyword = keyword.replace(/[%_\\]/g, '\\$&');
          const pattern = caseSensitive ? `%${escapedKeyword}%` : `%${escapedKeyword.toLowerCase()}%`;
          const textColumn = caseSensitive ? 'c.content' : 'LOWER(c.content)';
          return `${textColumn} LIKE $${paramIndex++}`;
        });
        
        params.push(...keywords.map(k => caseSensitive ? `%${k}%` : `%${k.toLowerCase()}%`));
        
        if (matchMode === 'all') {
          sql += ` AND (${keywordConditions.join(' AND ')})`;
        } else {
          sql += ` AND (${keywordConditions.join(' OR ')})`;
        }
      }
      
      sql += ` ORDER BY d.indexed_at DESC LIMIT $${paramIndex}`;
      params.push(options.limit || 100);
      
      const result = await this.pool.query(sql, params);
      
      // Process results and find matched keywords
      const results = result.rows.map(row => {
        const content = row.chunk_content;
        const textToSearch = caseSensitive ? content : content.toLowerCase();
        const keywordsToMatch = caseSensitive ? keywords : keywords.map(k => k.toLowerCase());
        
        const matchedKeywords = keywordsToMatch.filter(keyword => 
          textToSearch.includes(keyword)
        );
        
        return {
          document: {
            id: row.id,
            filename: row.filename,
            filepath: row.filepath,
            content: row.content,
            metadata: row.doc_metadata,
            chunks: [],
            indexed_at: new Date(row.indexed_at)
          },
          chunk: {
            id: row.chunk_id,
            document_id: row.id,
            content: content,
            chunk_index: row.chunk_index,
            start_position: row.start_position,
            end_position: row.end_position,
            metadata: row.chunk_metadata
          },
          matched_keywords: matchedKeywords,
          keyword_count: matchedKeywords.length
        };
      });
      
      // Sort by keyword relevance
      results.sort((a, b) => b.keyword_count - a.keyword_count);
      
      return {
        keywords,
        total_results: results.length,
        match_mode: matchMode,
        results
      };
      
    } catch (error) {
      console.error('Error in keyword knowledge search:', error);
      return { keywords, total_results: 0, match_mode: matchMode, results: [] };
    }
  }

  // Hybrid search: keyword filtering + semantic ranking
  async searchHybrid(query: string, keywords: string[], options: {
    limit?: number;
    similarity_threshold?: number;
    file_type_filter?: string;
    filename_filter?: string;
    keyword_match_mode?: 'any' | 'all';
  } = {}): Promise<{
    query: string;
    keywords: string[];
    total_results: number;
    results: Array<{
      document: KnowledgeDocument;
      chunk: KnowledgeChunk;
      matched_keywords: string[];
      similarity_score: number;
      relevance_score: number;
    }>;
  }> {
    // Step 1: Filter by keywords
    const keywordResults = await this.searchByKeywords(keywords, {
      limit: (options.limit || 50) * 3,
      file_type_filter: options.file_type_filter,
      filename_filter: options.filename_filter,
      match_mode: options.keyword_match_mode || 'any'
    });

    if (keywordResults.results.length === 0) {
      return {
        query,
        keywords,
        total_results: 0,
        results: []
      };
    }

    // Step 2: Rank by semantic similarity
    let rankedResults = keywordResults.results;
    
    if (this.openai && query.trim()) {
      try {
        const queryEmbedding = await this.generateEmbedding(query);
        
        rankedResults = keywordResults.results.map(result => {
          // Generate embedding for chunk if not exists
          const similarity = 0.5; // Default for keyword matches
          const keywordScore = result.keyword_count / keywords.length;
          const relevanceScore = (similarity * 0.4) + (keywordScore * 0.6);
          
          return {
            document: result.document,
            chunk: result.chunk,
            matched_keywords: result.matched_keywords,
            similarity_score: Math.round(similarity * 1000) / 1000,
            relevance_score: Math.round(relevanceScore * 1000) / 1000
          };
        });
        
        rankedResults.sort((a, b) => b.relevance_score - a.relevance_score);
        
      } catch (error) {
        console.warn('Semantic ranking failed, using keyword-only results:', error);
        rankedResults = keywordResults.results.map(result => ({
          document: result.document,
          chunk: result.chunk,
          matched_keywords: result.matched_keywords,
          similarity_score: 0.5,
          relevance_score: result.keyword_count / keywords.length
        }));
      }
    } else {
      rankedResults = keywordResults.results.map(result => ({
        document: result.document,
        chunk: result.chunk,
        matched_keywords: result.matched_keywords,
        similarity_score: 0.5,
        relevance_score: result.keyword_count / keywords.length
      }));
    }

    return {
      query,
      keywords,
      total_results: rankedResults.length,
      results: rankedResults.slice(0, options.limit || 50)
    };
  }

  // Process all existing documents to add embeddings
  async processAllDocuments(): Promise<void> {
    if (!this.pool) return;

    try {
      const result = await this.pool.query(`
        SELECT id, content, 
               (SELECT COUNT(*) FROM knowledge_chunks WHERE document_id = knowledge_documents.id) as chunk_count
        FROM knowledge_documents
        WHERE embedding IS NULL
        ORDER BY indexed_at DESC
      `);

      console.log(`[REFRESH] Processing ${result.rows.length} documents for embeddings...`);

      for (const row of result.rows) {
        try {
          // Process document embedding
          const docEmbedding = await this.generateEmbedding(row.content.substring(0, 4000));
          const embeddingModel = this.openai ? 'text-embedding-3-small' : 'simple';

          await this.pool.query(`
            UPDATE knowledge_documents 
            SET embedding = $1, embedding_model = $2
            WHERE id = $3
          `, [docEmbedding, embeddingModel, row.id]);

          // Process chunk embeddings
          const chunks = await this.pool.query(`
            SELECT id, content FROM knowledge_chunks 
            WHERE document_id = $1 AND embedding IS NULL
          `, [row.id]);

          for (const chunk of chunks.rows) {
            const chunkEmbedding = await this.generateEmbedding(chunk.content);
            await this.pool.query(`
              UPDATE knowledge_chunks 
              SET embedding = $1, embedding_model = $2
              WHERE id = $3
            `, [chunkEmbedding, embeddingModel, chunk.id]);
          }

          console.log(`[SUCCESS] Processed document ${row.id} (${chunks.rows.length} chunks)`);
        } catch (error) {
          console.error(`[ERROR] Failed to process document ${row.id}:`, error);
        }
      }

      console.log('[COMPLETE] Finished processing all documents for embeddings');
    } catch (error) {
      console.error('Error processing documents:', error);
    }
  }
}
