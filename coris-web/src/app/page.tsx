'use client';

import React, { useState, useEffect } from 'react';
import { HandTracking, HandTrackingData } from '@/components/HandTracking';
import { ARScene } from '@/components/ARScene';
import { Send, Terminal, Box } from 'lucide-react';

const defaultHandData: HandTrackingData = {
  isHandDetected: false,
  landmarks: null,
  pinchPosition: null,
  isPinching: false,
};

export default function Home() {
  const [handData, setHandData] = useState<HandTrackingData>(defaultHandData);
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [assemblyList, setAssemblyList] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // 1. WebSocket Connection
  useEffect(() => {
    const socketUrl = `ws://${window.location.hostname}:8080/ws`;
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      setLogs(prev => [...prev.slice(-10), `🌐 Uplink: ${socketUrl} ESTABLISHED`]);
    };

    socket.onmessage = (e) => {
      try {
        const res = JSON.parse(e.data);
        if (res.speech_feedback) {
          setLogs(prev => [...prev.slice(-10), `🤖 Coris: ${res.speech_feedback}`]);
        }
        if (res.data) {
          if (res.mode === "REPLACE") setAssemblyList(res.data);
          else setAssemblyList(prev => [...prev, ...res.data]);
        }
      } catch (err) {}
    };

    socket.onerror = () => {
      setLogs(prev => [...prev.slice(-10), "⚠️ Connection: FAILED. Check backend."]);
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const sendCommand = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (ws && ws.readyState === WebSocket.OPEN && command.trim()) {
      ws.send(command);
      setLogs(prev => [...prev.slice(-10), `👤 Abang: ${command}`]);
      setCommand('');
    }
  };

  const handleHandDataUpdate = (data: HandTrackingData) => {
    setHandData(data);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-[family-name:var(--font-geist-sans)]">
      {/* HandTracking component provides the Camera Feed and Skeleton Lines */}
      <HandTracking onHandDataUpdate={handleHandDataUpdate}>
        {/* ARScene renders the 3D objects and handles hand-based rotation */}
        <ARScene handData={handData} assemblyList={assemblyList} />
      </HandTracking>

      {/* UI Overlay: Log HUD */}
      <div className="absolute top-0 inset-x-0 z-40 p-6 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl p-3 shadow-2xl w-full max-w-sm pointer-events-auto ring-1 ring-white/10">
          <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2">
            <Terminal size={14} className="text-cyan-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">System Logs</span>
          </div>
          <div className="space-y-1 font-mono text-[10px] max-h-24 overflow-y-auto scrollbar-hide">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 text-left">
                <span className="text-cyan-800 text-[9px]">[{new Date().toLocaleTimeString()}]</span>
                <span className={log.includes('🤖') ? 'text-cyan-400' : log.includes('👤') ? 'text-zinc-300' : 'text-zinc-500 italic'}>
                  {log}
                </span>
              </div>
            ))}
            {logs.length === 0 && <div className="text-zinc-700 italic text-[10px]">Awaiting Signal...</div>}
          </div>
        </div>
      </div>

      {/* UI Overlay: Command Input */}
      <div className="absolute bottom-0 inset-x-0 z-40 p-8 flex flex-col items-center pointer-events-none">
        <div className="w-full max-w-2xl pointer-events-auto">
          <form onSubmit={sendCommand} className="group relative flex items-center gap-2 bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 pl-4 shadow-2xl focus-within:ring-2 ring-cyan-500/40 transiton-all">
            <Box size={20} className="text-zinc-500 group-focus-within:text-cyan-400" />
            <input 
              type="text" 
              className="flex-1 bg-transparent border-none outline-none text-white py-3 px-2 placeholder:text-zinc-600 font-medium" 
              placeholder="Masukan perintah (cth: buat meja)..." 
              value={command} 
              onChange={(e) => setCommand(e.target.value)} 
            />
            <button 
              type="submit" 
              className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-xl transition-all shadow-lg flex items-center gap-2 px-6 font-bold uppercase text-[10px] tracking-widest"
              disabled={!command.trim() || ws?.readyState !== WebSocket.OPEN}
            >
              Execute <Send size={14} />
            </button>
          </form>
        </div>
        <p className="mt-4 text-[10px] text-zinc-500 font-mono tracking-widest pointer-events-none">
          SYSTEM STATUS: {ws?.readyState === WebSocket.OPEN ? 'LINK ONLINE' : 'LINK OFFLINE'}
        </p>
      </div>
    </div>
  );
}
