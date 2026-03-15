export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tickers } = req.method === 'POST' ? req.body : req.query;
  if (!tickers) return res.status(400).json({ error: 'tickers required' });

  const tickerList = (Array.isArray(tickers) ? tickers : tickers.split(','))
    .map(t => t.trim()).filter(Boolean);
  if (!tickerList.length) return res.status(400).json({ error: 'empty' });

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
  const prices = {};

  // Separate crypto (contains -USD) from stocks
  const cryptoTickers = tickerList.filter(t => t.includes('-USD'));
  const stockTickers  = tickerList.filter(t => !t.includes('-USD'));

  // ── Stocks: Yahoo v7 bulk ───────────────────────────────────────────────
  if (stockTickers.length) {
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(stockTickers.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose,shortName`;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const d = await r.json();
        for (const q of (d?.quoteResponse?.result || [])) {
          if (q.regularMarketPrice != null) {
            prices[q.symbol] = {
              price: q.regularMarketPrice,
              change: q.regularMarketChangePercent ?? null,
              prev: q.regularMarketPreviousClose ?? null,
              name: q.shortName ?? null,
            };
          }
        }
      }
    } catch {}

    // Fallback: v8 for missing stocks
    const missing = stockTickers.filter(t => !prices[t]);
    await Promise.all(missing.map(async (ticker) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`, { headers });
        if (!r.ok) return;
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          prices[ticker] = { price: meta.regularMarketPrice, change: null, prev: meta.chartPreviousClose ?? null, name: meta.longName ?? null };
        }
      } catch {}
    }));
  }

  // ── Crypto: Yahoo v8 chart (daha güvenilir kripto için) ─────────────────
  if (cryptoTickers.length) {
    await Promise.all(cryptoTickers.map(async (ticker) => {
      try {
        // v8 chart kripto için daha güvenilir
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`, { headers });
        if (!r.ok) return;
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          // Önceki fiyatı hesapla
          const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
          const prevClose = closes?.[closes.length - 2] ?? meta.chartPreviousClose;
          const change = prevClose && prevClose > 0
            ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100
            : null;
          prices[ticker] = {
            price: meta.regularMarketPrice,
            change: change !== null ? parseFloat(change.toFixed(2)) : null,
            prev: prevClose ?? null,
            name: meta.longName ?? ticker.replace('-USD',''),
          };
        }
      } catch {}
    }));
  }

  res.status(200).json({ prices, total: Object.keys(prices).length, requested: tickerList.length });
}
