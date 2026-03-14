import os, requests, json, time, re, hashlib, xml.etree.ElementTree as ET
from datetime import datetime, timezone

FIREBASE_API_KEY    = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL      = os.environ.get("FIREBASE_EMAIL")
FIREBASE_PASSWORD   = os.environ.get("FIREBASE_PASSWORD")
GROQ_API_KEY        = os.environ.get("GROQ_API_KEY")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}

def title_hash(title):
    clean = re.sub(r'\s+', ' ', title.lower().strip())[:80]
    return hashlib.md5(clean.encode('utf-8')).hexdigest()[:14]

def get_firebase_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    res = requests.post(url, json={"email":FIREBASE_EMAIL,"password":FIREBASE_PASSWORD,"returnSecureToken":True},timeout=10).json()
    if "idToken" not in res:
        raise Exception(f"Firebase giris basarisiz: {res}")
    return res["idToken"]

# ─── RSS2JSON ile cok sayida kaynak ────────────────────────────────────────
def fetch_rss2json(name, rss_url, count=10):
    """rss2json - URL de donduruyor, engellenmiyor"""
    items = []
    try:
        url = f"https://api.rss2json.com/v1/api.json?rss_url={requests.utils.quote(rss_url)}&count={count}&api_key=&order_by=pubDate"
        res = requests.get(url, timeout=12).json()
        if res.get("status") == "ok":
            for art in res.get("items", []):
                title = art.get("title","").strip()
                link  = art.get("link","").strip()
                desc  = art.get("description","").strip()
                # HTML temizle
                desc = re.sub(r'<[^>]+>', '', desc)[:300]
                if title and len(title) > 10:
                    items.append({
                        "source": name,
                        "title": title,
                        "url": link,
                        "description": desc,
                        "hash": title_hash(title)
                    })
    except Exception as e:
        print(f"  [{name}] rss2json hatasi: {e}")
    return items

# ─── KAP - Direkt XML ──────────────────────────────────────────────────────
def fetch_kap():
    """KAP bildirimleri - cok onemli, direkt XML"""
    items = []
    urls_to_try = [
        "https://www.kap.org.tr/tr/bildirim-sorgu/ozet/0/rss",
        "https://www.kap.org.tr/en/notification-query/summary/0/rss",
    ]
    for url in urls_to_try:
        try:
            res = requests.get(url, headers=HEADERS, timeout=12)
            root = ET.fromstring(res.content)
            elems = root.findall('.//item')
            for el in elems[:15]:
                t = el.find('title')
                l = el.find('link')
                d = el.find('description')
                if t is not None and t.text:
                    title = re.sub(r'<!\[CDATA\[(.+?)\]\]>', r'\1', t.text).strip()
                    link  = l.text.strip() if l is not None and l.text else ""
                    desc  = re.sub(r'<[^>]+>', '', re.sub(r'<!\[CDATA\[(.+?)\]\]>', r'\1', d.text or "")).strip()[:200] if d is not None else ""
                    if len(title) > 5:
                        items.append({"source":"KAP","title":f"[KAP] {title}","url":link,"description":desc,"hash":title_hash(title)})
            if items:
                print(f"  [KAP] {len(items)} bildirim")
                return items
        except Exception as e:
            print(f"  [KAP] {url} hatasi: {e}")
    return items

# ─── Tum kaynaklar ────────────────────────────────────────────────────────
def fetch_all_news():
    all_items = []
    seen = set()

    # RSS2JSON kaynaklari - her birinden 10 haber al
    rss_sources = [
        ("NTV Ekonomi",       "https://www.ntv.com.tr/ekonomi.rss"),
        ("TRT Haber Ekonomi", "https://www.trthaber.com/ekonomi_articles.rss"),
        ("Sabah Ekonomi",     "https://www.sabah.com.tr/rss/ekonomi.xml"),
        ("Haberturk Ekonomi", "https://www.haberturk.com/rss/kategori/ekonomi.xml"),
        ("Hurriyet Ekonomi",  "https://www.hurriyet.com.tr/rss/ekonomi"),
        ("Dunya Gazetesi",    "https://www.dunya.com/rss/anasayfa.xml"),
        ("Bloomberg HT",      "https://www.bloomberght.com/rss"),
        ("Para Analiz",       "https://www.paraanaliz.com/feed/"),
        ("Milliyet Ekonomi",  "https://www.milliyet.com.tr/rss/rssNew/ekonomiRss.xml"),
        ("Cumhuriyet Ekono",  "https://www.cumhuriyet.com.tr/rss/ekonomi.xml"),
        ("Investing TR",      "https://tr.investing.com/rss/news.rss"),
        ("Borsagundem",       "https://www.borsagundem.com/feed"),
        ("Ekonomist",         "https://ekonomist.com.tr/feed/"),
    ]

    for name, url in rss_sources:
        items = fetch_rss2json(name, url, count=8)
        new = 0
        for item in items:
            if item["hash"] not in seen:
                seen.add(item["hash"])
                all_items.append(item)
                new += 1
        print(f"  [{name}] {new} yeni haber")
        time.sleep(0.25)

    # KAP haberleri - her zaman ekle
    kap_items = fetch_kap()
    for item in kap_items:
        if item["hash"] not in seen:
            seen.add(item["hash"])
            all_items.append(item)

    print(f"\n  TOPLAM BENZERSIZ: {len(all_items)} haber")
    return all_items

# ─── AI Analiz ─────────────────────────────────────────────────────────────
def analyze_with_ai(news_items):
    if not news_items:
        return []

    # Her haber icin baslik + aciklama gonder
    news_text = ""
    for i in news_items:
        desc = f" — {i['description'][:100]}" if i.get('description') else ""
        news_text += f"[{i['source']}] {i['title']}{desc} |||URL:{i.get('url','')}||| ###HASH:{i['hash']}###\n"

    count = min(12, len(news_items))

    system_prompt = f"""Sen uzman bir Turk finans ve borsa analistisin.
Asagidaki haberlerden en onemli ve BIRBIRINDEN FARKLI {count} tanesini sec.
KAP bildirimleri varsa mutlaka dahil et - cok onemli!
Ayni konuyu tekrarlama. Cesit: doviz, borsa, enflasyon, sirket, MB, dis piyasa, emtia.

SADECE JSON dizisi don. Markdown veya ** KULLANMA. [ ile basla ] ile bit:

[{{
  "baslik": "Etkileyici ve bilgilendirici baslik (max 65 karakter)",
  "icerik": "Haberin detayli 3 cumlelik ozeti. Ne oldu, ne zaman, kimler etkilenir.",
  "analiz": "Yatirimci, tasarruf sahibi ve tuketici icin somut anlami nedir? 2 cumle.",
  "etiket": "🟢 Pozitif",
  "tip": "haber",
  "kaynak": "kaynak adi",
  "url": "|||URL:... icindeki url aynen koy|||",
  "titleHash": "###HASH:... icindeki deger aynen koy###"
}}]

etiket: 🟢 Pozitif | 🔴 Riskli | ⚪ Notr | 📊 Piyasa | 💰 Ekonomi | 🏦 MB | 💵 Doviz | 📈 Yukselis | 📉 Dusus | 🏢 Sirket | 📋 KAP
KESINLIKLE {count} eleman don."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    try:
        res = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers=headers, timeout=60, json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role":"system","content":system_prompt},
                    {"role":"user","content":f"HABERLER:\n{news_text[:9000]}"}
                ],
                "temperature": 0.1,
                "max_tokens": 6000,
            }).json()

        content = res["choices"][0]["message"]["content"]
        content = re.sub(r'\*\*(.+?)\*\*', r'\1', content)
        content = re.sub(r'```[a-z]*\n?', '', content)
        content = re.sub(r'```', '', content).strip()

        match = re.search(r'\[[\s\S]*\]', content)
        if match:
            result = json.loads(match.group(0))
            # URL ve hash temizle
            for item in result:
                url = item.get("url","")
                item["url"] = re.sub(r'\|\|\|URL:|URL:|\|\|\|', '', url).strip()
                h = item.get("titleHash","")
                item["titleHash"] = re.sub(r'###HASH:|###', '', h).strip()
            print(f"  AI {len(result)} haber secti")
            return result

        print("  JSON bulunamadi:")
        print(content[:300])
        return []
    except Exception as e:
        print(f"  AI hatasi: {e}")
        return []

# ─── Firestore ─────────────────────────────────────────────────────────────
def get_existing_hashes(token):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=150"
    try:
        res = requests.get(url, headers={"Authorization":f"Bearer {token}"}, timeout=10).json()
        return {doc.get("fields",{}).get("titleHash",{}).get("stringValue","")
                for doc in res.get("documents",[])}
    except:
        return set()

def delete_old_news(token):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=150"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers, timeout=10).json()
        cutoff = time.time() - 86400  # 24 saat
        deleted = 0
        for doc in res.get("documents", []):
            fields = doc.get("fields", {})
            if fields.get("tip",{}).get("stringValue","") != "haber":
                continue
            created_str = fields.get("createdAt",{}).get("timestampValue","")
            if not created_str:
                continue
            try:
                ts = time.mktime(time.strptime(created_str[:19], '%Y-%m-%dT%H:%M:%S'))
                if ts < cutoff:
                    requests.delete(f"https://firestore.googleapis.com/v1/{doc['name']}", headers=headers, timeout=5)
                    deleted += 1
                    time.sleep(0.1)
            except:
                pass
        print(f"  {deleted} eski haber silindi")
    except Exception as e:
        print(f"  Silme hatasi: {e}")

def save_to_firestore(token, data):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    doc = {"fields": {
        "baslik":    {"stringValue": str(data.get("baslik",""))[:100]},
        "icerik":    {"stringValue": str(data.get("icerik",""))},
        "analiz":    {"stringValue": str(data.get("analiz",""))},
        "etiket":    {"stringValue": str(data.get("etiket","⚪ Notr"))},
        "tip":       {"stringValue": "haber"},
        "kaynak":    {"stringValue": str(data.get("kaynak",""))},
        "url":       {"stringValue": str(data.get("url",""))},
        "titleHash": {"stringValue": str(data.get("titleHash",""))},
        "createdAt": {"timestampValue": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
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

    print("\n[3] Haberler cekiliyor...")
    news_items = fetch_all_news()

    if not news_items:
        print("\nHATA: Hic haber cekemedik!")
        return

    print("\n[4] Duplikat kontrol...")
    existing = get_existing_hashes(token)
    print(f"    Mevcut: {len(existing)} hash")
    new_items = [i for i in news_items if i.get("hash","") not in existing]
    print(f"    Yeni: {len(new_items)} haber AI'a gidecek")

    if not new_items:
        print("    Tum haberler zaten mevcut, cikiliyor.")
        return

    print("\n[5] AI analiz...")
    ai_list = analyze_with_ai(new_items)
    if not ai_list:
        print("HATA: AI bos dondu!")
        return

    print("\n[6] Kaydediliyor...")
    saved = 0
    for item in ai_list:
        h = item.get("titleHash","")
        if h in existing:
            print(f"    ATLA: {item.get('baslik','')[:50]}")
            continue
        if save_to_firestore(token, item):
            print(f"    OK: {item.get('baslik','')[:65]}")
            existing.add(h)
            saved += 1
        time.sleep(0.2)

    print(f"\n{'='*50}")
    print(f" TAMAMLANDI! {saved} yeni haber yayinlandi.")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()