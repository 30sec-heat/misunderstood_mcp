# Social Module

Search for coin/token mentions across social and news sources.

## Tools

### `social_search_coin_mentions`
Search for a coin/token by symbol or name. Returns recent mentions with optional sentiment summary.

**Free tier** (no API key):
- Uses News module: RSS feeds, Telegram, Reddit
- Requires News module to be loaded

**With API key** (web search for Twitter/X etc.):
- `BRAVE_SEARCH_API_KEY`: Brave Search API (brave.com/api)
- `SERPER_API_KEY`: Serper API (serper.dev) - 2500 free searches

## Notes

- **Twitter/X**: Nitter API is no longer viable (2024). For native Twitter search, Twitter Premium API gives better results.
- Free tier uses RSS and Telegram via the News module.
- Set `BRAVE_SEARCH_API_KEY` or `SERPER_API_KEY` for web search including Twitter/X mentions.
