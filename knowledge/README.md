# Knowledge Base

This directory contains files that are automatically indexed by the MCP Crypto Server's knowledge base module. You can add various file types here and they will be automatically parsed and made searchable.

## Supported File Types

- **CSV files** (.csv): Parsed row by row with column headers
- **Text files** (.txt, .md, .log): Split into paragraphs for chunking
- **JSON files** (.json, .jsonl): Parsed into structured chunks

## How to Use

1. Add files to this directory
2. The knowledge base will automatically detect and index them
3. Use the MCP tools to search through the content:
   - `knowledge_search` - Search for specific terms or concepts
   - `knowledge_list_files` - List all indexed files
   - `knowledge_get_file` - Get detailed info about a specific file
   - `knowledge_stats` - Get statistics about the knowledge base

## Examples

The knowledge base comes with example files:
- `crypto_terms.csv` - Cryptocurrency terminology and definitions
- `trading_strategies.txt` - Common trading strategies and techniques
- `market_data.json` - Market data for exchanges and protocols

## Search Tips

- Use natural language queries: "What is DeFi?" or "trading strategies for volatile markets"
- Search by file type: filter results by .csv, .txt, or .json files
- The search uses PostgreSQL full-text search for accurate results
- Results include context and matching snippets for easy reference

## File Watching

The knowledge base automatically watches this directory for changes:
- New files are indexed immediately
- Modified files are re-indexed
- Deleted files are removed from the index

No manual intervention is required - just add your files and start searching!
