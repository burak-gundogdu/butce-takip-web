import os, requests, json, time, re, hashlib, xml.etree.ElementTree as ET
from datetime import datetime, timezone

FIREBASE_API_KEY    = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL      = os.environ.get("FIREBASE_EMAIL")
FIREBASE_PASSWORD   = os.environ.get("FIREBASE_PASSWORD")
GROQ_API_KEY        = os.environ.get("GROQ_API_KEY")

RSS_SOURCES = [
    {"name": "TRT Ekonomi",       "url": "https://www.trthaber.com/ekonomi_articles.rss"},
    {"name": "NTV Ekonomi",       "url": "https://www.ntv.com.tr/ekonomi.rss"},
    {"name": "Haberturk Ekonomi", "url": "https://www.haberturk.com/rss/kategori/ekonomi.xml"},
    {"name": "Sabah Ekonomi",     "url": "https://www.sabah.com.tr/rss/ekonomi.xml"},
    {"name": "Hurriyet Ekonomi",  "url": "https://www.hurriyet.com.tr/rss/ekonomi"},
    {"name": "Dunya Gazetesi",    "url": "https://www.dunya.com/rss/anasayfa.xml"},
    {"name": "Para Analiz",       "url": "https://www.paraanaliz.com/feed/"},
    {"name": "KAP",               "url": "https://www.kap.org.tr/tr/bildirim-sorgu/ozet/0/rss"},
    {"name": "Investing.com TR",  "url": "https://tr.investing.com/rss/news.rss"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

def get_firebase_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    res = requests.post(url, json={"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True}, timeout=10).json()
    if "idToken" not in res:
        raise Exception(f"Firebase giris basarisiz: {res}")
    return res["idToken"]

def title_hash(title):
    """Baslik icin benzersiz hash uret - duplikat tespiti icin"""
    clean = re.sub(r'\s+', ' ', title.lower().strip())[:60]
    return hashlib.md5(clean.encode('utf-8')).hexdigest()[:12]

def parse_rss(url, source_name, limit=10):
    items = []
    try:
        res = requests.get(url, headers=HEADERS, timeout=12)
        res.encoding = res.apparent_encoding or 'utf-8'
        try:
            root = ET.fromstring(res.content)
            elems = root.findall('.//item') or root.findall('.//{http://www.w3.org/2005/Atom}entry')
            for el in elems[:limit]:
                t = el.find('title') or el.find('{http://www.w3.org/2005/Atom}title')
                if t is not None and t.text:
                    title = re.sub(r'<!\[CDATA\[(.+?)\]\]>', r'\1', t.text).strip()
                    if len(title) > 10:
                        items.append({"source": source_name, "title": title, "hash": title_hash(title)})
        except ET.ParseError:
            found = re.findall(r'<title>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?</title>', res.text)
            for t in found[1:limit+1]:
                t = t.strip()
                if len(t) > 10:
                    items.append({"source": source_name, "title": t, "hash": title_hash(t)})
    except Exception as e:
        print(f"  [{source_name}] HATA: {e}")
    return items

def fetch_all_news():
    all_items = []
    seen_hashes = set()
    for src in RSS_SOURCES:
        items = parse_rss(src["url"], src["name"], limit=10)
        new_items = []
        for item in items:
            if item["hash"] not in seen_hashes:
                seen_hashes.add(item["hash"])
                new_items.append(item)
        print(f"  [{src['name']}] {len(new_items)} benzersiz haber")
        all_items.extend(new_items)
        time.sleep(0.4)
    print(f"  TOPLAM: {len(all_items)} benzersiz baslik")
    return all_items

def get_existing_hashes(token):
    """Firestore'daki mevcut haber hash'lerini cek"""
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=100"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers, timeout=10).json()
        hashes = set()
        for doc in res.get("documents", []):
            h = doc.get("fields", {}).get("titleHash", {}).get("stringValue", "")
            if h:
                hashes.add(h)
        return hashes
    except:
        return set()

def delete_old_news(token):
    """24 saatten eski haberleri sil"""
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=100"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers, timeout=10).json()
        cutoff = time.time() - 86400
        deleted = 0
        for doc in res.get("documents", []):
            fields = doc.get("fields", {})
            if fields.get("tip", {}).get("stringValue", "") != "haber":
                continue
            created_str = fields.get("createdAt", {}).get("timestampValue", "")
            if not created_str:
                continue
            try:
                ts = time.mktime(time.strptime(created_str[:19], '%Y-%m-%dT%H:%M:%S'))
                if ts < cutoff:
                    requests.delete(f"https://firestore.googleapis.com/v1/{doc['name']}", headers=headers, timeout=5)
                    deleted += 1
                    time.sleep(0.15)
            except:
                pass
        print(f"  {deleted} eski haber silindi")
    except Exception as e:
        print(f"  Silme hatasi: {e}")

def analyze_with_ai(news_items):
    if not news_items:
        return []

    news_text = "\n".join([f"[{i['source']}] {i['title']} (id:{i['hash']})" for i in news_items])

    system_prompt = """Sen uzman bir Turk finans ve ekonomi analistisin.
Asagidaki haberlerden EN ONEMLI VE FARKLI 10 TANESINI sec (ayni konuyu tekrarlama).
SADECE JSON dizisi don. Markdown, ** veya kod blogu kullanma. Sadece [ ile baslayan ] ile biten:

[
  {
    "baslik": "Kisaltilmis etkileyici baslik (max 60 karakter)",
    "icerik": "Haberin 2 cumlelik ozeti. Ne oldu ve neden onemli.",
    "analiz": "Bu haber yatirimcilar ve tukketiciler icin ne anlama geliyor? 1-2 cumle.",
    "etiket": "🟢 Pozitif",
    "tip": "haber",
    "kaynak": "kaynak adi",
    "titleHash": "id degerini buraya koy"
  }
]

etiket secenekleri: 🟢 Pozitif | 🔴 Riskli | ⚪ Notr | 📊 Piyasa | 💰 Ekonomi | 🏦 Merkez Bankasi | 💵 Doviz | 📈 Yukselis | 📉 Dusus
KESINLIKLE 10 eleman don. Hic markdown kullanma."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    try:
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, timeout=40, json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": f"HABERLER:\n{news_text[:7000]}"}
            ],
            "temperature": 0.15,
            "max_tokens": 4000,
        }).json()

        content = res["choices"][0]["message"]["content"]
        # Tum markdown temizle
        content = re.sub(r'\*\*(.+?)\*\*', r'\1', content)
        content = re.sub(r'```[a-z]*', '', content)
        content = re.sub(r'```', '', content)

        match = re.search(r'\[[\s\S]*\]', content)
        if match:
            result = json.loads(match.group(0))
            print(f"  AI {len(result)} haber secti")
            return result

        print("JSON bulunamadi:", content[:300])
        return []
    except Exception as e:
        print(f"AI hatasi: {e}")
        return []

def save_to_firestore(token, data):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    headers = {"Authorization": f"Bearer {token}"}
    doc = {"fields": {
        "baslik":     {"stringValue": str(data.get("baslik",""))[:100]},
        "icerik":     {"stringValue": str(data.get("icerik",""))},
        "analiz":     {"stringValue": str(data.get("analiz",""))},
        "etiket":     {"stringValue": str(data.get("etiket","⚪ Notr"))},
        "tip":        {"stringValue": "haber"},
        "kaynak":     {"stringValue": str(data.get("kaynak",""))},
        "titleHash":  {"stringValue": str(data.get("titleHash",""))},
        "createdAt":  {"timestampValue": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    }}
    try:
        r = requests.post(url, headers=headers, json=doc, timeout=10)
        return r.status_code == 200
    except:
        return False

def main():
    print("=" * 45)
    print(f" Finans Haber Botu | {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 45)

    print("\n[1] Firebase giris...")
    token = get_firebase_token()
    print("    OK")

    print("\n[2] Eski haberler temizleniyor...")
    delete_old_news(token)

    print("\n[3] RSS kaynaklarindan haberler cekiliyor...")
    news_items = fetch_all_news()
    if not news_items:
        print("HATA: Hic haber cekemedik!"); return

    print("\n[4] Mevcut hash'ler kontrol ediliyor (duplikat onleme)...")
    existing_hashes = get_existing_hashes(token)
    print(f"    Firestore'da {len(existing_hashes)} mevcut haber hash'i var")

    # Hash ile onceden filtrele
    new_items = [i for i in news_items if i["hash"] not in existing_hashes]
    print(f"    {len(new_items)} yeni haber AI'a gonderilecek")

    if not new_items:
        print("    Tum haberler zaten mevcut, islem tamamlandi."); return

    print("\n[5] AI analizi yapiliyor...")
    ai_list = analyze_with_ai(new_items)
    if not ai_list:
        print("HATA: AI bos liste dondu!"); return

    print("\n[6] Firestore'a kaydediliyor...")
    saved = 0
    for item in ai_list:
        item_hash = item.get("titleHash","")
        if item_hash in existing_hashes:
            print(f"    ATLA (duplikat): {item.get('baslik','')[:50]}")
            continue
        if save_to_firestore(token, item):
            print(f"    OK: {item.get('baslik','')[:60]}")
            existing_hashes.add(item_hash)
            saved += 1
        time.sleep(0.2)

    print(f"\n{'='*45}")
    print(f" TAMAMLANDI! {saved} yeni haber yayinlandi.")
    print(f"{'='*45}")

if __name__ == "__main__":
    main()