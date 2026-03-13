export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Yetkisiz' });
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const verifyData = await verifyRes.json();
    const uid = verifyData.users?.[0]?.localId;
    if (uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  } catch { return res.status(401).json({ error: 'Token dogrulanamadi' }); }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Groq key yok' });

  const { command } = req.body;

  // 1. CANLI DOLAR KURUNU YAHOO'DAN ÇEK
  let finansContext = '';
  try {
    const yfRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X');
    const yfData = await yfRes.json();
    const price = yfData.chart.result[0].meta.regularMarketPrice;
    if (price) {
      finansContext = `SU ANKI GERCEK DOLAR KURU: 1 USD = ${price.toFixed(2)} TL. (Dolar sorulursa KESINLIKLE bu gercek rakami kullan)`;
    }
  } catch { }

  // 2. TÜRKİYE HABERLERİNİ "KÖPRÜ" İLE ÇEK (TRT Ekonomi -> rss2json)
  let newsContext = '';
  if (command?.toLowerCase().includes('haber') || command?.toLowerCase().includes('gundem') || command?.toLowerCase().includes('ekonomi')) {
    try {
      // Doğrudan TRT'ye gitmek yerine rss2json köprüsünü kullanıyoruz. Siteler bunu engellemez.
      const rssRes = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.trthaber.com/ekonomi_articles.rss');
      const rssData = await rssRes.json();
      
      if (rssData.status === 'ok') {
        const titles = rssData.items.slice(0, 10).map(item => item.title).join('\n');
        newsContext = titles
          ? `\nCANLI TURKIYE EKONOMI HABERLERI:\n${titles}\nGOREVIN: Sadece bu gercek haberlerden birini secerek duyuru olustur. Asla kafandan haber uydurma.`
          : '';
      }
    } catch { }
  }

  const ADMIN_SYSTEM = `Sen bir finansal uygulama yonetici asistanisin.
Lutfen SADECE ve SADECE asagidaki JSON formatlarindan birini don. JSON disinda HICBIR metin yazma! Eger bana bir sey soylemek istersen bunu "mesaj" icine yaz.

1. Duyuru olusturmak icin:
{"tur":"duyuru", "baslik":"Gercek Haber Basligi", "icerik":"Detaylar", "tip":"info", "mesaj":"Duyuru eklendi"}

2. Sadece konusmak icin:
{"tur":"bilgi", "mesaj":"Sohbet cevabin"}

DIKKAT: Sadece { ile baslayip } ile biten veriyi gonder. Kendin uydurma haberler KESINLIKLE YAZMA.
${finansContext}
${newsContext}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 800,
        temperature: 0.1, 
        messages: [
          { role: 'system', content: ADMIN_SYSTEM },
          { role: 'user', content: command },
        ],
      }),
    });
    const groqData = await groqRes.json();
    if (groqData.error) throw new Error(groqData.error.message);
    
    let text = groqData.choices?.[0]?.message?.content || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      parsed = { tur: 'bilgi', mesaj: text };
    }
    
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}