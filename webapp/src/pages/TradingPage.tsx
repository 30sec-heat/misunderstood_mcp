import { useState } from 'react';
import { Card } from '../components/shared/Card';
import { placeMarketOrder, type RelayResult } from '../lib/trading-client';
import { loadKeysVault } from '../lib/keys-vault';

export function TradingPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('0.001');
  const [exchange, setExchange] = useState<'binance' | 'bybit'>('binance');
  const [marketType, setMarketType] = useState<'spot' | 'futures'>('spot');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RelayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vault = loadKeysVault();
  const hasBinance = !!vault.exchange.binance?.apiKey && !!vault.exchange.binance?.secret;
  const hasBybit = !!vault.exchange.bybit?.apiKey && !!vault.exchange.bybit?.secret;
  const canTrade = (exchange === 'binance' && hasBinance) || (exchange === 'bybit' && hasBybit);

  const handlePlaceOrder = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await placeMarketOrder({
        exchange,
        symbol,
        side,
        amount: parseFloat(amount) || 0,
        marketType,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Trading / Orders</h2>
        <p className="text-sm text-dark-muted">
          Place orders using keys from the Keys Vault. Orders are signed in your browser; only the signed payload is
          sent to the server relay. The server never has your API keys.
        </p>
      </div>

      {!canTrade && (
        <Card className="border-accent-warning/50 bg-accent-warning/10">
          <p className="text-sm">
            No API keys for {exchange}. Add keys in <strong>Settings → Keys Vault</strong>.
          </p>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Exchange</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as 'binance' | 'bybit')}
              className="w-full rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 text-sm"
            >
              <option value="binance">Binance {hasBinance ? '✓' : ''}</option>
              <option value="bybit">Bybit {hasBybit ? '✓' : ''}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Market</label>
            <select
              value={marketType}
              onChange={(e) => setMarketType(e.target.value as 'spot' | 'futures')}
              className="w-full rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 text-sm"
            >
              <option value="spot">Spot</option>
              <option value="futures">Futures</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTCUSDT"
            className="w-full rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 font-mono text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Side</label>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as 'buy' | 'sell')}
              className="w-full rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 text-sm"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Amount</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.001"
              className="w-full rounded-sharp bg-dark-surface border border-dark-border px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>
        <button
          onClick={handlePlaceOrder}
          disabled={loading || !canTrade}
          className="w-full py-2.5 rounded-sharp bg-accent-cyan text-dark font-semibold text-sm hover:bg-accent-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Placing order...' : `Place ${side.toUpperCase()} Market Order`}
        </button>
      </Card>

      {result && (
        <Card className="border-accent-positive/30">
          <h3 className="text-sm font-semibold mb-2 text-accent-positive">Order Result</h3>
          <pre className="text-xs font-mono overflow-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Card>
      )}
      {error && (
        <Card className="border-accent-negative/50">
          <p className="text-sm text-accent-negative">{error}</p>
        </Card>
      )}

      <Card className="text-xs text-dark-muted">
        <p className="font-semibold mb-1">Architecture</p>
        <p>
          MCP server tools for trading are read-only (ticker, orderbook, trades). Order execution happens here:
          keys stay in the browser, you sign locally, and only the signed request is relayed to the exchange.
        </p>
      </Card>
    </div>
  );
}
