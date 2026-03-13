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
        titles = [item["title"] for item in res["items"][:10]] # Garantilemek icin 10 haber cek
        return "\n".join(titles)
    return ""

def analyze_with_ai(news_text):
    if not news_text: return None
    
    # YAPAY ZEKAYA KATI ŞABLON DAYATIYORUZ (Tembellik yapamaması için)
    system_prompt = """Sen uzman bir finans analistisin. 
Aşağıdaki haberlerden EN ÖNEMLİ 3 TANESİNİ seç.
YANITIN SADECE VE SADECE AŞAĞIDAKİ GİBİ 3 ELEMANLI BİR JSON DİZİSİ (ARRAY) OLMALIDIR. Başka hiçbir açıklama yazma!

[
  {
    "baslik": "1. Haberin Başlığı",
    "icerik": "1. Haberin 2 cümlelik özeti",
    "analiz": "Yapay zeka yorumun",
    "etiket": "🟢 Pozitif",
    "tip": "haber"
  },
  {
    "baslik": "2. Haberin Başlığı",
    "icerik": "2. Haberin 2 cümlelik özeti",
    "analiz": "Yapay zeka yorumun",
    "etiket": "🔴 Riskli",
    "tip": "haber"
  },
  {
    "baslik": "3. Haberin Başlığı",
    "icerik": "3. Haberin 2 cümlelik özeti",
    "analiz": "Yapay zeka yorumun",
    "etiket": "⚪ Nötr",
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
        "temperature": 0.1 # Halüsinasyon ve tembelliği minimuma indir
    }
    
    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload).json()
    try:
        content = res["choices"][0]["message"]["content"]
        # AI'ın metni içinden sadece [...] köşeli parantezli diziyi (array) cımbızlıyoruz
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            json_str = match.group(0)
            return json.loads(json_str)
        else:
            print("JSON Dizisi bulunamadi! AI Cevabi:", content)
            return []
    except Exception as e:
        print("Yapay Zeka Hatasi:", e)
        return []

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
        print(f"4. Tam {len(ai_data_list)} adet haber veritabanina kaydediliyor...")
        
        for item in ai_data_list:
            save_to_firestore(token, item)
            
        print("🚀 ISLEM BASARIYLA TAMAMLANDI!")
    else:
        print("❌ Haber listesi alinamadi.")

if __name__ == "__main__":
    main()