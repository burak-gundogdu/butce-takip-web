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
    """Benzerligi karsilastirmak icin basligi normalize et"""
    t = title.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    # Cok kisa kelimeleri kaldir
    words = [w for w in t.split() if len(w) > 3]
    return set(words)

def is_similar(title1, title2, threshold=0.5):
    """Iki baslik yeterince benzer mi? Kelime overlap kontrolu"""
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
    """Haberin og:image'ini cek"""
    if not url:
        return ""
    try:
        res = requests.get(url, headers={"User-Agent": UA_LIST[0]}, timeout=timeout)
        # og:image bul
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
        # Resim: once enclosure, sonra media:content
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
    seen_titles = []  # Benzerlik kontrolu icin

    sources = [
        ("NTV Ekonomi",      "https://www.ntv.com.tr/ekonomi.rss",                       0),
        ("TRT Ekonomi",      "https://www.trthaber.com/ekonomi_articles.rss",             1),
        ("Sabah Ekonomi",    "https://www.sabah.com.tr/rss/ekonomi.xml",                  2),
        ("Haberturk",        "https://www.haberturk.com/rss/kategori/ekonomi.xml",        3),
        ("Hurriyet Ekonomi", "https://www.hurriyet.com.tr/rss/ekonomi",                   0),
        ("Milliyet Ekonomi", "https://www.milliyet.com.tr/rss/rssNew/ekonomiRss.xml",     1),
        ("Dunya Gazetesi",   "https://www.dunya.com/rss/ekonomi.xml",                     2),
        ("Bloomberg HT",     "https://www.bloomberght.com/rss",                           3),
        ("Para Analiz",      "https://www.paraanaliz.com/feed/",                          0),
        ("Borsagundem",      "https://www.borsagundem.com/rss",                           1),
        ("Sozcu Ekonomi",    "https://www.sozcu.com.tr/rss/ekonomi.xml",                  2),
        ("Takvim Ekonomi",   "https://www.takvim.com.tr/rss/ekonomi.xml",                 3),
        ("Ensonhaber",       "https://www.ensonhaber.com/rss/ekonomi.xml",                0),
        ("A Haber Ekonomi",  "https://www.ahaber.com.tr/rss/ekonomi.xml",                 1),
        ("Isyatirim",        "https://www.isyatirim.com.tr/haber/rss",                    2),
        ("Bigpara",          "https://bigpara.hurriyet.com.tr/rss/",                      3),
    ]

    for name, url, ua_idx in sources:
        items = fetch_rss_direct(name, url, ua_idx, limit=8)
        added = 0
        for item in items:
            # Hash duplikat kontrolu
            if item["hash"] in seen_hashes:
                continue
            # Semantik benzerlik kontrolu — ayni haberin farkli kaynaktan gelmesini engelle
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
    """Mevcut hash ve baslikları cek"""
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

    count = min(12, len(news_items))
    prompt = f"""Sen uzman bir Turk finans analistisin.
Asagidaki {len(news_items)} haberden EN ONEMLI ve FARKLI {count} tanesini sec.
Benzer konudaki haberlerden sadece birini sec.

SADECE JSON dizisi don - [ ile basla ] ile bit, baska hicbir sey yazma:

[{{"baslik":"Max 65 karakter etkileyici baslik","icerik":"3 cumlelik detayli ozet.","analiz":"Yatirimci ve tuketici icin 2 cumlelik somut analiz.","etiket":"🟢 Pozitif","tip":"haber","kaynak":"kaynak ismi","url":"URL= den sonraki linki aynen kop","image":"IMG= den sonraki linki aynen kop","titleHash":"HASH= den sonraki degeri aynen kop"}}]

etiket: 🟢 Pozitif | 🔴 Riskli | ⚪ Notr | 📊 Piyasa | 💰 Ekonomi | 🏦 MB | 💵 Doviz | 📈 Yukselis | 📉 Dusus | 🏢 Sirket | 📋 KAP
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
        clean = re.sub(r'```[a-z]*\n?|```|\*\*(.+?)\*\*', lambda m: m.group(1) or '', raw).strip()
        match = re.search(r'\[[\s\S]*\]', clean)
        if match:
            result = json.loads(match.group(0))
            # Temizle
            for item in result:
                item["url"]   = re.sub(r'URL=\s*|\|', '', item.get("url","")).strip()
                item["image"] = re.sub(r'IMG=\s*|\|', '', item.get("image","")).strip()
                item["titleHash"] = re.sub(r'HASH=\s*', '', item.get("titleHash","")).strip()
            print(f"  AI {len(result)} haber secti")
            return result
        print("  JSON bulunamadi:", clean[:200])
        return []
    except Exception as e:
        print(f"  AI hatasi: {e}")
        return []

def enrich_with_images(ai_list, news_items_map):
    """RSS'de resim yoksa og:image cek"""
    enriched = []
    for item in ai_list:
        img = item.get("image","").strip()
        # Resim yoksa veya gecersizse URL'den cek
        if not img or not img.startswith('http'):
            url = item.get("url","")
            if url:
                print(f"  Resim cekiliyor: {url[:60]}")
                img = fetch_og_image(url, timeout=6)
                if img:
                    print(f"    Resim bulundu: {img[:60]}")
        item["image"] = img
        enriched.append(item)
        time.sleep(0.1)
    return enriched

def save_to_firestore(token, data):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    doc = {"fields": {
        "baslik":    {"stringValue": str(data.get("baslik",""))[:100]},
        "icerik":    {"stringValue": str(data.get("icerik",""))},
        "analiz":    {"stringValue": str(data.get("analiz",""))},
        "etiket":    {"stringValue": str(data.get("etiket","⚪ Notr"))},
        "tip":       {"stringValue": "haber"},
        "kaynak":    {"stringValue": str(data.get("kaynak",""))},
        "url":       {"stringValue": str(data.get("url",""))},
        "image":     {"stringValue": str(data.get("image",""))},
        "titleHash": {"stringValue": str(data.get("titleHash",""))},
        "createdAt": {"timestampValue": now_str},
        "publishedAt":{"stringValue": now_str},
    }}
    try:
        r = requests.post(url, headers={"Authorization":f"Bearer {token}"}, json=doc, timeout=10)
        return r.status_code == 200
    except:
        return False

def main():
    print("=" * 50)
    print(f" Finans Botu | {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 50)

    print("\n[1] Firebase giris...")
    token = get_firebase_token()
    print("    OK")

    print("\n[2] Eski haberler temizleniyor (24h+)...")
    delete_old_news(token)

    print("\n[3] Mevcut haberler aliniyor...")
    existing_hashes, existing_titles = get_existing_data(token)
    print(f"    Mevcut: {len(existing_hashes)} haber")

    print("\n[4] RSS kaynaklarindan haberler cekiliyor...")
    all_items = fetch_all_news()
    if not all_items:
        print("\nHATA: Hic haber cekemedik!"); return

    print("\n[5] Yeni ve benzersiz haberler filtreleniyor...")
    new_items = []
    for item in all_items:
        # Hash kontrolu
        if item["hash"] in existing_hashes:
            continue
        # Firestore'daki haberlerle benzerlik kontrolu
        too_similar = any(is_similar(item["title"], et, threshold=0.45) for et in existing_titles)
        if too_similar:
            continue
        new_items.append(item)

    print(f"    {len(new_items)} gercekten yeni haber bulundu")

    if not new_items:
        print("    Yeni haber yok, cikiliyor.")
        return

    print("\n[6] AI analiz ve secim...")
    ai_list = analyze_with_ai(new_items)
    if not ai_list:
        print("HATA: AI bos dondu!"); return

    print("\n[7] Resimler ekleniyor...")
    ai_list = enrich_with_images(ai_list, {i["hash"]:i for i in new_items})

    print("\n[8] Firestore'a kaydediliyor...")
    saved = 0
    for item in ai_list:
        h = item.get("titleHash","")
        if h in existing_hashes:
            print(f"    ATLA: {item.get('baslik','')[:50]}")
            continue
        if save_to_firestore(token, item):
            has_img = "🖼️" if item.get("image") else "  "
            print(f"    OK {has_img}: {item.get('baslik','')[:60]}")
            existing_hashes.add(h)
            existing_titles.append(item.get("baslik",""))
            saved += 1
        time.sleep(0.2)

    print(f"\n{'='*50}")
    print(f" TAMAMLANDI! {saved} yeni haber yayinlandi.")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
