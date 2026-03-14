import os, requests, json, time, re, hashlib
from datetime import datetime, timezone

FIREBASE_API_KEY    = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL      = os.environ.get("FIREBASE_EMAIL")
FIREBASE_PASSWORD   = os.environ.get("FIREBASE_PASSWORD")
GROQ_API_KEY        = os.environ.get("GROQ_API_KEY")

# Farkli User-Agent'lar donusumlu kullan
UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
]

def get_headers(i=0):
    return {
        "User-Agent": UA_LIST[i % len(UA_LIST)],
        "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
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

def parse_rss_regex(xml_text, source_name, limit=10):
    """XML parse yerine regex - bozuk XML'i de okur"""
    items = []
    
    # Tum <item> bloklarini bul
    item_blocks = re.findall(r'<item[^>]*>(.*?)</item>', xml_text, re.DOTALL)
    if not item_blocks:
        # Atom feed icin <entry> dene
        item_blocks = re.findall(r'<entry[^>]*>(.*?)</entry>', xml_text, re.DOTALL)
    
    for block in item_blocks[:limit]:
        # Baslik
        title_match = re.search(r'<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', block, re.DOTALL)
        if not title_match:
            continue
        title = title_match.group(1).strip()
        title = re.sub(r'<[^>]+>', '', title).strip()  # HTML temizle
        if not title or len(title) < 5:
            continue
        
        # URL
        link_match = (
            re.search(r'<link[^>]*>(?:<!\[CDATA\[)?(https?://[^\s<]+)(?:\]\]>)?</link>', block) or
            re.search(r'<link[^>]*href=["\']([^"\']+)["\']', block) or
            re.search(r'<guid[^>]*>(https?://[^\s<]+)</guid>', block)
        )
        url = link_match.group(1).strip() if link_match else ""
        
        # Aciklama
        desc_match = re.search(r'<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>', block, re.DOTALL)
        desc = ""
        if desc_match:
            desc = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()[:200]
        
        items.append({
            "source": source_name,
            "title": title,
            "url": url,
            "description": desc,
            "hash": title_hash(title)
        })
    
    return items

def fetch_rss_direct(name, url, ua_index=0, limit=10):
    """Direkt HTTP ile RSS cek, regex ile parse et"""
    try:
        res = requests.get(url, headers=get_headers(ua_index), timeout=15, allow_redirects=True)
        if res.status_code != 200:
            print(f"  [{name}] HTTP {res.status_code}")
            return []
        items = parse_rss_regex(res.text, name, limit)
        return items
    except Exception as e:
        print(f"  [{name}] Hata: {type(e).__name__}: {str(e)[:60]}")
        return []

def fetch_all_news():
    all_items = []
    seen = set()

    sources = [
        # (isim, url, ua_index)
        ("NTV Ekonomi",       "https://www.ntv.com.tr/ekonomi.rss",                        0),
        ("TRT Ekonomi",       "https://www.trthaber.com/ekonomi_articles.rss",              1),
        ("Sabah Ekonomi",     "https://www.sabah.com.tr/rss/ekonomi.xml",                   2),
        ("Haberturk",         "https://www.haberturk.com/rss/kategori/ekonomi.xml",         3),
        ("Hurriyet Ekonomi",  "https://www.hurriyet.com.tr/rss/ekonomi",                    0),
        ("Milliyet Ekonomi",  "https://www.milliyet.com.tr/rss/rssNew/ekonomiRss.xml",      1),
        ("Dunya Gazetesi",    "https://www.dunya.com/rss/anasayfa.xml",                     2),
        ("Bloomberg HT",      "https://www.bloomberght.com/rss",                            3),
        ("Para Analiz",       "https://www.paraanaliz.com/feed/",                           0),
        ("Borsagundem",       "https://www.borsagundem.com/feed",                           1),
        ("Ekonomist",         "https://ekonomist.com.tr/feed/",                             2),
        ("Yatirim Finans",    "https://www.yatirimfinans.com/feed/",                        3),
        ("KAP Bildirimler",   "https://www.kap.org.tr/tr/bildirim-sorgu/ozet/0/rss",        0),
    ]

    for name, url, ua_idx in sources:
        items = fetch_rss_direct(name, url, ua_idx, limit=8)
        new_count = 0
        for item in items:
            if item["hash"] not in seen:
                seen.add(item["hash"])
                all_items.append(item)
                new_count += 1
        print(f"  [{name}] {new_count} haber")
        time.sleep(0.5)

    print(f"\n  TOPLAM BENZERSIZ: {len(all_items)} haber")
    return all_items

def analyze_with_ai(news_items):
    if not news_items:
        return []

    lines = []
    for i in news_items:
        desc = f" | {i['description'][:80]}" if i.get('description') else ""
        lines.append(f"[{i['source']}] {i['title']}{desc} |URL={i.get('url','')}| HASH={i['hash']}")
    news_text = "\n".join(lines)

    count = min(12, len(news_items))

    prompt = f"""Sen uzman bir Turk finans analistisin.
Asagidaki {len(news_items)} haberden EN ONEMLI ve BIRBIRINDEN FARKLI {count} tanesini sec.
KAP bildirimleri varsa mutlaka dahil et.

SADECE JSON dizisi don - [ ile basla ] ile bit, baska hicbir sey yazma:

[{{"baslik":"Max 65 karakter etkileyici baslik","icerik":"3 cumlelik detayli ozet. Ne oldu, kimler etkilenir, ne zaman.","analiz":"Yatirimci ve tuketici icin somut 2 cumlelik analiz.","etiket":"🟢 Pozitif","tip":"haber","kaynak":"kaynak ismi","url":"URL= den sonraki linki aynen kop","titleHash":"HASH= den sonraki degeri aynen kop"}}]

etiket: 🟢 Pozitif | 🔴 Riskli | ⚪ Notr | 📊 Piyasa | 💰 Ekonomi | 🏦 MB | 💵 Doviz | 📈 Yukselis | 📉 Dusus | 🏢 Sirket | 📋 KAP
Tam {count} eleman don, eksik olmasin."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    try:
        res = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers=headers, timeout=60, json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role":"system","content":prompt},
                    {"role":"user","content":f"HABERLER:\n{news_text[:9000]}"}
                ],
                "temperature": 0.1,
                "max_tokens": 6000,
            }).json()

        raw = res["choices"][0]["message"]["content"]
        # Temizle
        clean = re.sub(r'```[a-z]*\n?', '', raw)
        clean = re.sub(r'```', '', clean)
        clean = re.sub(r'\*\*(.+?)\*\*', r'\1', clean).strip()

        match = re.search(r'\[[\s\S]*?\](?=\s*$)', clean)
        if not match:
            match = re.search(r'\[[\s\S]*\]', clean)
        
        if match:
            result = json.loads(match.group(0))
            # URL ve hash temizle
            for item in result:
                u = item.get("url","")
                item["url"] = re.sub(r'URL=\s*', '', u).strip().strip('|').strip()
                h = item.get("titleHash","")
                item["titleHash"] = re.sub(r'HASH=\s*', '', h).strip()
            print(f"  AI {len(result)} haber secti")
            return result

        print("  JSON bulunamadi. Ham yanit:")
        print(clean[:400])
        return []
    except Exception as e:
        print(f"  AI hatasi: {e}")
        return []

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
        cutoff = time.time() - 86400
        deleted = 0
        for doc in res.get("documents", []):
            fields = doc.get("fields", {})
            if fields.get("tip",{}).get("stringValue","") != "haber":
                continue
            ts_str = fields.get("createdAt",{}).get("timestampValue","")
            if not ts_str:
                continue
            try:
                ts = time.mktime(time.strptime(ts_str[:19], '%Y-%m-%dT%H:%M:%S'))
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

    print("\n[2] Eski haberler temizleniyor...")
    delete_old_news(token)

    print("\n[3] RSS kaynaklari cekiliyor...")
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
        print("    Tum haberler zaten mevcut.")
        return

    print("\n[5] AI analiz...")
    ai_list = analyze_with_ai(new_items)
    if not ai_list:
        print("HATA: AI bos dondu!")
        return

    print("\n[6] Firestore'a kaydediliyor...")
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