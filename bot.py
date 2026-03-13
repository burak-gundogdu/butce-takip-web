import os
import requests
import json
import time
import re
import xml.etree.ElementTree as ET
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
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

def get_firebase_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    res = requests.post(url, json={"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True}).json()
    if "idToken" not in res:
        raise Exception(f"Firebase giris basarisiz: {res}")
    return res["idToken"]

def parse_rss(url, source_name, limit=8):
    titles = []
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        res.encoding = res.apparent_encoding or 'utf-8'
        # Once XML parse dene
        try:
            root = ET.fromstring(res.content)
            items = root.findall('.//item') or root.findall('.//{http://www.w3.org/2005/Atom}entry')
            for item in items[:limit]:
                title_el = item.find('title') or item.find('{http://www.w3.org/2005/Atom}title')
                if title_el is not None:
                    title = title_el.text or ''
                    title = re.sub(r'<!\[CDATA\[(.+?)\]\]>', r'\1', title).strip()
                    if title and len(title) > 10:
                        titles.append(f"[{source_name}] {title}")
        except ET.ParseError:
            # Regex fallback
            found = re.findall(r'<title>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?</title>', res.text)
            for t in found[1:limit+1]:
                t = t.strip()
                if t and len(t) > 10:
                    titles.append(f"[{source_name}] {t}")
    except Exception as e:
        print(f"  {source_name} hatasi: {e}")
    return titles

def fetch_all_news():
    all_titles = []
    for src in RSS_SOURCES:
        items = parse_rss(src["url"], src["name"], limit=8)
        print(f"  {src['name']}: {len(items)} haber")
        all_titles.extend(items)
        time.sleep(0.3)
    print(f"  TOPLAM: {len(all_titles)} baslik")
    return "\n".join(all_titles)

def analyze_with_ai(news_text):
    if not news_text:
        return []
    system_prompt = """Sen uzman bir Turk finans analistisin.
Asagidaki haberlerden EN ONEMLI 10 TANESINI sec.
SADECE JSON dizisi don, baska hicbir sey yazma, markdown kullanma:
[{"baslik":"max 65 karakter","icerik":"2 cumle ozet","analiz":"yatirimci icin anlami","etiket":"🟢 Pozitif","tip":"haber","kaynak":"kaynak adi"}]
etiket: 🟢 Pozitif | 🔴 Riskli | ⚪ Notr | 📊 Piyasa | 💰 Ekonomi | 🏦 MB | 💵 Doviz
Tam 10 eleman don."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    try:
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, timeout=30, json={
            "model": "llama-3.1-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": f"HABERLER:\n{news_text[:6000]}"}
            ],
            "temperature": 0.1,
            "max_tokens": 4000,
        }).json()
        content = res["choices"][0]["message"]["content"]
        match = re.search(r'\[[\s\S]*\]', content)
        if match:
            return json.loads(match.group(0))
        print("JSON bulunamadi:", content[:200])
        return []
    except Exception as e:
        print(f"AI hatasi: {e}")
        return []

def get_existing_titles(token):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=50"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers).json()
        return {doc.get("fields",{}).get("baslik",{}).get("stringValue","").lower()[:40]
                for doc in res.get("documents", [])}
    except:
        return set()

def delete_old_news(token):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements?pageSize=100"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers).json()
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
                    requests.delete(f"https://firestore.googleapis.com/v1/{doc['name']}", headers=headers)
                    deleted += 1
                    time.sleep(0.1)
            except:
                pass
        print(f"  {deleted} eski haber silindi")
    except Exception as e:
        print(f"  Silme hatasi: {e}")

def save_to_firestore(token, data):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    headers = {"Authorization": f"Bearer {token}"}
    doc = {"fields": {
        "baslik":    {"stringValue": str(data.get("baslik",""))[:100]},
        "icerik":    {"stringValue": str(data.get("icerik",""))},
        "analiz":    {"stringValue": str(data.get("analiz",""))},
        "etiket":    {"stringValue": str(data.get("etiket","⚪ Notr"))},
        "tip":       {"stringValue": "haber"},
        "kaynak":    {"stringValue": str(data.get("kaynak",""))},
        "createdAt": {"timestampValue": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    }}
    return requests.post(url, headers=headers, json=doc).status_code == 200

def main():
    print("=" * 40)
    print(f"Finans Botu - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 40)

    print("\n[1] Firebase giris...")
    token = get_firebase_token()

    print("\n[2] Eski haberler siliniyor...")
    delete_old_news(token)

    print("\n[3] Haberler cekiliyor...")
    news_text = fetch_all_news()
    if not news_text:
        print("HATA: Hic haber cekemedik!"); return

    print("\n[4] AI analizi...")
    ai_list = analyze_with_ai(news_text)
    print(f"    AI {len(ai_list)} haber secti")
    if not ai_list:
        print("HATA: AI bos liste dondu!"); return

    print("\n[5] Duplikat kontrol...")
    existing = get_existing_titles(token)

    print("\n[6] Kaydediliyor...")
    saved = 0
    for item in ai_list:
        key = item.get("baslik","").lower()[:40]
        if key in existing:
            print(f"    ATLA: {item.get('baslik','')[:50]}")
            continue
        if save_to_firestore(token, item):
            print(f"    OK: {item.get('baslik','')[:60]}")
            saved += 1
        time.sleep(0.2)

    print(f"\nTAMAM! {saved} yeni haber yayinlandi.")
    print("=" * 40)

if __name__ == "__main__":
    main()