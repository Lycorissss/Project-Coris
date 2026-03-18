# 🤖 PROJECT CORIS - AI 3D Architect

Project ini adalah asisten AI cerdas bernama **Coris** yang mampu merakit, memvisualisasikan, dan mengelola desain objek 3D secara real-time berdasarkan instruksi bahasa manusia. Sistem ini menggabungkan AI Generative, Hand-Tracking (Computer Vision), dan komunikasi antar layanan yang cepat.

---

## 🏗️ Arsitektur Sistem (The Ecosystem)

Sistem ini mengikuti arsitektur **Microservices** yang terbagi menjadi beberapa bagian fungsional:

### 1. [Mobile App (The Eyes)](./coris-mobile)
- **Tech Stack:** Expo, React Native, Three.js (@react-three/fiber), TensorFlow.js.
- **Fungsi:** 
  - Visualisasi 3D Augmented Reality (AR) di layar HP.
  - Hand Tracking (Mendeteksi posisi tangan) untuk memutar atau memindahkan objek.
  - Input suara/chat untuk memberi perintah ke Coris.

### 2. [Orchestrator (The Nervous System)](./coris-orchestrator)
- **Tech Stack:** Go (Golang), WebSocket, gRPC.
- **Fungsi:** 
  - Jalur komunikasi utama antar layanan.
  - Menjembatani HP (WebSocket) dengan Brain Service (gRPC).
  - Mengelola sinkronisasi data 3D agar visualisasi di HP selalu update.

### 3. [Brain Service (The Logical Mind)](./coris-services/brain-service)
- **Tech Stack:** Python, gRPC, NullClaw Gateway.
- **Fungsi:** 
  - Sebagai *Bridge Service* yang menerima permintaan dari Orchestrator.
  - Meneruskan teks perintah ke NullClaw Gateway.
  - Melakukan parsing dari format teks AI menjadi format `assembly` 3D (posisi, skala, warna) yang dimengerti oleh sistem.

### 4. [Brain Gateway (The Intellect - NullClaw)](./coris-services/brain-gateway)
- **Tech Stack:** NullClaw (Zig-based AI Gateway), Memory Modules.
- **Fungsi:** 
  - Pusat kecerdasan yang menggunakan LLM (Gemini 2.0 Flash).
  - Mengelola memori jangka panjang, instruksi arsitektural (blueprint), dan pengetahuan kampus UMN.
  - Menyuntikkan konteks (personality) sebelum mengirim perintah ke AI model.

### 5. [Web Platform](./coris-web)
- **Tech Stack:** Next.js, Tailwind CSS v4, React 19, Three.js (@react-three/fiber).
- **Fungsi:** 
  - Versi Web dari sistem Coris dengan fitur visualisasi 3D yang sama dengan mobile.
  - Memungkinkan user merakit dan melihat objek 3D langsung di browser desktop/laptop.

---

## 📁 Struktur Folder (Project Navigator)

Berikut adalah peta folder lengkap untuk Project Coris:

```bash
PROJECT-CORIS/
├── 📱 coris-mobile/          # App React Native (Eyes)
│   ├── app/                 # Navigasi dan Halaman utama
│   ├── components/          # Komponen UI & 3D (AR Scene)
│   └── assets/              # Gambar, icon, dan 3D models dasar
├── 🌐 coris-web/             # Coris Web Platform (Next.js)
├── ⚙️ coris-orchestrator/    # Go Backend (Nervous System)
│   ├── pb/                  # Definisi gRPC & Protobuf
│   └── main.go              # Entry point koneksi WebSocket
├── 🧠 coris-services/        # Kumpulan Layanan Backend Python
│   ├── brain-service/       # Python gRPC Bridge (Logical Mind)
│   │   ├── brain_server.py  # Server utama penghubung NullClaw
│   │   └── coris_pb2.py     # Proto definitions untuk Python
│   ├── brain-gateway/       # NullClaw Engine (Intellect)
│   │   ├── nullclaw         # Binary executable NullClaw
│   │   ├── config.json      # Konfigurasi port & workspace
│   │   ├── AGENTS.md        # Definisi kepribadian Coris
│   │   ├── architect_skill.md # Logika teknik rakitan voxel
│   │   ├── umn_knowledge.md # Database pengetahuan UMN
│   │   └── memory/          # Database memori episodic
│   └── voice-service/       # (Eksperimental) Pemrosesan suara
├── 📑 shared/                # Definisi Kontrak Data
│   └── coris.proto          # Blueprint komunikasi antar semua service
└── README.md                # Dokumentasi utama ini
```

---

## 🔌 Manajemen Port & Protokol

Pastikan port-port berikut tersedia di sistem Anda:

| Service | Port | Protokol | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Mobile App (Bundler)** | `8081` | HTTP (Metro) | Expo CLI bundling & Dev Tools |
| **Web Platform** | `3000` | HTTP | Akses visualisasi & perakitan via Browser |
| **Orchestrator** | `8080` | WebSocket | Hubungan data real-time dengan HP |
| **Brain Service** | `50051` | gRPC | Komunikasi internal Python <-> Go |
| **NullClaw Gateway** | `9000` | HTTP/JSON | Pusat kecerdasan AI & Memory |

---

## 🚀 Cara Menjalankan (Step-by-Step)

Untuk menjalankan ekosistem Coris secara utuh, ikuti urutan berikut:

1. **Jalankan NullClaw Gateway (WSL):**
   ```bash
   cd coris-services/brain-gateway
   ./nullclaw gateway
   ```
   *NullClaw harus aktif agar "Otak" bisa berpikir menggunakan memory.*

2. **Jalankan Brain Service (Python):**
   ```bash
   cd coris-services/brain-service
   python brain_server.py
   ```
   *Ini akan membuka listener gRPC di port 50051.*

3. **Jalankan Orchestrator (Go):**
   ```bash
   cd coris-orchestrator
   go run main.go
   ```
   *Layanan ini akan menyatukan gRPC dan WebSocket.*

4. **Jalankan Mobile App (Expo):**
   ```bash
   cd coris-mobile
   bun expo start
   ```
   *Scan QR code menggunakan HP atau jalankan di Emulator.*

---

## 🧠 Fitur Unggulan Coris
- **Logic Constraints:** Coris tidak asal menaruh objek; ia memahami gravitasi dan tumpuan.
- **UMN Context Aware:** Coris tahu perbedaan Gedung C (New Media Tower - Elips) dan Gedung D (PK Ojong - Kotak) di UMN.
- **Hand Gesture Control:** Gunakan gerakan tangan untuk memutar objek 3D di layar AR.
- **Adaptive Assembly:** Gunakan perintah *"Tambahkan..."* (APPEND) atau *"Ganti objek ke..."* (REPLACE).

---
*Dokumentasi ini dibuat untuk Abang Septy & Sistem Coris AI (Senior Voxel Architect).*
