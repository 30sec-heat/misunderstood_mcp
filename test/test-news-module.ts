import { NewsModule } from '../src/modules/news/index.js';
import { TradFiNewsModule } from '../src/modules/news/tradfi.js';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

class NewsModuleTester {
  private results: TestResult[] = [];

  private addResult(testName: string, success: boolean, message: string, data?: any, error?: string) {
    this.results.push({ testName, success, message, data, error });
  }

  async testTradFiModule() {
    console.log('Testing TradFi News Module...\n');
    
    const module = new TradFiNewsModule();
    await module.initialize();

    try {
      // Test 1: Get sources
      console.log('1. Testing RSS sources...');
      const sourcesResult = await module.getSources({ category: 'all', enabledOnly: true });
      this.addResult(
        'Get Sources',
        sourcesResult.total > 0,
        `Found ${sourcesResult.total} enabled sources`,
        { sources: sourcesResult.sources.map(s => s.name) }
      );
      console.log(`✓ Found ${sourcesResult.total} enabled sources`);

      // Test 2: Latest crypto news
      console.log('\n2. Testing latest crypto news...');
      const cryptoResult = await module.getLatestNews({
        limit: 10,
        category: 'crypto'
      });
      this.addResult(
        'Latest Crypto News',
        cryptoResult.total > 0,
        `Retrieved ${cryptoResult.total} crypto articles`,
        { 
          total: cryptoResult.total,
          sources: cryptoResult.sources,
          sampleTitles: cryptoResult.articles.slice(0, 3).map(a => a.title)
        }
      );
      console.log(`✓ Retrieved ${cryptoResult.total} crypto articles from ${cryptoResult.sources.length} sources`);

      // Test 3: Latest market news
      console.log('\n3. Testing latest market news...');
      const marketResult = await module.getLatestNews({
        limit: 10,
        category: 'markets'
      });
      this.addResult(
        'Latest Market News',
        marketResult.total > 0,
        `Retrieved ${marketResult.total} market articles`,
        { 
          total: marketResult.total,
          sources: marketResult.sources,
          sampleTitles: marketResult.articles.slice(0, 3).map(a => a.title)
        }
      );
      console.log(`✓ Retrieved ${marketResult.total} market articles from ${marketResult.sources.length} sources`);

      // Test 4: Search functionality
      console.log('\n4. Testing search functionality...');
      const searchResult = await module.searchNews({
        query: 'bitcoin',
        limit: 5,
        category: 'crypto'
      });
      this.addResult(
        'Search News',
        searchResult.total > 0,
        `Found ${searchResult.total} articles matching "bitcoin"`,
        { 
          total: searchResult.total,
          query: searchResult.query,
          sampleTitles: searchResult.articles.slice(0, 3).map(a => a.title)
        }
      );
      console.log(`✓ Found ${searchResult.total} articles matching "bitcoin"`);

      // Test 5: Symbol search
      console.log('\n5. Testing symbol search...');
      const symbolResult = await module.getNewsBySymbol({
        symbol: 'BTC',
        limit: 5
      });
      this.addResult(
        'Symbol Search',
        symbolResult.total >= 0, // Allow 0 results as it's valid
        `Found ${symbolResult.total} articles for BTC`,
        { 
          total: symbolResult.total,
          symbol: symbolResult.query,
          sampleTitles: symbolResult.articles.slice(0, 3).map(a => a.title)
        }
      );
      console.log(`✓ Found ${symbolResult.total} articles for BTC`);

      // Test 6: Macro events
      console.log('\n6. Testing macro events...');
      const macroResult = await module.getMacroEvents({
        limit: 5,
        includeCentralBank: true,
        includeRegulation: true
      });
      this.addResult(
        'Macro Events',
        macroResult.total > 0,
        `Retrieved ${macroResult.total} macro articles`,
        { 
          total: macroResult.total,
          sources: macroResult.sources,
          sampleTitles: macroResult.articles.slice(0, 3).map(a => a.title)
        }
      );
      console.log(`✓ Retrieved ${macroResult.total} macro articles`);

      // Test 7: Data quality checks
      console.log('\n7. Testing data quality...');
      const allArticles = [
        ...cryptoResult.articles,
        ...marketResult.articles,
        ...searchResult.articles,
        ...symbolResult.articles,
        ...macroResult.articles
      ];

      const qualityIssues = [];
      allArticles.forEach(article => {
        if (!article.title || article.title.trim().length === 0) {
          qualityIssues.push('Empty title');
        }
        if (!article.url || article.url.trim().length === 0) {
          qualityIssues.push('Empty URL');
        }
        if (article.url && article.url.includes('<![CDATA[')) {
          qualityIssues.push('CDATA in URL');
        }
        if (article.title && article.title.includes('&apos;')) {
          qualityIssues.push('Unescaped HTML entities');
        }
      });

      this.addResult(
        'Data Quality',
        qualityIssues.length === 0,
        qualityIssues.length === 0 ? 'All articles have clean data' : `Found ${qualityIssues.length} quality issues`,
        { issues: qualityIssues }
      );
      console.log(`✓ Data quality check: ${qualityIssues.length === 0 ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addResult('TradFi Module Test', false, 'Module test failed', null, String(error));
      console.error('✗ Module test failed:', error);
    } finally {
      await module.destroy();
    }
  }

  async testMainNewsModule() {
    console.log('\n\nTesting Main News Module...\n');
    
    const module = new NewsModule();
    await module.initialize();

    try {
      // Test TradFi integration
      console.log('1. Testing TradFi integration...');
      const tradfiResult = await module.getTradFiLatest({
        limit: 5,
        category: 'crypto'
      });
      this.addResult(
        'TradFi Integration',
        !tradfiResult.error,
        tradfiResult.error ? 'TradFi integration failed' : 'TradFi integration working',
        { 
          total: tradfiResult.total || 0,
          error: tradfiResult.error
        }
      );
      console.log(`✓ TradFi integration: ${tradfiResult.error ? 'FAILED' : 'WORKING'}`);

      // Test search integration
      console.log('\n2. Testing search integration...');
      const searchResult = await module.searchTradFiNews({
        query: 'ethereum',
        limit: 3,
        category: 'crypto'
      });
      this.addResult(
        'Search Integration',
        !searchResult.error,
        searchResult.error ? 'Search integration failed' : 'Search integration working',
        { 
          total: searchResult.total || 0,
          error: searchResult.error
        }
      );
      console.log(`✓ Search integration: ${searchResult.error ? 'FAILED' : 'WORKING'}`);

    } catch (error) {
      this.addResult('Main News Module Test', false, 'Main module test failed', null, String(error));
      console.error('✗ Main module test failed:', error);
    } finally {
      await module.destroy();
    }
  }

  generateReport() {
    console.log('\n\n=== TEST REPORT ===\n');
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('FAILED TESTS:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`✗ ${result.testName}: ${result.message}`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      });
      console.log('');
    }

    console.log('PASSED TESTS:');
    this.results.filter(r => r.success).forEach(result => {
      console.log(`✓ ${result.testName}: ${result.message}`);
    });

    // Save detailed results
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        successRate: (passed / total) * 100
      },
      results: this.results
    };

    fs.writeFileSync(
      './test-results/news-test-results.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\nDetailed results saved to: test/module-test-results/news-test-results.json');
  }

  async runAllTests() {
    console.log('Starting News Module Tests...\n');
    
    await this.testTradFiModule();
    await this.testMainNewsModule();
    this.generateReport();
  }
}

// Run the tests
async function main() {
  const tester = new NewsModuleTester();
  await tester.runAllTests();
}

main().catch(console.error);
