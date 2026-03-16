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

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';
  const headers = { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' };
  const prices = {};

  const cryptoTickers = tickerList.filter(t => t.includes('-USD'));
  const stockTickers  = tickerList.filter(t => !t.includes('-USD'));

  // ── Hisseler: Yahoo v7 bulk ─────────────────────────────────────────────
  if (stockTickers.length) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const host = attempt === 0 ? 'query1' : 'query2';
        const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(stockTickers.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose,shortName`;
        const r = await fetch(url, { headers });
        if (!r.ok) continue;
        const d = await r.json();
        for (const q of (d?.quoteResponse?.result || [])) {
          if (q.regularMarketPrice != null && !prices[q.symbol]) {
            prices[q.symbol] = {
              price: q.regularMarketPrice,
              change: q.regularMarketChangePercent ?? null,
              prev: q.regularMarketPreviousClose ?? null,
              name: q.shortName ?? null,
            };
          }
        }
        if (Object.keys(prices).length > 0) break;
      } catch {}
    }

    // v8 fallback for missing stocks
    const missing = stockTickers.filter(t => !prices[t]);
    await Promise.all(missing.map(async (ticker) => {
      for (const host of ['query1', 'query2']) {
        try {
          const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`, { headers });
          if (!r.ok) continue;
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice != null) {
            prices[ticker] = { price: meta.regularMarketPrice, change: null, prev: meta.chartPreviousClose ?? null, name: null };
            break;
          }
        } catch {}
      }
    }));
  }

  // ── Kripto: CoinGecko API (ücretsiz, CORS ok, Vercel'den çalışır) ───────
  if (cryptoTickers.length) {
    // BTC-USD -> bitcoin, ETH-USD -> ethereum eşleştirmesi
    const COINGECKO_IDS = {
      'BTC-USD':'bitcoin','ETH-USD':'ethereum','BNB-USD':'binancecoin',
      'SOL-USD':'solana','XRP-USD':'ripple','ADA-USD':'cardano',
      'AVAX-USD':'avalanche-2','DOGE-USD':'dogecoin','DOT-USD':'polkadot',
      'MATIC-USD':'matic-network','LINK-USD':'chainlink','UNI-USD':'uniswap',
      'LTC-USD':'litecoin','ATOM-USD':'cosmos','XLM-USD':'stellar',
      'ALGO-USD':'algorand','VET-USD':'vechain','FIL-USD':'filecoin',
      'TRX-USD':'tron','NEAR-USD':'near',
    };

    const cgIds = cryptoTickers.map(t => COINGECKO_IDS[t]).filter(Boolean);

    if (cgIds.length) {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd&include_24hr_change=true&precision=8`;
        const r = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        if (r.ok) {
          const data = await r.json();
          // CoinGecko id -> ticker eşleştir
          const idToTicker = Object.fromEntries(
            Object.entries(COINGECKO_IDS).map(([t, id]) => [id, t])
          );
          for (const [cgId, info] of Object.entries(data)) {
            const ticker = idToTicker[cgId];
            if (ticker && info.usd != null) {
              prices[ticker] = {
                price: info.usd,
                change: info.usd_24h_change ?? null,
                prev: null,
                name: cgId,
              };
            }
          }
        }
      } catch {}
    }

    // CoinGecko başarısız olanlar için Yahoo v8 dene
    const cgMissing = cryptoTickers.filter(t => !prices[t]);
    await Promise.all(cgMissing.map(async (ticker) => {
      for (const host of ['query1', 'query2']) {
        try {
          const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`, { headers });
          if (!r.ok) continue;
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice != null) {
            const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
            const prev = closes[closes.length - 2] ?? null;
            const chg = prev ? ((meta.regularMarketPrice - prev) / prev * 100) : null;
            prices[ticker] = { price: meta.regularMarketPrice, change: chg ? parseFloat(chg.toFixed(2)) : null, prev, name: ticker.replace('-USD','') };
            break;
          }
        } catch {}
      }
    }));
  }

  res.status(200).json({ prices, total: Object.keys(prices).length, requested: tickerList.length });
}
