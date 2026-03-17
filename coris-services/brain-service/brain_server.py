import grpc
from concurrent import futures
import coris_pb2
import coris_pb2_grpc
import json
import os
from dotenv import load_dotenv
import requests

load_dotenv()


class CorisService(coris_pb2_grpc.CorisServiceServicer):
    def SendCommand(self, request, context):
        print(f"📩 Perintah masuk: {request.text}")

        # 1. Tanya ke AI
        ai_response = self.ask_ai(request.text)

        try:
            data = json.loads(ai_response)

            # Buat response sesuai kontrak baru
            response = coris_pb2.CommandResponse(
                speech_feedback=data.get("speech", "Siap Bang!"),
                mode=data.get("mode", "REPLACE"),
            )

            # --- PERHATIKAN INDENTASI DI SINI, BANG ---
            for item in data.get("assembly", []):
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
                # Gunakan extend untuk repeated fields
                component.position.extend(
                    [float(x) for x in item.get("position", [0.0, 0.0, 0.0])]
                )
                component.scale.extend(
                    [float(s) for s in item.get("scale", [1.0, 1.0, 1.0])]
                )

                response.assembly.append(component)

            print(f"✅ AI Berhasil merakit {len(response.assembly)} komponen.")
            return response

        except Exception as e:
            print(f"❌ Error parsing AI: {e}")
            return coris_pb2.CommandResponse(
                speech_feedback="Maaf Bang, Otak lagi nge-lag."
            )

    def ask_ai(self, prompt):
        api_key = os.getenv("OPENROUTER_API_KEY")
        url = "https://openrouter.ai/api/v1/chat/completions"

        system_prompt = """
            <coris_identity>
                Kamu adalah Coris, Senior Arsitek 3D dan Database Expert. 
                Tugas utama: Merakit objek 3D UTUH dan presisi tinggi berdasarkan instruksi user.
            </coris_identity>

            <spatial_logic>
    - Sumbu Y: Atas. Tanah: Y=0.
    - Pivot: Tengah objek. 
    - Rumus Menempel Tanah: Posisi Y = (Scale Y / 2).
    - Rumus Menempel Alas: Jika Kaki tinggi 1.0 (Posisi Y=0.5), maka Alas harus berada di Posisi Y = 1.0 + (Tebal_Alas / 2).
</spatial_logic>

            <blueprint_rules>
    <table_template>
        Wajib 5 Komponen Terintegrasi:
        1. Alas (Top): Box, scale [2.0, 0.1, 1.2], position [0, 1.05, 0]. (Tebal 0.1, nempel tepat di atas kaki).
        2. Kaki (4 unit): Cylinder/Box, scale [0.1, 1.0, 0.1].
        3. Koordinat Kaki (Sudut Presisi): 
           - Depan Kanan: [0.9, 0.5, 0.5]
           - Depan Kiri: [-0.9, 0.5, 0.5]
           - Belakang Kanan: [0.9, 0.5, -0.5]
           - Belakang Kiri: [-0.9, 0.5, -0.5]
    </table_template>
    
    <logic_constraints>
        - JANGAN biarkan ada celah (gap) antara kaki dan alas.
        - Pastikan ID unik: "table_top", "leg_fr", "leg_fl", "leg_br", "leg_bl".
        - Gunakan Mode 'REPLACE' jika instruksinya adalah benda baru.
    </logic_constraints>
</blueprint_rules>

            <output_constraints>
                - Mode: Gunakan 'REPLACE' untuk objek baru, 'APPEND' untuk tambahan/modifikasi.
                - Color: Wajib menggunakan HEX CODE (contoh: #FFFFFF).
                - Unique_ID: Setiap komponen dalam 'assembly' wajib memiliki ID unik (contoh: kaki_kanan_depan).
                - Format: Jawab HANYA dalam JSON murni tanpa markdown.
            </output_constraints>

            <response_format>
            {
            "speech": "Pesan suara Coris dalam Bahasa Indonesia",
            "mode": "REPLACE/APPEND",
            "assembly": [
                {
                "id": "string",
                "type": "box|sphere|cylinder|cone|torus",
                "position": [x, y, z],
                "scale": [x, y, z],
                "color": "#HEX",
                "material": { "roughness": float, "metalness": float, "clearcoat": float }
                }
            ]
            }
            </response_format>
            """

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "google/gemini-2.0-flash-001",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        try:
            res = requests.post(url, headers=headers, json=payload, timeout=45)
            return res.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"❌ API Error: {e}")
            return json.dumps(
                {"speech": "Error API", "mode": "REPLACE", "assembly": []}
            )


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    coris_pb2_grpc.add_CorisServiceServicer_to_server(CorisService(), server)
    server.add_insecure_port("[::]:50051")
    print("🚀 The Brain Coris (Python) AKTIF di port 50051...")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
