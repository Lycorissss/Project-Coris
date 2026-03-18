import requests

base_url = "http://127.0.0.1:9000"
endpoints = ["/", "/v1/chat/completions", "/chat", "/generate", "/api/v1/chat"]

print(f"🔍 Mencoba koneksi ke {base_url}...")

for ep in endpoints:
    url = f"{base_url}{ep}"
    try:
        # Kita coba pakai GET dulu buat liat info servernya
        resp = requests.get(url, timeout=2)
        print(f"✅ {ep} -> Status: {resp.status_code}")
    except Exception as e:
        try:
            # Kalau GET ditolak, coba POST (karena AI biasanya nerima POST)
            resp = requests.post(url, json={"prompt": "test"}, timeout=2)
            print(f"🚀 {ep} (POST) -> Status: {resp.status_code}")
        except:
            print(f"❌ {ep} -> Failed")
