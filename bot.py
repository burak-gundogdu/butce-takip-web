import os
import requests
import json
import time

FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL = os.environ.get("FIREBASE_EMAIL")
FIREBASE_PASSWORD = os.environ.get("FIREBASE_PASSWORD")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

def get_firebase_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True}
    res = requests.post(url, json=payload).json()
    if "idToken" not in res:
        raise Exception(f"Firebase Giris Basarisiz: {res}")
    return res["idToken"]

def fetch_news():
    rss_url = "https://api.rss2json.com/v1/api.json?rss_url=https://www.trthaber.com/ekonomi_articles.rss"
    res = requests.get(rss_url).json()
    if res.get("status") == "ok":
        titles = [item["title"] for item in res["items"][:8]] # En güncel 8 haberi çek
        return "\n".join(titles)
    return ""

def analyze_with_ai(news_text):
    if not news_text: return None
    
    # DİKKAT: Artık tek bir nesne değil, 3'lü bir LİSTE (Array) istiyoruz.
    system_prompt = """Sen uzman bir Wall Street finans analistisin. 
Aşağıdaki haberlerden EN ÖNEMLİ 3 TANESİNİ seç.
LÜTFEN SADECE AŞAĞIDAKİ GİBİ BİR JSON DİZİSİ (ARRAY) FORMATINDA YANIT VER. Başka hiçbir kelime yazma.

[
  {
    "baslik": "1. Haberin Başlığı",
    "icerik": "1. Haberin Özeti",
    "analiz": "Yapay zeka analiz yorumu...",
    "etiket": "🟢 Pozitif",
    "tip": "haber"
  },
  {
    "baslik": "2. Haberin Başlığı",
    "icerik": "2. Haberin Özeti",
    "analiz": "Yapay zeka analiz yorumu...",
    "etiket": "🔴 Riskli",
    "tip": "haber"
  }
]"""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"GÜNCEL HABERLER:\n{news_text}"}
        ],
        "temperature": 0.2
    }
    
    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload).json()
    try:
        content = res["choices"][0]["message"]["content"]
        json_str = content[content.find('['):content.rfind(']')+1]
        return json.loads(json_str)
    except Exception as e:
        print("Yapay Zeka Hatasi:", e)
        return None

def save_to_firestore(token, data):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    headers = {"Authorization": f"Bearer {token}"}
    
    firestore_doc = {
        "fields": {
            "baslik": {"stringValue": data.get("baslik", "")},
            "icerik": {"stringValue": data.get("icerik", "")},
            "analiz": {"stringValue": data.get("analiz", "")},
            "etiket": {"stringValue": data.get("etiket", "")},
            "tip": {"stringValue": "haber"},
            "createdAt": {"timestampValue": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        }
    }
    requests.post(url, headers=headers, json=firestore_doc)

def main():
    print("1. Haberler cekiliyor...")
    news = fetch_news()
    print("2. Yapay zekaya analiz ettiriliyor...")
    ai_data_list = analyze_with_ai(news)
    
    if ai_data_list and isinstance(ai_data_list, list):
        print("3. Firebase'e giris yapiliyor...")
        token = get_firebase_token()
        print(f"4. {len(ai_data_list)} adet haber veritabanina kaydediliyor...")
        
        # Her bir haberi sırayla veritabanına kaydet
        for item in ai_data_list:
            save_to_firestore(token, item)
            
        print("🚀 ISLEM BASARIYLA TAMAMLANDI!")
    else:
        print("❌ Haber analiz edilemedi veya format yanlis.")

if __name__ == "__main__":
    main()