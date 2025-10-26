import { BaseCryptoModule } from '../base/module.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SemanticKnowledgeEngine } from './semantic-knowledge-engine.js';

interface KnowledgeDocument {
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

interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  start_position: number;
  end_position: number;
  metadata?: any;
}

interface SearchResult {
  document: KnowledgeDocument;
  chunk?: KnowledgeChunk;
  score: number;
  matches: string[];
  context: string;
}

interface FileParser {
  extensions: string[];
  parse(filePath: string, content: Buffer): Promise<{
    content: string;
    metadata: any;
    chunks: Array<{
      content: string;
      metadata?: any;
    }>;
  }>;
}

export class KnowledgeModule extends BaseCryptoModule {
  name = 'knowledge';
  private knowledgeDir: string;
  private documents: Map<string, KnowledgeDocument> = new Map();
  private parsers: Map<string, FileParser> = new Map();
  private watchedFiles: Map<string, fs.FSWatcher> = new Map();
  private isWatching = false;
  private semanticEngine: SemanticKnowledgeEngine | null = null;

  constructor() {
    super();
    this.knowledgeDir = process.env.KNOWLEDGE_DIR || path.join(process.cwd(), 'knowledge');
    this.initializeParsers();
    this.setupTools();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Register database
    this.postgresManager.registerDatabase({
      name: 'knowledge',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || 'mcp_crypto',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: false
    });

    // Ensure knowledge directory exists
    if (!fs.existsSync(this.knowledgeDir)) {
      fs.mkdirSync(this.knowledgeDir, { recursive: true });
      console.log(`[FOLDER] Created knowledge directory: ${this.knowledgeDir}`);
    }

    // Initialize database tables
    await this.initializeDatabase();

    // Index existing files
    await this.indexAllFiles();

    // Initialize semantic engine
    try {
      const pool = await this.postgresManager.getPool('knowledge');
      if (pool) {
        this.semanticEngine = new SemanticKnowledgeEngine(pool, process.env.OPENAI_API_KEY);
        await this.semanticEngine.initialize();
        
        // Process existing documents for embeddings
        await this.semanticEngine.processAllDocuments();
      }
    } catch (error) {
      console.error('Failed to initialize semantic engine:', error);
    }

    // Start file watching
    await this.startFileWatching();

    await super.initialize();
    console.log(`[BRAIN] Knowledge base initialized with ${this.documents.size} documents`);
  }

  private initializeParsers(): void {
    // CSV Parser
    this.parsers.set('csv', {
      extensions: ['.csv'],
      parse: async (filePath: string, content: Buffer) => {
        const text = content.toString('utf-8');
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          return { content: '', metadata: {}, chunks: [] };
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1);
        
        const chunks = rows.map((row, index) => {
          const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
          const rowObj: any = {};
          headers.forEach((header, i) => {
            rowObj[header] = values[i] || '';
          });
          
          return {
            content: `Row ${index + 1}: ${JSON.stringify(rowObj, null, 2)}`,
            metadata: { row: index + 1, data: rowObj }
          };
        });

        return {
          content: text,
          metadata: { 
            headers, 
            rowCount: rows.length,
            columns: headers.length 
          },
          chunks
        };
      }
    });

    // TXT Parser
    this.parsers.set('txt', {
      extensions: ['.txt', '.md', '.log'],
      parse: async (filePath: string, content: Buffer) => {
        const text = content.toString('utf-8');
        const paragraphs = text.split('\n\n').filter(p => p.trim());
        
        const chunks = paragraphs.map((paragraph, index) => ({
          content: paragraph.trim(),
          metadata: { paragraph: index + 1 }
        }));

        return {
          content: text,
          metadata: { 
            lineCount: text.split('\n').length,
            paragraphCount: paragraphs.length 
          },
          chunks
        };
      }
    });

    // JSON Parser
    this.parsers.set('json', {
      extensions: ['.json', '.jsonl'],
      parse: async (filePath: string, content: Buffer) => {
        const text = content.toString('utf-8');
        
        try {
          if (filePath.endsWith('.jsonl')) {
            // JSON Lines format
            const lines = text.split('\n').filter(line => line.trim());
            const chunks = lines.map((line, index) => {
              try {
                const obj = JSON.parse(line);
                return {
                  content: JSON.stringify(obj, null, 2),
                  metadata: { line: index + 1, object: obj }
                };
              } catch {
                return {
                  content: line,
                  metadata: { line: index + 1, raw: true }
                };
              }
            });

            return {
              content: text,
              metadata: { format: 'jsonl', recordCount: lines.length },
              chunks
            };
          } else {
            // Regular JSON
            const obj = JSON.parse(text);
            const chunks = this.extractJsonChunks(obj);
            
            return {
              content: text,
              metadata: { format: 'json', structure: typeof obj },
              chunks
            };
          }
        } catch (error) {
          // Fallback to text parsing
          return {
            content: text,
            metadata: { format: 'json', parseError: (error as Error).message },
            chunks: [{ content: text, metadata: { raw: true } }]
          };
        }
      }
    });
  }

  private extractJsonChunks(obj: any, path = '', chunks: Array<{ content: string; metadata: any }> = []): Array<{ content: string; metadata: any }> {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const currentPath = `${path}[${index}]`;
        if (typeof item === 'object' && item !== null) {
          chunks.push({
            content: JSON.stringify(item, null, 2),
            metadata: { path: currentPath, type: 'array_item', index }
          });
          this.extractJsonChunks(item, currentPath, chunks);
        } else {
          chunks.push({
            content: String(item),
            metadata: { path: currentPath, type: 'primitive', index }
          });
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          chunks.push({
            content: `${key}: ${JSON.stringify(value, null, 2)}`,
            metadata: { path: currentPath, key, type: 'object_property' }
          });
          this.extractJsonChunks(value, currentPath, chunks);
        } else {
          chunks.push({
            content: `${key}: ${value}`,
            metadata: { path: currentPath, key, type: 'primitive', value }
          });
        }
      });
    }
    
    return chunks;
  }

  private async initializeDatabase(): Promise<void> {
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      // Create knowledge_documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id VARCHAR(64) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          filepath TEXT NOT NULL,
          content TEXT,
          metadata JSONB,
          indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(filepath)
        )
      `);

      // Create knowledge_chunks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id VARCHAR(64) PRIMARY KEY,
          document_id VARCHAR(64) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          start_position INTEGER,
          end_position INTEGER,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better search performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_documents_filename 
        ON knowledge_documents(filename)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id 
        ON knowledge_chunks(document_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content 
        ON knowledge_chunks USING gin(to_tsvector('english', content))
      `);

    } finally {
      client.release();
    }
  }

  private async indexAllFiles(): Promise<void> {
    if (!fs.existsSync(this.knowledgeDir)) return;

    const files = this.getAllFiles(this.knowledgeDir);
    console.log(`📚 Found ${files.length} files to index`);

    for (const filePath of files) {
      try {
        await this.indexFile(filePath);
      } catch (error) {
        console.error(`[ERROR] Failed to index ${filePath}:`, (error as Error).message);
      }
    }
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async indexFile(filePath: string): Promise<void> {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Find appropriate parser
    let parser: FileParser | undefined;
    for (const [, p] of this.parsers) {
      if (p.extensions.includes(ext)) {
        parser = p;
        break;
      }
    }

    if (!parser) {
      // Default text parser for unknown extensions
      parser = this.parsers.get('txt')!;
    }

    const parsed = await parser.parse(filePath, content);
    const documentId = crypto.createHash('sha256').update(filePath).digest('hex');
    
    const document: KnowledgeDocument = {
      id: documentId,
      filename: path.basename(filePath),
      filepath: filePath,
      content: parsed.content,
      metadata: {
        fileType: ext,
        size: stat.size,
        lastModified: stat.mtime,
        ...parsed.metadata
      },
      chunks: parsed.chunks.map((chunk, index) => ({
        id: crypto.createHash('sha256').update(`${documentId}_${index}`).digest('hex'),
        document_id: documentId,
        content: chunk.content,
        chunk_index: index,
        start_position: 0, // Could be calculated more precisely
        end_position: chunk.content.length,
        metadata: chunk.metadata
      })),
      indexed_at: new Date()
    };

    // Store in memory
    this.documents.set(documentId, document);

    // Store in database
    await this.saveDocumentToDatabase(document);
    
    // Process through semantic engine if available
    if (this.semanticEngine) {
      await this.semanticEngine.processDocument(document);
    }
    
    console.log(`[SUCCESS] Indexed: ${document.filename} (${document.chunks.length} chunks)`);
  }

  private async saveDocumentToDatabase(document: KnowledgeDocument): Promise<void> {
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      await client.query('BEGIN');

      // Delete existing document and chunks
      await client.query('DELETE FROM knowledge_documents WHERE id = $1', [document.id]);

      // Insert document
      await client.query(`
        INSERT INTO knowledge_documents (id, filename, filepath, content, metadata, indexed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        document.id,
        document.filename,
        document.filepath,
        document.content,
        JSON.stringify(document.metadata),
        document.indexed_at
      ]);

      // Insert chunks
      for (const chunk of document.chunks) {
        await client.query(`
          INSERT INTO knowledge_chunks (id, document_id, content, chunk_index, start_position, end_position, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          chunk.id,
          chunk.document_id,
          chunk.content,
          chunk.chunk_index,
          chunk.start_position,
          chunk.end_position,
          JSON.stringify(chunk.metadata)
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async startFileWatching(): Promise<void> {
    if (this.isWatching) return;

    try {
      const watcher = fs.watch(this.knowledgeDir, { recursive: true }, async (eventType, filename) => {
        if (!filename) return;
        
        const filePath = path.join(this.knowledgeDir, filename);
        
        try {
          if (eventType === 'change' || eventType === 'rename') {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              console.log(`[REFRESH] File changed: ${filename}, re-indexing...`);
              await this.indexFile(filePath);
            } else {
              // File was deleted
              const documentId = crypto.createHash('sha256').update(filePath).digest('hex');
              this.documents.delete(documentId);
              await this.removeDocumentFromDatabase(documentId);
              console.log(` File removed: ${filename}`);
            }
          }
        } catch (error) {
          console.error(`[ERROR] Error handling file change for ${filename}:`, (error as Error).message);
        }
      });

      this.watchedFiles.set(this.knowledgeDir, watcher);
      this.isWatching = true;
      console.log(`👀 Watching knowledge directory: ${this.knowledgeDir}`);
    } catch (error) {
      console.error('[ERROR] Failed to start file watching:', (error as Error).message);
    }
  }

  private async removeDocumentFromDatabase(documentId: string): Promise<void> {
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      await client.query('DELETE FROM knowledge_documents WHERE id = $1', [documentId]);
    } finally {
      client.release();
    }
  }

  protected setupTools(): void {
    this.addTool({
      name: 'knowledge_search',
      description: 'Search through the knowledge base using text queries with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant content'
          },
          fileType: {
            type: 'string',
            description: 'Filter by file extension (e.g., .csv, .txt, .json)'
          },
          filename: {
            type: 'string',
            description: 'Filter by filename pattern'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10
          },
          includeContent: {
            type: 'boolean',
            description: 'Include full content in results',
            default: false
          }
        },
        required: ['query']
      },
      handler: this.searchKnowledge.bind(this)
    });

    this.addTool({
      name: 'knowledge_list_files',
      description: 'List all files in the knowledge base with their metadata',
      inputSchema: {
        type: 'object',
        properties: {
          fileType: {
            type: 'string',
            description: 'Filter by file extension'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of files to return',
            default: 50
          }
        }
      },
      handler: this.listFiles.bind(this)
    });

    this.addTool({
      name: 'knowledge_get_file',
      description: 'Get detailed information about a specific file including its content and chunks',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Name of the file to retrieve'
          },
          includeChunks: {
            type: 'boolean',
            description: 'Include all chunks in the response',
            default: true
          }
        },
        required: ['filename']
      },
      handler: this.getFile.bind(this)
    });

    this.addTool({
      name: 'knowledge_reindex',
      description: 'Re-index all files in the knowledge base or a specific file',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Specific file to re-index (optional, if not provided, re-indexes all files)'
          }
        }
      },
      handler: this.reindexFiles.bind(this)
    });

    this.addTool({
      name: 'knowledge_stats',
      description: 'Get statistics about the knowledge base',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: this.getStats.bind(this)
    });

    // Unified advanced search tool
    this.addTool({
      name: 'knowledge_advanced_search',
      description: 'Advanced search with multiple strategies: semantic (conceptual), keyword (precise), or hybrid (balanced)',
      inputSchema: {
        type: 'object',
        properties: {
          search_type: {
            type: 'string',
            description: 'Search strategy to use',
            enum: ['semantic', 'keyword', 'hybrid'],
            default: 'semantic'
          },
          query: {
            type: 'string',
            description: 'Search query - semantic query for semantic/hybrid search, or main topic for keyword search'
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords for keyword/hybrid search (e.g., ["python", "pandas", "dataframe"])'
          },
          semantic_similarity_threshold: {
            type: 'number',
            description: 'Minimum semantic similarity score for semantic/hybrid search (0-1)',
            default: 0.6
          },
          keyword_match_mode: {
            type: 'string',
            description: 'For keyword/hybrid search: match any keyword or all keywords',
            enum: ['any', 'all'],
            default: 'any'
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Whether keyword matching should be case-sensitive',
            default: false
          },
          file_type_filter: {
            type: 'string',
            description: 'Filter by file extension (e.g., .csv, .txt, .json)'
          },
          filename_filter: {
            type: 'string',
            description: 'Filter by filename pattern'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 30
          }
        },
        required: ['search_type']
      },
      handler: this.advancedSearch.bind(this)
    });
  }

  private async searchKnowledge(args: any): Promise<any> {
    const { query, fileType, filename, limit = 10, includeContent = false } = args;
    
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      let sql = `
        SELECT 
          d.id, d.filename, d.filepath, d.metadata as doc_metadata,
          c.id as chunk_id, c.content, c.chunk_index, c.metadata as chunk_metadata,
          ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $1)) as rank
        FROM knowledge_documents d
        JOIN knowledge_chunks c ON d.id = c.document_id
        WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
      `;
      
      const params: any[] = [query];
      let paramIndex = 2;

      if (fileType) {
        sql += ` AND d.metadata->>'fileType' = $${paramIndex}`;
        params.push(fileType);
        paramIndex++;
      }

      if (filename) {
        sql += ` AND d.filename ILIKE $${paramIndex}`;
        params.push(`%${filename}%`);
        paramIndex++;
      }

      sql += ` ORDER BY rank DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(sql, params);
      
      const results: SearchResult[] = result.rows.map(row => {
        const document = this.documents.get(row.id);
        const chunk = document?.chunks.find(c => c.id === row.chunk_id);
        
        return {
          document: {
            id: row.id,
            filename: row.filename,
            filepath: row.filepath,
            content: includeContent ? (document?.content || '') : '',
            metadata: row.doc_metadata,
            chunks: [],
            indexed_at: new Date()
          },
          chunk: chunk || {
            id: row.chunk_id,
            document_id: row.id,
            content: row.content,
            chunk_index: row.chunk_index,
            start_position: 0,
            end_position: row.content.length,
            metadata: row.chunk_metadata
          },
          score: parseFloat(row.rank),
          matches: this.extractMatches(row.content, query),
          context: this.getContext(row.content, query)
        };
      });

      return {
        query,
        results,
        total: results.length,
        knowledge_base_stats: {
          total_documents: this.documents.size,
          total_chunks: Array.from(this.documents.values()).reduce((sum, doc) => sum + doc.chunks.length, 0)
        }
      };
    } finally {
      client.release();
    }
  }

  private extractMatches(content: string, query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const matches: string[] = [];
    
    for (const word of words) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const found = content.match(regex);
      if (found) {
        matches.push(...found);
      }
    }
    
    return [...new Set(matches)];
  }

  private getContext(content: string, query: string, contextLength = 200): string {
    const words = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let bestMatch = -1;
    let bestScore = 0;
    
    for (const word of words) {
      const index = contentLower.indexOf(word);
      if (index !== -1) {
        const score = words.filter(w => contentLower.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = index;
        }
      }
    }
    
    if (bestMatch === -1) return content.substring(0, contextLength);
    
    const start = Math.max(0, bestMatch - contextLength / 2);
    const end = Math.min(content.length, bestMatch + contextLength / 2);
    
    return content.substring(start, end);
  }

  private async listFiles(args: any): Promise<any> {
    const { fileType, limit = 50 } = args;
    
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      let sql = `
        SELECT id, filename, filepath, metadata, indexed_at,
               (SELECT COUNT(*) FROM knowledge_chunks WHERE document_id = knowledge_documents.id) as chunk_count
        FROM knowledge_documents
      `;
      
      const params: any[] = [];
      let paramIndex = 1;

      if (fileType) {
        sql += ` WHERE metadata->>'fileType' = $${paramIndex}`;
        params.push(fileType);
        paramIndex++;
      }

      sql += ` ORDER BY indexed_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(sql, params);
      
      return {
        files: result.rows.map(row => ({
          id: row.id,
          filename: row.filename,
          filepath: row.filepath,
          metadata: row.metadata,
          chunk_count: parseInt(row.chunk_count),
          indexed_at: row.indexed_at
        })),
        total: result.rows.length
      };
    } finally {
      client.release();
    }
  }

  private async getFile(args: any): Promise<any> {
    const { filename, includeChunks = true } = args;
    
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      const result = await client.query(`
        SELECT id, filename, filepath, content, metadata, indexed_at
        FROM knowledge_documents
        WHERE filename = $1
      `, [filename]);
      
      if (result.rows.length === 0) {
        throw new Error(`File not found: ${filename}`);
      }
      
      const doc = result.rows[0];
      let chunks = [];
      
      if (includeChunks) {
        const chunkResult = await client.query(`
          SELECT id, content, chunk_index, start_position, end_position, metadata
          FROM knowledge_chunks
          WHERE document_id = $1
          ORDER BY chunk_index
        `, [doc.id]);
        
        chunks = chunkResult.rows;
      }
      
      return {
        document: {
          id: doc.id,
          filename: doc.filename,
          filepath: doc.filepath,
          content: doc.content,
          metadata: doc.metadata,
          indexed_at: doc.indexed_at
        },
        chunks,
        chunk_count: chunks.length
      };
    } finally {
      client.release();
    }
  }

  private async reindexFiles(args: any): Promise<any> {
    const { filename } = args;
    
    if (filename) {
      // Re-index specific file
      const filePath = path.join(this.knowledgeDir, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filename}`);
      }
      
      await this.indexFile(filePath);
      return { message: `Re-indexed file: ${filename}` };
    } else {
      // Re-index all files
      const beforeCount = this.documents.size;
      this.documents.clear();
      
      await this.indexAllFiles();
      
      return { 
        message: `Re-indexed all files`,
        before_count: beforeCount,
        after_count: this.documents.size
      };
    }
  }

  private async getStats(args: any): Promise<any> {
    const client = await this.postgresManager.getClient('knowledge');
    
    try {
      const docResult = await client.query(`
        SELECT 
          COUNT(*) as total_documents,
          COUNT(DISTINCT metadata->>'fileType') as unique_file_types,
          SUM((metadata->>'size')::bigint) as total_size_bytes
        FROM knowledge_documents
      `);
      
      const chunkResult = await client.query(`
        SELECT COUNT(*) as total_chunks
        FROM knowledge_chunks
      `);
      
      const typeResult = await client.query(`
        SELECT 
          metadata->>'fileType' as file_type,
          COUNT(*) as count
        FROM knowledge_documents
        GROUP BY metadata->>'fileType'
        ORDER BY count DESC
      `);
      
      return {
        knowledge_base_stats: {
          total_documents: parseInt(docResult.rows[0].total_documents),
          total_chunks: parseInt(chunkResult.rows[0].total_chunks),
          unique_file_types: parseInt(docResult.rows[0].unique_file_types),
          total_size_bytes: parseInt(docResult.rows[0].total_size_bytes || '0'),
          knowledge_directory: this.knowledgeDir,
          file_watching_enabled: this.isWatching
        },
        file_type_breakdown: typeResult.rows.map(row => ({
          file_type: row.file_type,
          count: parseInt(row.count)
        }))
      };
    } finally {
      client.release();
    }
  }

  // Unified advanced search handler
  private async advancedSearch(args: any): Promise<any> {
    try {
      if (!this.semanticEngine) {
        return {
          success: false,
          error: 'Semantic engine not initialized',
          message: 'Advanced search requires the semantic engine to be properly initialized',
          data: { search_type: args.search_type, results: [] }
        };
      }

      const searchType = args.search_type || 'semantic';

      switch (searchType) {
        case 'semantic':
          return await this.handleSemanticSearch(args);
        
        case 'keyword':
          return await this.handleKeywordSearch(args);
        
        case 'hybrid':
          return await this.handleHybridSearch(args);
        
        default:
          return {
            success: false,
            error: 'Invalid search type',
            message: 'Search type must be one of: semantic, keyword, hybrid',
            data: { search_type: searchType, results: [] }
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Advanced search failed: ${error}`,
        message: 'Error performing advanced search on knowledge base',
        data: { search_type: args.search_type, results: [] }
      };
    }
  }

  private async handleSemanticSearch(args: any): Promise<any> {
    if (!args.query) {
      return {
        success: false,
        error: 'Query required for semantic search',
        message: 'Semantic search requires a query parameter',
        data: { search_type: 'semantic', results: [] }
      };
    }

    const results = await this.semanticEngine.semanticSearch({
      query: args.query,
      semantic_similarity_threshold: args.semantic_similarity_threshold || 0.6,
      file_type_filter: args.file_type_filter,
      filename_filter: args.filename_filter,
      limit: args.limit || 20
    });

    return {
      success: true,
      message: `Found ${results.length} semantically similar documents for "${args.query}"`,
      data: {
        search_type: 'semantic',
        query: args.query,
        semantic_similarity_threshold: args.semantic_similarity_threshold || 0.6,
        total_results: results.length,
        results: results.map(result => ({
          document: {
            id: result.document.id,
            filename: result.document.filename,
            filepath: result.document.filepath,
            metadata: result.document.metadata,
            indexed_at: result.document.indexed_at
          },
          chunk: {
            id: result.chunk.id,
            content: result.chunk.content,
            chunk_index: result.chunk.chunk_index,
            metadata: result.chunk.metadata
          },
          similarity_score: result.similarity_score,
          relevance_score: result.relevance_score
        }))
      }
    };
  }

  private async handleKeywordSearch(args: any): Promise<any> {
    const keywords = args.keywords || [];
    if (keywords.length === 0) {
      return {
        success: false,
        error: 'Keywords required for keyword search',
        message: 'Keyword search requires at least one keyword',
        data: { search_type: 'keyword', results: [] }
      };
    }

    const results = await this.semanticEngine.searchByKeywords(keywords, {
      match_mode: args.keyword_match_mode || 'any',
      case_sensitive: args.case_sensitive || false,
      file_type_filter: args.file_type_filter,
      filename_filter: args.filename_filter,
      limit: args.limit || 50
    });

    return {
      success: true,
      message: `Found ${results.total_results} documents matching keywords: ${keywords.join(', ')}`,
      data: {
        search_type: 'keyword',
        keywords: results.keywords,
        match_mode: results.match_mode,
        total_results: results.total_results,
        results: results.results.map(result => ({
          document: {
            id: result.document.id,
            filename: result.document.filename,
            filepath: result.document.filepath,
            metadata: result.document.metadata,
            indexed_at: result.document.indexed_at
          },
          chunk: {
            id: result.chunk.id,
            content: result.chunk.content,
            chunk_index: result.chunk.chunk_index,
            metadata: result.chunk.metadata
          },
          matched_keywords: result.matched_keywords,
          keyword_count: result.keyword_count
        }))
      }
    };
  }

  private async handleHybridSearch(args: any): Promise<any> {
    const query = args.query || '';
    const keywords = args.keywords || [];
    
    if (!query.trim() || keywords.length === 0) {
      return {
        success: false,
        error: 'Query and keywords required for hybrid search',
        message: 'Hybrid search requires both query and keywords parameters',
        data: { search_type: 'hybrid', results: [] }
      };
    }

    const results = await this.semanticEngine.searchHybrid(query, keywords, {
      keyword_match_mode: args.keyword_match_mode || 'any',
      similarity_threshold: args.semantic_similarity_threshold || 0.5,
      file_type_filter: args.file_type_filter,
      filename_filter: args.filename_filter,
      limit: args.limit || 30
    });

    return {
      success: true,
      message: `Found ${results.total_results} documents using hybrid search for "${query}" with keywords: ${keywords.join(', ')}`,
      data: {
        search_type: 'hybrid',
        query: results.query,
        keywords: results.keywords,
        total_results: results.total_results,
        results: results.results.map(result => ({
          document: {
            id: result.document.id,
            filename: result.document.filename,
            filepath: result.document.filepath,
            metadata: result.document.metadata,
            indexed_at: result.document.indexed_at
          },
          chunk: {
            id: result.chunk.id,
            content: result.chunk.content,
            chunk_index: result.chunk.chunk_index,
            metadata: result.chunk.metadata
          },
          matched_keywords: result.matched_keywords,
          similarity_score: result.similarity_score,
          relevance_score: result.relevance_score
        }))
      }
    };
  }

  async cleanup(): Promise<void> {
    // Stop file watching
    for (const [, watcher] of this.watchedFiles) {
      watcher.close();
    }
    this.watchedFiles.clear();
    this.isWatching = false;
    
    await super.cleanup();
  }
}
