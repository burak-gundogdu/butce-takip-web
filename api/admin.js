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

  // NTV EKONOMI'DEN CANLI VERI CEKME (Google engelliyor, NTV engellemez)
  let newsContext = '';
  if (command?.toLowerCase().includes('haber') || command?.toLowerCase().includes('gundem') || command?.toLowerCase().includes('dolar') || command?.toLowerCase().includes('altin')) {
    try {
      const rssRes = await fetch('https://www.ntv.com.tr/ekonomi.rss');
      let rssText = await rssRes.text();
      // XML içindeki karmaşık yapıları temizle
      rssText = rssText.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
      const titles = [...rssText.matchAll(/<title>(.*?)<\/title>/g)]
        .slice(1, 15) // İlk ana başlığı atla, sonraki 14 güncel haberi al
        .map(m => m[1])
        .join('\n');
      newsContext = titles
        ? `\n\nCANLI HABER BASLIKLARI (BUNLAR GERCEKTIR, SADECE BUNLARI KULLAN):\n${titles}`
        : '';
    } catch { newsContext = ''; }
  }

  const ADMIN_SYSTEM = `Sen bir finansal uygulama yonetici asistanisin.
Lutfen SADECE ve SADECE asagidaki JSON formatlarindan birini don. JSON disinda (basinda veya sonunda) HICBIR metin, aciklama veya not yazma! Eger bana bir sey soylemek istersen bunu "mesaj" anahtarinin icine yaz.

1. Duyuru olusturmak icin:
{"tur":"duyuru", "baslik":"Gercek Haber Basligi", "icerik":"Detaylar", "tip":"info", "mesaj":"Duyuru eklendi"}

2. Sadece konusmak icin:
{"tur":"bilgi", "mesaj":"Sohbet cevabin"}

DIKKAT: Sadece { ile baslayip } ile biten veriyi gonder. Kendin uydurma haberler (Orn: Dolar 1000 TL, Savas cikti vb.) KESINLIKLE YAZMA. Sadece eger varsa CANLI HABER BASLIKLARI kismindaki gercek verileri kullan.
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