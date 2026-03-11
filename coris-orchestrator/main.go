package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"coris-orchestrator/pb"
	"github.com/gorilla/websocket"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Struktur data yang dikirim ke HP (Mata)
type MobileResponse struct {
	SpeechFeedback string      `json:"speech_feedback"`
	Mode           string      `json:"mode"`
	Data           interface{} `json:"data"` 
}

func handleConnection(w http.ResponseWriter, r *http.Request, grpcClient pb.CorisServiceClient) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Gagal upgrade ke WebSocket: %v", err)
		return
	}
	defer conn.Close()

	log.Println("📱 HP Abang Terhubung ke Saraf Go!")

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("🔌 HP terputus")
			break
		}

		log.Printf("📩 Terima perintah dari HP: %s", string(message))

		// 1. Oper ke Otak Python lewat gRPC (Timeout 1 Menit biar AI leluasa mikir)
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		res, err := grpcClient.SendCommand(ctx, &pb.CommandRequest{
			Text:    string(message),
			IsVoice: false,
		})
		cancel()

		if err != nil {
			log.Printf("❌ Otak (Python) error: %v", err)
			continue
		}

		// 2. MAPPING: Ubah hasil gRPC ke format JSON yang dimengerti HP
		// Ini penting Bang, biar di HP panggilnya v.type bukan v.Type
		var assemblyList []map[string]interface{}
		for _, comp := range res.Assembly {
			componentMap := map[string]interface{}{
				"id":       comp.Id,
				"type":     comp.Type,
				"position": comp.Position,
				"scale":    comp.Scale,
				"color":    comp.Color,
				"material": map[string]float32{
					"roughness": comp.Material.Roughness,
					"metalness": comp.Material.Metalness,
					"clearcoat": comp.Material.Clearcoat,
				},
			}
			assemblyList = append(assemblyList, componentMap)
		}

		// 3. Susun Paket Akhir
		finalResponse := MobileResponse{
			SpeechFeedback: res.SpeechFeedback,
			Mode:           res.Mode,
			Data:           assemblyList,
		}

		// 4. Kirim ke HP via WebSocket
		responseJSON, _ := json.Marshal(finalResponse)
		if err := conn.WriteMessage(websocket.TextMessage, responseJSON); err != nil {
			log.Printf("❌ Gagal kirim data ke HP: %v", err)
		} else {
			log.Printf("✅ Berhasil kirim %d komponen ke HP (Mode: %s)", len(assemblyList), res.Mode)
		}
	}
}

func main() {
	// Konek ke gRPC Python (Otak)
	conn, err := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("❌ Gagal konek ke Otak Python: %v", err)
	}
	defer conn.Close()
	
	grpcClient := pb.NewCorisServiceClient(conn)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleConnection(w, r, grpcClient)
	})

	log.Println("📡 Saraf Go (WebSocket) standby di port 8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("❌ ListenAndServe error: ", err)
	}
}