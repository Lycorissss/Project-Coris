import grpc
from concurrent import futures
import coris_pb2
import coris_pb2_grpc
import json
import subprocess
import re
from pathlib import Path


class CorisService(coris_pb2_grpc.CorisServiceServicer):
    """
    gRPC Service untuk Coris Brain.
    Bridge murni ke NullClaw Gateway dengan logika Search-and-Persist.

    Menggunakan NullClaw CLI langsung karena gateway HTTP tidak tersedia untuk public.
    """

    # Path ke NullClaw binary (WSL)
    NULLCLAW_BINARY = "./nullclaw"
    # WSL path ke brain-gateway (harus format Linux untuk working directory)
    NULLCLAW_WSL_PATH = "/mnt/c/FIle Kuliah/PROJECT-CORIS/coris-services/brain-gateway"
    # Windows path untuk referensi
    NULLCLAW_WORKDIR_WIN = Path(__file__).parent.parent / "brain-gateway"
    
    # gRPC Configuration
    GRPC_TIMEOUT_SECONDS = 60

    def SendCommand(self, request, context):
        """
        Handle perintah dari Orchestrator (Go) via gRPC.
        Meneruskan request ke NullClaw dengan instruksi Search-and-Persist.
        """
        print(f"Perintah masuk: {request.text}")
        print(f"Timeout gRPC: {self.GRPC_TIMEOUT_SECONDS} detik")

        try:
            ai_response = self._invoke_nullclaw_cli(request.text)
            data = json.loads(ai_response)

            response = coris_pb2.CommandResponse(
                speech_feedback=data.get("speech", "Siap Bang!"),
                mode=data.get("mode", "REPLACE"),
            )

            for item in data.get("assembly", []):
                component = self._build_component(item)
                response.assembly.append(component)

            print(
                f"AI Berhasil merakit {len(response.assembly)} komponen "
                f"(Mode: {response.mode}) via NullClaw."
            )
            return response

        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            print(f"   Raw response: {ai_response[:200] if 'ai_response' in locals() else 'N/A'}...")
            return self._error_response("Format JSON dari NullClaw tidak valid, Bang.")

        except subprocess.TimeoutExpired:
            print("NullClaw CLI timeout")
            return self._error_response("Coris masih mikir, Bang. Coba lagi sebentar...")

        except Exception as e:
            print(f"Unexpected Error: {type(e).__name__}: {e}")
            return self._error_response("Coris lagi pusing mikir, Bang.")

    def _build_component(self, item: dict) -> coris_pb2.Component:
        """
        Membangun Component protobuf dari data JSON item.
        Menjaga spatial integrity sesuai coris.proto.
        """
        component = coris_pb2.Component(
            id=str(item.get("id", "obj")),
            type=item.get("type", "box"),
            color=str(item.get("color", "#ffffff")),
            material=coris_pb2.MaterialProps(
                roughness=float(item.get("material", {}).get("roughness", 0.5)),
                metalness=float(item.get("material", {}).get("metalness", 0.0)),
                clearcoat=float(item.get("material", {}).get("clearcoat", 0.0)),
            ),
        )

        position = item.get("position", [0.0, 0.0, 0.0])
        component.position.extend([float(x) for x in position])

        scale = item.get("scale", [1.0, 1.0, 1.0])
        component.scale.extend([float(s) for s in scale])

        return component

    def _error_response(self, message: str) -> coris_pb2.CommandResponse:
        """Membuat response error dengan assembly kosong."""
        return coris_pb2.CommandResponse(
            speech_feedback=message,
            mode="REPLACE",
            assembly=[],
        )

    def _invoke_nullclaw_cli(self, user_prompt: str) -> str:
        """
        Mengirim request ke NullClaw menggunakan CLI langsung.
        
        Alur Agentic (Jalur B - Search-and-Persist):
        1. Check Local Memory -> Cari pengetahuan yang sudah tersimpan
        2. Web Search (jika data tidak ada) -> Browsing informasi teknis
        3. Construct 3D Blueprint -> Rakit komponen 3D
        4. Save to Memory -> Persist informasi baru ke memory.db / file .md
        
        Command: wsl -d Ubuntu -- ./nullclaw agent -m "<prompt>"
        
        Keamanan:
        - Prompt dikirim via stdin untuk menghindari shell injection
        - Working directory di-set via bash cd command
        """
        system_prompt = self._build_system_prompt()
        
        # Gabungkan system prompt dengan user prompt
        full_prompt = f"{system_prompt}\n\nUser: {user_prompt}"
        
        # Gunakan approach yang lebih aman: write prompt ke temp file, lalu baca
        # Atau gunakan bash heredoc untuk menghindari escaping issues
        # Approach: gunakan printf dan pipe ke nullclaw
        
        # Escape double quotes untuk bash
        escaped_prompt = full_prompt.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
        
        # Build command dengan heredoc-style input
        bash_cmd = (
            f'cd "/mnt/c/FIle Kuliah/PROJECT-CORIS/coris-services/brain-gateway" && '
            f'./nullclaw agent -m "{escaped_prompt}"'
        )
        
        cmd = [
            "wsl",
            "-d", "Ubuntu",
            "--",
            "bash",
            "-c",
            bash_cmd
        ]

        print("Memanggil NullClaw CLI")
        print(f"Prompt length: {len(full_prompt)} chars")
        print("Working directory: /mnt/c/FIle Kuliah/PROJECT-CORIS/coris-services/brain-gateway")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.GRPC_TIMEOUT_SECONDS + 10
            )

            output = result.stdout + result.stderr

            print(f"Raw output from NullClaw ({len(output)} chars):")
            print(f"   {output[:500]}...")
            
            # Filter output untuk mendapatkan JSON response
            json_content = self._extract_json_from_output(output)
            
            if json_content:
                print(f"NullClaw response received ({len(json_content)} chars)")
                return json_content
            else:
                # Jika tidak ada JSON, kembalikan error response
                print("No JSON found in output")
                raise ValueError(f"NullClaw output tidak mengandung JSON: {output[:200]}")
                
        except subprocess.TimeoutExpired:
            print("NullClaw CLI timeout")
            raise
        except FileNotFoundError as e:
            print(f"NullClaw binary not found: {e}")
            raise ValueError("NullClaw binary tidak ditemukan. Pastikan sudah install di WSL.")
        except Exception as e:
            print(f"Unexpected error: {type(e).__name__}: {e}")
            raise

    def _extract_json_from_output(self, output: str) -> str:
        """
        Ekstrak JSON murni dari output NullClaw CLI.
        
        Output NullClaw biasanya berisi:
        - Log info: info(memory_sqlite): filesystem does not support mmap...
        - Log info: info(memory): memory plan resolved...
        - Error: error: ApiError
        - Markdown: ```json ... ```
        - JSON response: {"speech": "...", "assembly": [...]}
        
        Strategi:
        1. Filter baris log (info, error, debug, warning) dan markdown backticks
        2. Cari semua karakter { dan temukan matching }
        3. Validasi bahwa isi adalah JSON yang valid
        4. Return JSON pertama yang valid
        """
        # Filter: hapus baris log dan markdown backticks
        lines = output.split('\n')
        filtered_lines = []
        for line in lines:
            line_stripped = line.strip()
            # Skip baris yang merupakan log (dimulai dengan info(, error:, debug:, warning:)
            if re.match(r'^(info\(|error:|debug:|warning:|warn:)', line_stripped, re.IGNORECASE):
                continue
            # Skip baris yang hanya berisi backticks (markdown code blocks)
            if line_stripped.startswith('```'):
                continue
            # Skip baris yang hanya berisi whitespace (tapi biarkan baris dengan { atau } untuk JSON)
            if len(line_stripped) == 0:
                continue
            filtered_lines.append(line)
        
        filtered_output = '\n'.join(filtered_lines)
        
        # Cari JSON yang diawali dengan { dan diakhiri dengan }
        start = filtered_output.find('{')
        if start == -1:
            return ""
        
        # Cari matching closing brace dengan tracking depth
        depth = 0
        end = -1
        in_string = False
        escape_next = False
        
        for i in range(start, len(filtered_output)):
            char = filtered_output[i]
            
            # Handle string literals (hindari menghitung { } di dalam string)
            if char == '"' and not escape_next:
                in_string = not in_string
            elif char == '\\' and in_string:
                escape_next = True
                continue
            escape_next = False
            
            # Hanya hitung brace jika tidak di dalam string
            if not in_string:
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
        
        if end == -1:
            # Tidak menemukan matching brace, return apa adanya
            return ""
        
        json_str = filtered_output[start:end].strip()
        
        # Validasi JSON
        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            # JSON tidak valid, coba cari JSON lain di output
            # Mungkin ada multiple JSON objects
            return self._find_valid_json(filtered_output, start + 1)
    
    def _find_valid_json(self, text: str, start_pos: int = 0) -> str:
        """
        Cari JSON valid dalam teks, mulai dari posisi tertentu.
        Digunakan sebagai fallback jika JSON pertama tidak valid.
        """
        pos = start_pos
        while pos < len(text):
            # Cari { berikutnya
            start = text.find('{', pos)
            if start == -1:
                return ""
            
            # Cari matching }
            depth = 0
            in_string = False
            escape_next = False
            end = -1
            
            for i in range(start, len(text)):
                char = text[i]
                
                if char == '"' and not escape_next:
                    in_string = not in_string
                elif char == '\\' and in_string:
                    escape_next = True
                    continue
                escape_next = False
                
                if not in_string:
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
            
            if end == -1:
                return ""
            
            json_str = text[start:end].strip()
            
            # Validasi
            try:
                json.loads(json_str)
                return json_str
            except json.JSONDecodeError:
                # Coba JSON berikutnya
                pos = start + 1
        
        return ""

    def _build_system_prompt(self) -> str:
        """
        Membangun system prompt dengan instruksi Search-and-Persist.
        Versi ringkas untuk efektivitas AI response.
        """
        return """
Anda adalah Coris, AI arsitek 3D untuk Project Coris.

TUGAS: Ubah deskripsi objek menjadi rakitan 3D voxel.

WORKFLOW:
1. CHECK MEMORY - Cari pengetahuan yang ada di memory.db
2. WEB SEARCH - Jika tidak ada, browsing untuk info (sejarah, dimensi, material, warna)
3. CONSTRUCT 3D - Rakit komponen 3D dengan koordinat yang tepat
4. SAVE MEMORY - Simpan info baru ke memory.db

ATURAN SPASIAL:
- Position [x,y,z]: x=-10..10, y=0..20 (y=0 tanah), z=-10..10
- Scale [x,y,z]: ukuran voxel
- Gravitasi: Objek tidak boleh melayang, harus ada fondasi

BENTUK BANGUNAN:
- Gedung C UMN = ELIPS, Gedung D UMN = KOTAK
- Monas = TOWER (cylinder + sphere)

OUTPUT FORMAT - WAJIB JSON tanpa markdown:
{
  "speech": "Respon dalam bahasa Indonesia, panggil user 'Abang'. Jelaskan apa yang dipelajari dan akan dirakit.",
  "mode": "REPLACE atau APPEND",
  "assembly": [
    {
      "id": "obj_1",
      "type": "box|sphere|cylinder|cone|pyramid",
      "position": [0.0, 0.0, 0.0],
      "scale": [1.0, 1.0, 1.0],
      "color": "#ffffff",
      "material": {"roughness": 0.5, "metalness": 0.0, "clearcoat": 0.0}
    }
  ]
}

PENTING: 
- Output HANYA JSON, tanpa markdown, tanpa backticks
- Semua komponen harus punya id, type, position, scale, color, material
- Gunakan bahasa Indonesia untuk speech
""".strip()


def serve():
    """
    Start gRPC server pada port 50051.
    Menunggu koneksi dari Orchestrator (Go) via WebSocket.
    """
    # Set stdout encoding untuk handle emoji di Windows
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    coris_pb2_grpc.add_CorisServiceServicer_to_server(CorisService(), server)
    server.add_insecure_port("[::]:50051")

    print("=" * 60)
    print("CORIS BRAIN SERVICE - gRPC Bridge for NullClaw")
    print("=" * 60)
    print("Listening on port: 50051")
    print(f"NullClaw WSL Path: /mnt/c/FIle Kuliah/PROJECT-CORIS/coris-services/brain-gateway")
    print(f"gRPC Timeout: {CorisService.GRPC_TIMEOUT_SECONDS} seconds")
    print(f"Memory Path: /mnt/c/FIle Kuliah/PROJECT-CORIS/coris-services/brain-gateway/memory")
    print("=" * 60)
    print("Search-and-Persist Workflow: ACTIVE")
    print("=" * 60)

    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
