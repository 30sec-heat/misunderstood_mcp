import { useState } from 'react';

export function AgentPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setInput('');
    // Placeholder: simulate agent response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Received: "${input}". Connect to MCP backend to invoke tools (polymarket, sentiment, chart, trading, etc.).`,
        },
      ]);
    }, 500);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-dark-muted">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">MCP Crypto Agent</h3>
            <p className="text-sm text-center max-w-md">
              Ask questions about markets, sentiment, charts, or invoke trading tools. The agent uses 100+ MCP tools
              across polymarket, news, DeFi, and more.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {['BTC price', 'Polymarket odds', 'Sentiment for ETH', 'DeFi TVL'].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 rounded-sharp bg-dark-surface border border-dark-border text-sm hover:border-accent-cyan/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-card px-4 py-2 ${
                  m.role === 'user'
                    ? 'bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan'
                    : 'card-base text-gray-300'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-dark-border p-4 md:p-6 bg-dark-elevated">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about markets, sentiment, charts..."
            className="flex-1 rounded-sharp bg-dark-surface border border-dark-border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan focus:border-accent-cyan placeholder:text-dark-muted"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-sharp bg-accent-cyan text-dark font-semibold text-sm hover:bg-accent-cyan/90 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
