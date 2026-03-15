export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // tickers: comma separated, e.g. "THYAO.IS,GARAN.IS,XU100.IS"
  const { tickers } = req.method === 'POST' ? req.body : req.query;
  if (!tickers) return res.status(400).json({ error: 'tickers required' });

  const tickerList = (Array.isArray(tickers) ? tickers : tickers.split(',')).map(t => t.trim()).filter(Boolean);
  if (tickerList.length === 0) return res.status(400).json({ error: 'empty tickers' });

  try {
    // Yahoo Finance v7 quote endpoint - toplu sorgu destekliyor
    const symbolsParam = tickerList.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsParam)}&fields=regularMarketPrice,shortName,regularMarketChangePercent`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];

    const prices = {};
    for (const q of quotes) {
      const sym = q.symbol;
      prices[sym] = {
        price: q.regularMarketPrice ?? null,
        change: q.regularMarketChangePercent ?? null,
        name: q.shortName ?? null,
      };
    }

    res.status(200).json({ prices });
  } catch (e) {
    // Fallback: tek tek cek
    const prices = {};
    for (const ticker of tickerList.slice(0, 20)) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
        if (price) prices[ticker] = { price, change: null, name: null };
      } catch {}
    }
    res.status(200).json({ prices });
  }
}
