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
  const headers = { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' };
  const prices = {};

  // Method 1: Yahoo v7 bulk (query1)
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tickerList.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose,shortName`;
    const r = await fetch(url, { headers });
    if (r.ok) {
      const d = await r.json();
      for (const q of (d?.quoteResponse?.result || [])) {
        if (q.regularMarketPrice) prices[q.symbol] = { price: q.regularMarketPrice, change: q.regularMarketChangePercent ?? null, prev: q.regularMarketPreviousClose ?? null, name: q.shortName ?? null };
      }
    }
  } catch {}

  // Method 2: Yahoo v7 bulk (query2) - missing ones
  const miss1 = tickerList.filter(t => !prices[t]);
  if (miss1.length) {
    try {
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(miss1.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,shortName`;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const d = await r.json();
        for (const q of (d?.quoteResponse?.result || [])) {
          if (q.regularMarketPrice && !prices[q.symbol]) prices[q.symbol] = { price: q.regularMarketPrice, change: q.regularMarketChangePercent ?? null, prev: null, name: q.shortName ?? null };
        }
      }
    } catch {}
  }

  // Method 3: v8 chart - still missing, parallel
  const miss2 = tickerList.filter(t => !prices[t]);
  if (miss2.length) {
    await Promise.all(miss2.map(async (ticker) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`, { headers });
        if (!r.ok) return;
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) prices[ticker] = { price: meta.regularMarketPrice, change: meta.regularMarketChangePercent ?? null, prev: meta.chartPreviousClose ?? null, name: meta.longName ?? null };
      } catch {}
    }));
  }

  res.status(200).json({ prices, total: Object.keys(prices).length, requested: tickerList.length });
}
