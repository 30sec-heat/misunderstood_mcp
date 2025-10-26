import { NewsModule } from '../src/modules/news/index.js';

async function testTradFiNews() {
  console.log('Testing TradFi News Module...\n');

  const newsModule = new NewsModule();
  await newsModule.initialize();

  try {
    // Test 1: Get latest TradFi news
    console.log('1. Testing latest TradFi news...');
    const latestResult = await newsModule.callTool('news_get_tradfi_latest', {
      limit: 5,
      category: 'crypto'
    });
    console.log('Latest crypto news:', latestResult.message);
    console.log('Articles found:', latestResult.total);
    if (latestResult.articles && latestResult.articles.length > 0) {
      console.log('Sample article:', latestResult.articles[0].title);
    }
    console.log('');

    // Test 2: Search TradFi news
    console.log('2. Testing TradFi news search...');
    const searchResult = await newsModule.callTool('news_search_tradfi', {
      query: 'bitcoin',
      limit: 3,
      category: 'crypto'
    });
    console.log('Search result:', searchResult.message);
    console.log('Articles found:', searchResult.total);
    if (searchResult.articles && searchResult.articles.length > 0) {
      console.log('Sample article:', searchResult.articles[0].title);
    }
    console.log('');

    // Test 3: Get news by symbol
    console.log('3. Testing news by symbol...');
    const symbolResult = await newsModule.callTool('news_get_tradfi_by_symbol', {
      symbol: 'BTC',
      limit: 3
    });
    console.log('Symbol result:', symbolResult.message);
    console.log('Articles found:', symbolResult.total);
    if (symbolResult.articles && symbolResult.articles.length > 0) {
      console.log('Sample article:', symbolResult.articles[0].title);
    }
    console.log('');

    // Test 4: Get macro events
    console.log('4. Testing macro events...');
    const macroResult = await newsModule.callTool('news_get_macro_events', {
      limit: 3,
      includeCentralBank: true,
      includeRegulation: true
    });
    console.log('Macro result:', macroResult.message);
    console.log('Articles found:', macroResult.total);
    if (macroResult.articles && macroResult.articles.length > 0) {
      console.log('Sample article:', macroResult.articles[0].title);
    }
    console.log('');

    // Test 5: Get sources
    console.log('5. Testing sources...');
    const sourcesResult = await newsModule.callTool('news_get_tradfi_sources', {
      category: 'crypto',
      enabledOnly: true
    });
    console.log('Sources result:', sourcesResult.message);
    console.log('Sources found:', sourcesResult.total);
    if (sourcesResult.sources && sourcesResult.sources.length > 0) {
      console.log('Sample source:', sourcesResult.sources[0].name);
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await newsModule.destroy();
  }
}

// Run the test
testTradFiNews().catch(console.error);
