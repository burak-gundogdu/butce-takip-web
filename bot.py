import os, requests, json, time, re, hashlib
from datetime import datetime, timezone

FIREBASE_API_KEY    = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL      = os.environ.get("FIREBASE_EMAIL")
FIREBASE_PASSWORD   = os.environ.get("FIREBASE_PASSWORD")
GROQ_API_KEY        = os.environ.get("GROQ_API_KEY")

UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
    "Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
]

def get_headers(i=0):
    return {
        "User-Agent": UA_LIST[i % len(UA_LIST)],
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "tr-TR,tr;q=0.9",
    }

def title_hash(title):
    clean = re.sub(r'\s+', ' ', title.lower().strip())[:80]
    return hashlib.md5(clean.encode('utf-8')).hexdigest()[:14]

def normalize_title(title):
    t = title.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    words = [w for w in t.split() if len(w) > 3]
    return set(words)

def is_similar(title1, title2, threshold=0.5):
    w1 = normalize_title(title1)
    w2 = normalize_title(title2)
    if not w1 or not w2:
        return False
    overlap = len(w1 & w2)
    smaller = min(len(w1), len(w2))
    return (overlap / smaller) >= threshold if smaller > 0 else False

def get_firebase_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    res = requests.post(url, json={"email":FIREBASE_EMAIL,"password":FIREBASE_PASSWORD,"returnSecureToken":True},timeout=10).json()
    if "idToken" not in res:
        raise Exception(f"Firebase giris basarisiz: {res}")
    return res["idToken"]

def fetch_og_image(url, timeout=5):
    if not url:
        return ""
    try:
        res = requests.get(url, headers={"User-Agent": UA_LIST[0]}, timeout=timeout)
        match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', res.text)
        if not match:
            match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', res.text)
        if match:
            img = match.group(1).strip()
            if img.startswith('//'):
                img = 'https:' + img
            return img
    except:
        pass
    return ""

def parse_rss_regex(xml_text, source_name, limit=10):
    items = []
    item_blocks = re.findall(r'<item[^>]*>(.*?)</item>', xml_text, re.DOTALL)
    if not item_blocks:
        item_blocks = re.findall(r'<entry[^>]*>(.*?)</entry>', xml_text, re.DOTALL)
    for block in item_blocks[:limit]:
        title_m = re.search(r'<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', block, re.DOTALL)
        if not title_m:
            continue
        title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()
        if not title or len(title) < 5:
            continue
        link_m = (
            re.search(r'<link[^>]*>(https?://[^\s<]+)</link>', block) or
            re.search(r'<link[^>]*href=["\']([^"\']+)["\']', block) or
            re.search(r'<guid[^>]*>(https?://[^\s<]+)</guid>', block)
        )
        url = link_m.group(1).strip() if link_m else ""
        desc_m = re.search(r'<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>', block, re.DOTALL)
        desc = re.sub(r'<[^>]+>', '', desc_m.group(1)).strip()[:200] if desc_m else ""
        img_m = (
            re.search(r'<enclosure[^>]+url=["\']([^"\']+\.(?:jpg|jpeg|png|webp))["\']', block, re.I) or
            re.search(r'<media:content[^>]+url=["\']([^"\']+)["\']', block)
        )
        img = img_m.group(1).strip() if img_m else ""
        items.append({"source":source_name,"title":title,"url":url,"description":desc,"image":img,"hash":title_hash(title)})
    return items

def fetch_rss_direct(name, url, ua_index=0, limit=10):
    try:
        res = requests.get(url, headers=get_headers(ua_index), timeout=15, allow_redirects=True)
        if res.status_code != 200:
            print(f"  [{name}] HTTP {res.status_code}")
            return []
        return parse_rss_regex(res.text, name, limit)
    except Exception as e:
        print(f"  [{name}] {type(e).__name__}: {str(e)[:60]}")
        return []

def fetch_all_news():
    all_items = []
    seen_hashes = set()
    seen_titles = [] 

    # --- KAYNAKLAR GÜNCELLENDİ (Ekonomi + Magazin + Influencer + Global) ---
    sources = [
        # Ekonomi & Borsa
        ("NTV Ekonomi",      "https://www.ntv.com.tr/ekonomi.rss",                      0),
        ("Bloomberg HT",     "https://www.bloomberght.com/rss",                         1),
        ("Haberturk Eko",    "https://www.haberturk.com/rss/kategori/ekonomi.xml",      2),
        ("Hurriyet Eko",     "https://www.hurriyet.com.tr/rss/ekonomi",                 3),
        
        # Global Haberler
        ("BBC Turkce",       "https://feeds.bbci.co.uk/turkce/rss.xml",                 0),
        
        # Teknoloji & Influencer & Youtuber Haberleri
        ("Webtekno",         "https://www.webtekno.com/rss.xml",                        1),
        ("ShiftDelete",      "https://shiftdelete.net/feed",                            2),
        
        # Magazin & Popüler Kültür
        ("Hurriyet Magazin", "https://www.hurriyet.com.tr/rss/magazin",                 3),
        ("Haberturk Magazin","https://www.haberturk.com/rss/kategori/magazin.xml",      0),
        ("Milliyet Magazin", "https://www.milliyet.com.tr/rss/rssNew/magazinRss.xml",   1),
        ("NTV Yasam",        "https://www.ntv.com.tr/yasam.rss",                        2),
        ("Onedio",           "https://onedio.com/support/rss.xml",                      3),
    ]

    for name, url, ua_idx in sources:
        items = fetch_rss_direct(name, url, ua_idx, limit=10) # Limit biraz artırıldı
        added = 0
        for item in items:
            if item["hash"] in seen_hashes:
                continue
            too_similar = False
            for seen_title in seen_titles:
                if is_similar(item["title"], seen_title, threshold=0.5):
                    too_similar = True
                    break
            if too_similar:
                continue
            seen_hashes.add(item["hash"])
            seen_titles.append(item["title"])
            all_items.append(item)
            added += 1
        print(f"  [{name}] {added} yeni benzersiz haber")
        time.sleep(0.4)

    print(f"\n  TOPLAM: {len(all_items)} tamamen benzersiz haber")
    return all_items

def get_existing_data(token):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=150"
    try:
        res = requests.get(url, headers={"Authorization":f"Bearer {token}"}, timeout=10).json()
        hashes = set()
        titles = []
        for doc in res.get("documents", []):
            f = doc.get("fields", {})
            h = f.get("titleHash", {}).get("stringValue", "")
            t = f.get("baslik",    {}).get("stringValue", "")
            if h: hashes.add(h)
            if t: titles.append(t)
        return hashes, titles
    except:
        return set(), []

def delete_old_news(token):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=150"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers, timeout=10).json()
        cutoff = time.time() - 86400
        deleted = 0
        for doc in res.get("documents", []):
            fields = doc.get("fields", {})
            if fields.get("tip",{}).get("stringValue","") != "haber":
                continue
            ts_str = fields.get("createdAt",{}).get("timestampValue","")
            if not ts_str: continue
            try:
                ts = time.mktime(time.strptime(ts_str[:19], '%Y-%m-%dT%H:%M:%S'))
                if ts < cutoff:
                    requests.delete(f"https://firestore.googleapis.com/v1/{doc['name']}", headers=headers, timeout=5)
                    deleted += 1
                    time.sleep(0.1)
            except: pass
        print(f"  {deleted} eski haber silindi")
    except Exception as e:
        print(f"  Silme hatasi: {e}")

def analyze_with_ai(news_items):
    if not news_items:
        return []

    lines = []
    for i in news_items:
        desc = f" | {i['description'][:80]}" if i.get('description') else ""
        lines.append(f"[{i['source']}] {i['title']}{desc} |URL={i.get('url','')}| |IMG={i.get('image','')}| HASH={i['hash']}")
    news_text = "\n".join(lines)

    # --- YAPAY ZEKA PROMPTU GÜNCELLENDİ ---
    count = min(15, len(news_items)) # 15 haber seçsin ki magazin ve globale yer kalsın
    prompt = f"""Sen uzman bir haber editorusun.
Asagidaki {len(news_items)} haberden EN ONEMLI ve DIKKAT CEKICI {count} tanesini sec.
Secimlerinde MUTLAKA su 3 ana kategoriden karma yapmalisin:
1. Turkiye Ekonomisi ve Borsa
2. Global Ekonomi ve Kuresel Haberler
3. Magazin, Sosyal Medya, Youtuber, Influencer ve Populer Kultur

SADECE JSON dizisi don - [ ile basla ] ile bit, baska hicbir sey yazma:

[{{
  "baslik": "Max 65 karakter etkileyici baslik",
  "icerik": "3 cumlelik detayli ozet. Magazin/sosyal medya haberiyse kimin ne yaptigini net yaz.",
  "analiz": "Okuyucu icin 2 cumlelik somut cikarim. (Orn: Bu olay su anlama geliyor...)",
  "etiket": "⭐ Magazin",
  "tip": "haber",
  "kaynak": "kaynak ismi",
  "url": "URL= den sonraki linki aynen kop",
  "image": "IMG= den sonraki linki aynen kop",
  "titleHash": "HASH= den sonraki degeri aynen kop"
}}]

Kullanabilecegin etiketler: 🟢 Pozitif | 🔴 Riskli | ⚪ Notr | 📊 Piyasa | 💰 Ekonomi | ⭐ Magazin | 📱 Sosyal Medya | 🔥 Fenomen
Tam {count} farkli konuda haber sec."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    try:
        res = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers=headers, timeout=60, json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role":"system","content":prompt},
                    {"role":"user","content":f"HABERLER:\n{news_text[:9000]}"}
                ],
                "temperature": 0.1, "max_tokens": 6000,
            }).json()

        raw = res["choices"][0]["message"]["content"]
clean = re.sub(r'`{3}[a-z]*\n?|`{3}|\*\*(.+?)\*\*', lambda m: m.group(1) or '', raw).strip()
http://googleusercontent.com/immersive_entry_chip/0

### Neler Değişti?
1. **Yeni RSS Kaynakları Eklendi:** Sadece ekonomiye saplanıp kalmaması için Webtekno, ShiftDelete (Fenomen/Teknoloji haberleri için harikadır), Onedio, Hürriyet Magazin ve Habertürk Magazin eklendi.
2. **Global Kaynak Eklendi:** Global sekmen dolsun diye listeye "BBC Türkçe"yi de yerleştirdim.
3. **Yapay Zeka Promptu Güncellendi:** Groq'a gönderilen talimatta yapay zekaya artık *"Mutlaka bu 3 kategoriden karma bir liste yap: 1. Türkiye Ekonomi, 2. Global, 3. Magazin/Youtuber/Sosyal Medya"* dedik.
4. **Etiketler Güncellendi:** Uygulama içinde filtreleme yapan etiketlere **"⭐ Magazin", "📱 Sosyal Medya", "🔥 Fenomen"** kavramları eklendi. 

Botunu tekrar çalıştırdığında (önceki koddan kalan eski ekonomi haberleriyle karışık olarak) yeni Magazin ve Global haberlerin sisteme düştüğünü göreceksin! Deneyip sonucu söylersen süper olur.