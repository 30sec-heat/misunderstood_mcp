import { TradFiNewsModule } from '../src/modules/news/tradfi.js';

async function testRSSFeeds() {
  console.log('Testing RSS Feeds...\n');

  const module = new TradFiNewsModule();
  await module.initialize();

  try {
    // Test getting sources
    console.log('1. Testing RSS sources...');
    const sourcesResult = await module.getSources({ category: 'all', enabledOnly: true });
    console.log(`Found ${sourcesResult.total} enabled sources:`);
    sourcesResult.sources.forEach(source => {
      console.log(`  - ${source.name} (${source.category}): ${source.description}`);
    });
    console.log('');

    // Test getting latest crypto news
    console.log('2. Testing latest crypto news...');
    const cryptoResult = await module.getLatestNews({
      limit: 5,
      category: 'crypto'
    });
    console.log(`Found ${cryptoResult.total} crypto articles from ${cryptoResult.sources.length} sources`);
    if (cryptoResult.articles.length > 0) {
      console.log('Sample articles:');
      cryptoResult.articles.slice(0, 3).forEach(article => {
        console.log(`  - ${article.title} (${article.source})`);
        console.log(`    ${article.url}`);
        console.log(`    Published: ${article.publishedAt}`);
        console.log(`    Sentiment: ${article.sentiment}`);
        console.log('');
      });
    }
    console.log('');

    // Test getting latest market news
    console.log('3. Testing latest market news...');
    const marketResult = await module.getLatestNews({
      limit: 5,
      category: 'markets'
    });
    console.log(`Found ${marketResult.total} market articles from ${marketResult.sources.length} sources`);
    if (marketResult.articles.length > 0) {
      console.log('Sample articles:');
      marketResult.articles.slice(0, 3).forEach(article => {
        console.log(`  - ${article.title} (${article.source})`);
        console.log(`    ${article.url}`);
        console.log(`    Published: ${article.publishedAt}`);
        console.log(`    Sentiment: ${article.sentiment}`);
        console.log('');
      });
    }
    console.log('');

    // Test search functionality
    console.log('4. Testing search functionality...');
    const searchResult = await module.searchNews({
      query: 'bitcoin',
      limit: 3,
      category: 'crypto'
    });
    console.log(`Found ${searchResult.total} articles matching "bitcoin"`);
    if (searchResult.articles.length > 0) {
      console.log('Search results:');
      searchResult.articles.forEach(article => {
        console.log(`  - ${article.title} (${article.source})`);
        console.log(`    ${article.url}`);
        console.log('');
      });
    }
    console.log('');

    // Test symbol search
    console.log('5. Testing symbol search...');
    const symbolResult = await module.getNewsBySymbol({
      symbol: 'BTC',
      limit: 3
    });
    console.log(`Found ${symbolResult.total} articles for BTC`);
    if (symbolResult.articles.length > 0) {
      console.log('Symbol results:');
      symbolResult.articles.forEach(article => {
        console.log(`  - ${article.title} (${article.source})`);
        console.log(`    ${article.url}`);
        console.log('');
      });
    }
    console.log('');

    // Test macro events
    console.log('6. Testing macro events...');
    const macroResult = await module.getMacroEvents({
      limit: 3,
      includeCentralBank: true,
      includeRegulation: true
    });
    console.log(`Found ${macroResult.total} macro articles`);
    if (macroResult.articles.length > 0) {
      console.log('Macro results:');
      macroResult.articles.forEach(article => {
        console.log(`  - ${article.title} (${article.source})`);
        console.log(`    ${article.url}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await module.destroy();
  }
}

// Run the test
testRSSFeeds().catch(console.error);
