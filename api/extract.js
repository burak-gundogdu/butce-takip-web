import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL gerekli' });
  }

  try {
    // Haber sitesine gidip sayfanın HTML kodunu alıyoruz
    const response = await fetch(url);
    const html = await response.text();
    
    // Cheerio ile HTML'i parçalıyoruz
    const $ = cheerio.load(html);
    
    // Sitedeki tüm <p> (paragraf) etiketlerini bulup metinlerini birleştiriyoruz
    // Haber sitelerinin %90'ı haberi <p> etiketleri içine yazar
    let articleText = '';
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) { // Menü veya footer yazıları gelmesin diye 50 karakter sınırı
        articleText += text + '\n\n';
      }
    });

    if (!articleText) {
      articleText = "Haber metni bu siteden otomatik olarak çekilemedi. Lütfen orijinal kaynağına gidiniz.";
    }

    res.status(200).json({ text: articleText });
  } catch (error) {
    res.status(500).json({ error: 'Haber çekilirken bir hata oluştu' });
  }
}