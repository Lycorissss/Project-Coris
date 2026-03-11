# 🤖 PROJECT CORIS - AI 3D Architect

Project ini adalah sistem asisten AI cerdas bernama **Coris** yang mampu merakit dan memvisualisasikan objek 3D secara real-time berdasarkan instruksi bahasa manusia.

## 🏗️ Arsitektur Sistem

Sistem ini terdiri dari tiga komponen utama yang saling terhubung:

### 1. [Mobile App](./coris-mobile) (The Eyes)
- **Tech Stack:** Expo, React Native, Three.js (@react-three/fiber), TensorFlow.js.
- **Fungsi:** 
  - Menampilkan visualisasi 3D AR.
  - Mendeteksi gerakan tangan (Hand Tracking) untuk interaksi objek.
  - Mengirim perintah chat/suara ke backend.

### 2. [Orchestrator](./coris-orchestrator) (The Nervous System)
- **Tech Stack:** Go (Golang), WebSocket, gRPC.
- **Fungsi:** 
  - Mengelola koneksi real-time dengan HP via WebSocket.
  - Menjembatani komunikasi antara HP dan Otak AI menggunakan gRPC.
  - Melakukan mapping data komponen 3D.

### 3. [Brain Service](./coris-services/brain-service) (The Mind)
- **Tech Stack:** Python, gRPC, Google Gemini 2.0 Flash API.
- **Fungsi:** 
  - Memproses perintah bahasa alami menjadi blueprint 3D.
  - Menghitung koordinat posisi, skala, dan material secara presisi.
  - Logika perakitan objek (Meja, Kursi, Robot, dll).

## 🚀 Cara Menjalankan

1. **Jalankan Otak (Python):**
   ```bash
   cd coris-services/brain-service
   python brain_server.py
   ```

2. **Jalankan Saraf (Go):**
   ```bash
   cd coris-orchestrator
   go run main.go
   ```

3. **Jalankan Mata (Mobile):**
   ```bash
   cd coris-mobile
   bun expo start
   ```

## 🧠 Fitur Coris Saat Ini
- **Logic Constraints:** Coris mengerti gravitasi (benda tidak melayang).
- **Hand Gesture:** Rotasi objek bisa dikendalikan dengan posisi tangan di depan kamera.
- **Adaptive Assembly:** Bisa menambah komponen (APPEND) atau mengganti objek (REPLACE).

---
*Dibuat oleh Abang Septy & Coris AI*
