'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

interface HandTrackingData {
  isHandDetected: boolean;
  landmarks: HandLandmark[] | null;
  pinchPosition: { x: number; y: number } | null;
  isPinching: boolean;
}

interface HandTrackingProps {
  onHandDataUpdate?: (data: HandTrackingData) => void;
  children?: React.ReactNode;
}

// Hand connections for visualization (from MediaPipe hand landmarks)
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17], [17, 5], // Palm
];

export const HandTracking: React.FC<HandTrackingProps> = ({
  onHandDataUpdate,
  children
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  const updateHandData = useCallback((landmarks: HandLandmark[] | null) => {
    if (!onHandDataUpdate || !landmarks) {
      onHandDataUpdate?.({
        isHandDetected: false,
        landmarks: null,
        pinchPosition: null,
        isPinching: false,
      });
      return;
    }

    // Get thumb and index finger tips (landmarks 4 and 8)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // Calculate distance between thumb and index finger
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    const isPinching = distance < 0.05;
    const pinchPosition = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2,
    };

    onHandDataUpdate({
      isHandDetected: true,
      landmarks,
      pinchPosition,
      isPinching,
    });
  }, [onHandDataUpdate]);

  useEffect(() => {
    const initHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        handLandmarkerRef.current = handLandmarker;
        setIsLoading(false);
      } catch (err) {
        setError('Failed to initialize hand tracking');
        setIsLoading(false);
        console.error('Hand landmarker initialization error:', err);
      }
    };

    initHandLandmarker();
    startCamera();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      handLandmarkerRef.current?.close();
    };
  }, [updateHandData]);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;
    const canvas = canvasRef.current;

    if (!video || !handLandmarker || !canvas) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Only process if video time has changed
    if (video.currentTime === lastVideoTimeRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // Detect hand landmarks
    const startTime = performance.now();
    const results = handLandmarker.detectForVideo(video, startTime);

    // Clear and draw video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame (mirrored for natural interaction)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      // Update hand data for 3D scene
      updateHandData(landmarks as unknown as HandLandmark[]);

      // Draw hand landmarks and connections
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      // Draw connections
      HAND_CONNECTIONS.forEach((connection) => {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];

        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
          ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Draw landmarks
      landmarks.forEach((landmark, idx) => {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          idx === 4 || idx === 8 ? 8 : 5,
          0,
          2 * Math.PI
        );

        // Highlight thumb and index finger
        if (idx === 4 || idx === 8) {
          ctx.fillStyle = '#FF0000';
        } else {
          ctx.fillStyle = '#00FF00';
        }
        ctx.fill();
      });

      ctx.restore();
    } else {
      updateHandData(null);
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [updateHandData]);

  const startCamera = async () => {
    try {
      if (!videoRef.current || !handLandmarkerRef.current) return;

      const video = videoRef.current;
      video.style.display = 'block';

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Start processing frames
      processFrame();

      setIsCameraOn(true);
      setError(null);
    } catch (err) {
      setError('Failed to access camera. Please allow camera permissions.');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOn(false);
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      {/* Hidden video element for camera input */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Canvas for hand tracking visualization */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 3D overlay container */}
      <div className="absolute inset-0 pointer-events-none">
        {children}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-xl">Loading hand tracking...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-xl text-center p-4">
            {error}
          </div>
        </div>
      )}

      {/* Camera status indicator */}
      {!isCameraOn && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-cyan-600/30"
          >
            Reconnect Vision
          </button>
        </div>
      )}

      {/* Instructions */}
      {/* <div className="absolute top-4 left-4 z-50 pointer-events-auto bg-black/50 text-white p-4 rounded-lg max-w-sm">
        <h3 className="font-bold mb-2">AR Hand Tracking Controls</h3>
        <ul className="text-sm space-y-1">
          <li>👋 Show your hand to the camera</li>
          <li>👌 Pinch thumb and index finger to grab objects</li>
          <li>✋ Move your hand to control objects</li>
        </ul>
      </div> */}
    </div>
  );
};

export type { HandTrackingData };
