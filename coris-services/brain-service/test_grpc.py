#!/usr/bin/env python
"""
Test script untuk Brain Service gRPC.
Kirim perintah dan lihat response 3D assembly.
"""

import grpc
import coris_pb2
import coris_pb2_grpc
import json


def test_brain_service(prompt: str):
    """Test brain service dengan prompt sederhana."""
    
    print("=" * 60)
    print(f"🧪 Testing Brain Service")
    print(f"📝 Prompt: {prompt}")
    print("=" * 60)
    
    try:
        # Connect to gRPC server
        channel = grpc.insecure_channel('localhost:50051')
        stub = coris_pb2_grpc.CorisServiceStub(channel)
        
        # Send request
        request = coris_pb2.CommandRequest(
            text=prompt,
            is_voice=False
        )
        
        print("⏳ Mengirim request ke brain service...")
        response = stub.SendCommand(request, timeout=60)
        
        # Print response
        print("\n✅ Response received!")
        print(f"🗣️  Speech: {response.speech_feedback}")
        print(f"📐 Mode: {response.mode}")
        print(f"🔧 Assembly count: {len(response.assembly)}")
        
        if response.assembly:
            print("\n📦 Components:")
            for i, comp in enumerate(response.assembly, 1):
                print(f"\n  [{i}] {comp.type} (id: {comp.id})")
                print(f"      Position: {list(comp.position)}")
                print(f"      Scale: {list(comp.scale)}")
                print(f"      Color: {comp.color}")
                print(f"      Material: roughness={comp.material.roughness}, "
                      f"metalness={comp.material.metalness}, "
                      f"clearcoat={comp.material.clearcoat}")
        
        return response
        
    except grpc.RpcError as e:
        print(f"\n❌ gRPC Error: {e.code()}: {e.details()}")
        return None
    except Exception as e:
        print(f"\n❌ Unexpected error: {type(e).__name__}: {e}")
        return None


if __name__ == "__main__":
    # Test prompts
    test_cases = [
        "Buatkan meja kayu sederhana",
        "Rakit gedung C UMN",
    ]
    
    for prompt in test_cases:
        test_brain_service(prompt)
        print("\n" + "=" * 60 + "\n")
