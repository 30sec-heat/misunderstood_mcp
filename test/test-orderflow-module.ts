/**
 * Test OrderFlow module tools
 */
import { OrderFlowModule } from '../src/modules/orderflow/index.js';

async function main() {
  const module = new OrderFlowModule();
  await module.initialize();

  console.log('Testing get_orderflow_glossary...');
  const glossaryResult = await module.executeTool('get_orderflow_glossary', {});
  console.log(JSON.stringify(glossaryResult, null, 2).slice(0, 500) + '...');
  console.log('Glossary terms:', (glossaryResult as any)?.content?.[0]?.text ? 'OK' : 'Check format');

  console.log('\nTesting get_ohlcv_history (small)...');
  let ohlcvResult = await module.executeTool('get_ohlcv_history', {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    limit: 50,
  });
  let ohlcv = (ohlcvResult as any)?.content?.[0]?.text;
  let parsed = ohlcv ? JSON.parse(ohlcv) : null;
  console.log('Bars count:', parsed?.count ?? parsed?.error ?? 'N/A');
  console.log('Sample bar:', parsed?.bars?.[0] ?? 'N/A');

  console.log('\nTesting get_ohlcv_history (1500 bars, pagination)...');
  ohlcvResult = await module.executeTool('get_ohlcv_history', {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    limit: 1500,
  });
  ohlcv = (ohlcvResult as any)?.content?.[0]?.text;
  parsed = ohlcv ? JSON.parse(ohlcv) : null;
  console.log('Bars count (paginated):', parsed?.count ?? parsed?.error ?? 'N/A');

  console.log('\nTesting technical_detect_fvg...');
  const fvgResult = await module.executeTool('technical_detect_fvg', {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    limit: 100,
  });
  const fvg = (fvgResult as any)?.content?.[0]?.text;
  const fvgParsed = fvg ? JSON.parse(fvg) : null;
  console.log('FVGs found:', fvgParsed?.totalFvgs ?? fvgParsed?.error ?? 'N/A');

  console.log('\nTesting get_symbol_correlation...');
  const corrResult = await module.executeTool('get_symbol_correlation', {
    symbol1: 'BTCUSDT',
    symbol2: 'ETHUSDT',
    timeframe: '1h',
    limit: 100,
  });
  const corr = (corrResult as any)?.content?.[0]?.text;
  const corrParsed = corr ? JSON.parse(corr) : null;
  console.log('Correlation:', corrParsed?.correlation ?? corrParsed?.error ?? 'N/A');

  await module.cleanup();
  console.log('\nAll tests completed.');
}

main().catch(console.error);
