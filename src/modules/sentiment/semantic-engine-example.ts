// Example usage of the RAG-based Semantic Sentiment Engine
import { Pool } from 'pg';
import { SemanticSentimentEngine } from './semantic-engine';

async function exampleUsage() {
  // Initialize with database connection and optional OpenAI API key
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const engine = new SemanticSentimentEngine(pool, process.env.OPENAI_API_KEY);
  await engine.initialize();

  // Example 1: Process messages (ingestion phase - minimal LLM usage)
  console.log(' Processing messages...');
  
  const sampleMessages = [
    { id: '1', text: 'Bitcoin is pumping hard! [LAUNCH] Diamond hands!', date: new Date(), metadata: {} },
    { id: '2', text: 'ETH looking bearish, might dump soon', date: new Date(), metadata: {} },
    { id: '3', text: 'Solana ecosystem is growing fast, bullish on SOL', date: new Date(), metadata: {} }
  ];

  for (const msg of sampleMessages) {
    await engine.processMessage(msg, 'telegram');
  }

  // Example 2: MCP-style retrieval (returns relevant messages for LLM to analyze)
  console.log('\n[SEARCH] MCP semantic retrieval...');
  
  const retrievalResult = await engine.semanticSearch({
    query: 'Bitcoin price movement',
    semantic_similarity_threshold: 0.6,
    time_range: '24h',
    limit: 20
  });

  console.log('Total results:', retrievalResult.length);
  console.log('Sample message:', retrievalResult[0]);
  
  // The calling LLM (Claude/GPT) would now analyze these messages:
  console.log('\n[WRITE] Messages ready for LLM analysis:');
  retrievalResult.slice(0, 3).forEach((msg, i) => {
    console.log(`${i + 1}. [${msg.source}] ${msg.text.substring(0, 100)}...`);
  });

  // Example 3: Traditional semantic search (lower-level access)
  console.log('\n🔎 Traditional semantic search...');
  
  const searchResults = await engine.semanticSearch({
    query: 'bullish sentiment',
    semantic_similarity_threshold: 0.7,
    limit: 5
  });

  console.log('Search results:', searchResults.length);

  // Example 4: Check cache status
  console.log('\n💾 Cache status:');
  console.log('Embedding cache size:', (engine as any).embeddingCache?.size || 0);

  await pool.end();
}

// MCP Server Flow Explanation:
/*
MCP Server Role (this module):
1. Ingest messages → Generate embeddings → Store in DB
2. Receive query from LLM → Find relevant messages → Return structured data
3. NO analysis in MCP server - just retrieval

LLM (Claude/GPT) Role:
1. Send query to MCP server
2. Receive relevant messages with similarity scores
3. Analyze the messages and provide insights to user

Cost Benefits:
- MCP Server: Only embedding costs (~$0.02 per 1000 messages)
- LLM: Analyzes only relevant messages (not all messages)
- Total: Much cheaper than analyzing every message
*/

if (require.main === module) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };
