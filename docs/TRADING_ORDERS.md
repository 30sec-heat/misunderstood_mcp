# Trading Order Execution Pattern

## Security: API Keys Never Touch the Server

Trading API keys (Binance, Bybit, exchange keys, order execution keys) are **client-side only**. The server **NEVER** accepts or stores them.

## Execute Order Endpoint

**POST /api/execute-order**

```json
{
  "provider": "binance",
  "payload": { /* pre-signed order data from client */ }
}
```

- `provider`: Exchange identifier (e.g. `binance`, `bybit`)
- `payload`: Pre-signed order data. The client signs the order using its own API keys in the browser. The server receives only the signed payload.

## Two Implementation Options

1. **Server forwards**: Server receives the pre-signed payload and forwards it to the exchange. The exchange validates the signature; the server never sees the secret key.

2. **Client calls exchange directly**: The client calls the exchange API from the browser. The server returns instructions or a proxy URL; the client performs the actual request with its keys.

## Example Client Flow

```javascript
// Client signs order locally with user's API keys
const signedPayload = await signOrder(orderParams, userApiKey, userSecret);

// Send only the signed payload to server
await fetch('/api/execute-order', {
  method: 'POST',
  body: JSON.stringify({ provider: 'binance', payload: signedPayload })
});
```
