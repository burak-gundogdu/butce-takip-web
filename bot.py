import os
import requests
import json
import time

# KİMLİK BİLGİLERİ (Bunları GitHub'a gizli şifre olarak gireceğiz)
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = "butce-takip-d3682"
FIREBASE_EMAIL = os.environ.get("FIREBASE_EMAIL")       # Uygulamaya giriş yaptığın email
FIREBASE_PASSWORD = os.environ.get("FIREBASE_PASSWORD") # Uygulamaya giriş yaptığın şifre
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

def get_firebase_token():
    """Admin hesabınla Firebase'e giriş yapıp yetki anahtarı alır."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True}
    res = requests.post(url, json=payload).json()
    if "idToken" not in res:
        raise Exception(f"Firebase Giris Basarisiz: {res}")
    return res["idToken"]

def fetch_news():
    """TRT Haber'den en güncel 5 haberi çeker."""
    rss_url = "https://api.rss2json.com/v1/api.json?rss_url=https://www.trthaber.com/ekonomi_articles.rss"
    res = requests.get(rss_url).json()
    if res.get("status") == "ok":
        titles = [item["title"] for item in res["items"][:5]]
        return "\n".join(titles)
    return ""

def analyze_with_ai(news_text):
    """Haberleri Groq Yapay Zekasına yorumlatır ve şık bir kart formatına çevirir."""
    if not news_text: return None
    
    system_prompt = """Sen uzman bir Wall Street finans analistisin. 
Aşağıdaki haberlerden EN ÇARPICI 1 tanesini seç.
Bunu kullanıcılar için kaydırmalı (TikTok tarzı) bir finans kartına dönüştüreceğiz.
LÜTFEN SADECE AŞAĞIDAKİ JSON FORMATINDA YANIT VER.

{
  "baslik": "Haberin ilgi çekici kısa başlığı",
  "icerik": "Haberin 2-3 cümlelik özeti",
  "analiz": "Yapay zekanın bu haberin piyasaya etkisi hakkındaki kısa yorumu (Risk veya Fırsat uyarısı)",
  "etiket": "🟢 Pozitif" veya "🔴 Riskli" veya "⚪ Nötr",
  "tip": "haber"
}"""

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
        json_str = content[content.find('{'):content.rfind('}')+1]
        return json.loads(json_str)
    except Exception as e:
        print("Yapay Zeka Hatasi:", e)
        return None

def save_to_firestore(token, data):
    """Veriyi Firebase'e (Kullanıcıların ekranına) basar."""
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/announcements"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Firestore veri formatı (JSON'u Firestore'un anladığı dile çeviriyoruz)
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
    res = requests.post(url, headers=headers, json=firestore_doc)
    print("Firebase Yaniti:", res.status_code)

def main():
    print("1. Haberler cekiliyor...")
    news = fetch_news()
    print("2. Yapay zekaya analiz ettiriliyor...")
    ai_data = analyze_with_ai(news)
    
    if ai_data:
        print("3. Firebase'e giris yapiliyor...")
        token = get_firebase_token()
        print("4. Veritabanina kaydediliyor...")
        save_to_firestore(token, ai_data)
        print("🚀 ISLEM BASARIYLA TAMAMLANDI!")
    else:
        print("❌ Haber analiz edilemedi.")

if __name__ == "__main__":
    main()