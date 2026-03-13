export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Sadece admin token kabul et
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

  // Haber cekme komutu
  let newsContext = '';
  if (command?.toLowerCase().includes('haber') || command?.toLowerCase().includes('gundem')) {
    try {
      const rssRes = await fetch('https://feeds.bbcturkce.com/bbcturkce/rss.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const rssText = await rssRes.text();
      const titles = [...rssText.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>/g)]
        .slice(0, 8).map(m => m[1]).join('\n');
      newsContext = titles
        ? `\n\nSon dakika haberler (BBC Turkce):\n${titles}`
        : '';
    } catch { newsContext = ''; }
  }

  const ADMIN_SYSTEM = `Sen bir finansal uygulama yonetici asistanisin. Turkce konusursun.
Asagidaki islemleri yapabilirsin:

1. Duyuru olustur:
{"tur":"duyuru","baslik":"Baslik","icerik":"Detay","tip":"info"|"uyari"|"guncelleme"}

2. Haber paylas (RSS'den cekilmis haberlerden birini sec):
{"tur":"haber","baslik":"Haber basligi","icerik":"Kisa ozet","kaynak":"BBC Turkce"}

3. Sistem mesaji:
{"tur":"sistem","baslik":"Baslik","icerik":"Mesaj"}

4. Sadece konusmak istiyorsan:
{"tur":"bilgi","mesaj":"Cevabın buraya"}

Her zaman gecerli JSON don. Markdown veya kod blogu kullanma.
Duyuru veya haber olusturuldugunda mesaj alanina da ne yaptigini yaz.
${newsContext}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 800,
        temperature: 0.2,
        messages: [
          { role: 'system', content: ADMIN_SYSTEM },
          { role: 'user', content: command },
        ],
      }),
    });
    const groqData = await groqRes.json();
    if (groqData.error) throw new Error(groqData.error.message);
    const text = groqData.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      // Eğer yapay zeka JSON dönmeyi unutup düz metin verirse sistemi çökertme,
      // metni alıp 'bilgi' formatında normal bir asistan mesajıymış gibi göster.
      parsed = { tur: 'bilgi', mesaj: clean };
    }
    
    res.status(200).json(parsed);
  }
}
