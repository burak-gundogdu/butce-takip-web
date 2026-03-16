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

  // GROQ yerine GEMINI kullanıyoruz
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini key yok (Vercel Env Variables icine GEMINI_API_KEY ekleyin)' });

  const { command } = req.body;

  // Haber cekme komutu (BBC RSS linki güncellendi)
  let newsContext = '';
  if (command?.toLowerCase().includes('haber') || command?.toLowerCase().includes('gundem')) {
    try {
      const rssRes = await fetch('https://feeds.bbci.co.uk/turkce/rss.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const rssText = await rssRes.text();
      // Guvenli Regex ile basliklari cek
      const titles = [...rssText.matchAll(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)]
        .slice(0, 8).map(m => m[1]).join('\n');
      newsContext = titles
        ? `\n\nSon dakika haberler (BBC Turkce):\n${titles}`
        : '';
    } catch { newsContext = ''; }
  }

  const ADMIN_SYSTEM = `Sen bir finansal uygulama yonetici asistanisin.
KRITIK KURAL: Yanıtin SADECE gecerli bir JSON objesi olmali. ** kullanma. Markdown kullanma. Kod blogu kullanma.
Yanıt MUTLAKA { ile baslamali } ile bitmeli. Baska hicbir karakter olmamali.

Formatlar:
{"tur":"duyuru","baslik":"Baslik","icerik":"Detay","tip":"info","mesaj":"ne yapildi"}
{"tur":"haber","baslik":"Baslik","icerik":"Ozet","kaynak":"Kaynak adi","mesaj":"ne yapildi"}
{"tur":"sistem","baslik":"Baslik","icerik":"Mesaj","mesaj":"ne yapildi"}
{"tur":"bilgi","mesaj":"Cevap"}

tip: info | uyari | guncelleme
${newsContext}`;

  try {
    // Sürüm dertsiz, dogrudan GEMINI REST API baglantisi
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ parts: [{ text: `${ADMIN_SYSTEM}\n\nKullanici Komutu: ${command}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json" // Sadece temiz JSON dondurmesini garanti eder
      }
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const geminiData = await geminiRes.json();
    if (geminiData.error) throw new Error(geminiData.error.message);
    
    // Gemini'nin yanitini cikar
    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // JSON'u metinden guvenlice cikart (responseMimeType kullandigimiz icin genelde direk temiz gelir ama garantiye alalim)
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Parse basarisizsa (ki cok zor) duz metin olarak geri don
      parsed = { tur: 'bilgi', mesaj: text || 'Yanit alinamadi' };
    }
    
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}