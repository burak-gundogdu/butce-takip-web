import os
import requests
import json
import time
import re

FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL = os.environ.get("FIREBASE_EMAIL")
FIREBASE_PASSWORD = os.environ.get("FIREBASE_PASSWORD")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Haber kaynakları — RSS2JSON köprüsü ile
RSS_SOURCES = [
    {"name": "TRT Ekonomi",     "url": "https://www.trthaber.com/ekonomi_articles.rss"},
    {"name": "NTV Ekonomi",     "url": "https://www.ntv.com.tr/ekonomi.rss"},
    {"name": "Milliyet",        "url": "https://www.milliyet.com.tr/rss/rssNew/ekonomiRss.xml"},
    {"name": "Bloomberg HT",    "url": "https://www.bloomberght.com/rss"},
    {"name": "Haberturk",       "url": "https://www.haberturk.com/rss/kategori/ekonomi.xml"},
]

# KAP (Kamuyu Aydınlatma Platformu) - doğrudan
KAP_URL = "https://www.kap.org.tr/tr/duyuru/ozet/0"

def get_firebase_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True}
    res = requests.post(url, json=payload).json()
    if "idToken" not in res:
        raise Exception(f"Firebase Giris Basarisiz: {res}")
    return res["idToken"]

def fetch_news():
    all_titles = []
    for source in RSS_SOURCES:
        try:
            rss_url = f"https://api.rss2json.com/v1/api.json?rss_url={source['url']}&count=8"
            res = requests.get(rss_url, timeout=10).json()
            if res.get("status") == "ok":
                titles = [f"[{source['name']}] {item['title']}" for item in res["items"][:8]]
                all_titles.extend(titles)
                print(f"  {source['name']}: {len(titles)} haber")
        except Exception as e:
            print(f"  {source['name']} hatasi: {e}")
    return "\n".join(all_titles)

def analyze_with_ai(news_text):
    if not news_text:
        return None

    system_prompt = """Sen uzman bir finans analistisin. Asagidaki haberlerden EN ONEMLI 8 TANESINI sec ve analiz et.

YANITININ SADECE VE SADECE ASAGIDAKI GIBI 8 ELEMANLI BIR JSON DIZISI OLMALIDIR. Baska hicbir aciklama yazma!

[
  {
    "baslik": "Haberin ozet basligi (max 60 karakter)",
    "icerik": "Haberin 2 cumlelik ozeti. Ne oldu, neden onemli.",
    "analiz": "Bu haberin yatirimcilar ve bireysel finans icin anlami nedir? 1-2 cumle.",
    "etiket": "🟢 Pozitif veya 🔴 Riskli veya ⚪ Notr veya 📊 Piyasa veya 💰 Ekonomi",
    "tip": "haber",
    "kaynak": "Kaynak adini buraya yaz"
  }
]

8 haber sec, 8 eleman don. Noksan olmasin."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.3-70b-versatile",  # Daha iyi model
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"GUNCEL HABERLER:\n{news_text}"}
        ],
        "temperature": 0.1,
        "max_tokens": 3000,
    }

    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload).json()
    try:
        content = res["choices"][0]["message"]["content"]
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        print("JSON bulunamadi:", content[:200])
        return []
    except Exception as e:
        print("AI hatasi:", e)
        return []

def delete_old_news(token):
    """24 saatten eski haberleri sil"""
    try:
        url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(url, headers=headers).json()
        docs = res.get("documents", [])
        cutoff = time.time() - 86400  # 24 saat
        deleted = 0
        for doc in docs:
            fields = doc.get("fields", {})
            tip = fields.get("tip", {}).get("stringValue", "")
            if tip != "haber":
                continue
            created = fields.get("createdAt", {}).get("timestampValue", "")
            if created:
                ts = time.mktime(time.strptime(created[:19], '%Y-%m-%dT%H:%M:%S'))
                if ts < cutoff:
                    doc_url = f"https://firestore.googleapis.com/v1/{doc['name']}"
                    requests.delete(doc_url, headers=headers)
                    deleted += 1
        if deleted:
            print(f"  {deleted} eski haber silindi")
    except Exception as e:
        print(f"  Silme hatasi: {e}")

def save_to_firestore(token, data):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    headers = {"Authorization": f"Bearer {token}"}
    firestore_doc = {
        "fields": {
            "baslik":    {"stringValue": data.get("baslik", "")},
            "icerik":    {"stringValue": data.get("icerik", "")},
            "analiz":    {"stringValue": data.get("analiz", "")},
            "etiket":    {"stringValue": data.get("etiket", "")},
            "tip":       {"stringValue": "haber"},
            "kaynak":    {"stringValue": data.get("kaynak", "")},
            "createdAt": {"timestampValue": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        }
    }
    requests.post(url, headers=headers, json=firestore_doc)

def main():
    print("=== Finans Haber Botu Basladi ===")
    print("1. Firebase'e giris yapiliyor...")
    token = get_firebase_token()

    print("2. Eski haberler temizleniyor...")
    delete_old_news(token)

    print("3. Haberler cekiliyor...")
    news = fetch_news()
    print(f"   Toplam {len(news.splitlines())} haber baslik alindi")

    print("4. Yapay zeka ile analiz ediliyor...")
    ai_list = analyze_with_ai(news)

    if ai_list and isinstance(ai_list, list):
        print(f"5. {len(ai_list)} haber Firebase'e kaydediliyor...")
        for item in ai_list:
            save_to_firestore(token, item)
            time.sleep(0.2)
        print(f"TAMAMLANDI! {len(ai_list)} haber yayinlandi.")
    else:
        print("Haber listesi alinamadi.")

if __name__ == "__main__":
    main()