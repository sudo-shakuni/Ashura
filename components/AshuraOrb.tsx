"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OrbScene, type OrbState, type ChibiTheme, type ChibiAction, CHIBI_THEMES } from "@/lib/orbScene";
import { HandTracker } from "@/lib/handTracker";
import { VoiceAssistant } from "@/lib/voiceAssistant";

function playCyberBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch {}
}

/**
 * ASHURA's orb interface — the visual layer.
 *
 * This is the front end of a larger voice assistant. In the full system
 * the orb's state is driven by a live speech session and by tool calls
 * hitting the user's machine; here the state switcher stands in for that,
 * so the visual states can be seen without any backend running.
 *
 * The scene itself (lib/orbScene.ts) and the gesture tracking
 * (lib/handTracker.ts) are the complete, unmodified implementations.
 */

const STATES: OrbState[] = [
  "IDLE",
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "TOOL_EXECUTION",
  "ERROR",
];

export default function AshuraOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<OrbScene | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  const [state, setState] = useState<OrbState>("IDLE");
  const [gesturesOn, setGesturesOn] = useState(false);
  const [gestureBusy, setGestureBusy] = useState(false);
  const [gestureError, setGestureError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{ text: string; isUser: boolean } | null>(null);
  const [showChatInput, setShowChatInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [activeToolPill, setActiveToolPill] = useState<string | null>(null);
  const voiceRef = useRef<VoiceAssistant | null>(null);
  // Camera self-view is off by default even while gestures are on — hand
  // tracking doesn't need it visible, it's a debug aid. Press C for it.
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [fps, setFps] = useState(0);
  const [panelVisible, setPanelVisible] = useState(true);
  const [currentAvatarTheme, setCurrentAvatarTheme] = useState<ChibiTheme>("cyber_neon");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Brain provider and API key state
  const [brainProvider, setBrainProvider] = useState<"local" | "groq" | "gemini" | "openai" | "ollama">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ashura_brain_provider") || localStorage.getItem("raone_brain_provider");
        if (saved) return saved as "local" | "groq" | "gemini" | "openai" | "ollama";
      } catch {}
    }
    return "local";
  });
  const [brainApiKey, setBrainApiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("ashura_brain_key") || localStorage.getItem("raone_brain_key") || "";
      } catch {}
    }
    return "";
  });
  const [brainOllamaHost, setBrainOllamaHost] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("ashura_brain_ollama") || localStorage.getItem("raone_brain_ollama") || "http://localhost:11434";
      } catch {}
    }
    return "http://localhost:11434";
  });
  const [showBrainSettings, setShowBrainSettings] = useState(false);
  const brainConfigRef = useRef({ provider: brainProvider, apiKey: brainApiKey, ollamaHost: brainOllamaHost });

  useEffect(() => {
    brainConfigRef.current = { provider: brainProvider, apiKey: brainApiKey, ollamaHost: brainOllamaHost };
    try {
      localStorage.setItem("ashura_brain_provider", brainProvider);
      localStorage.setItem("ashura_brain_key", brainApiKey);
      localStorage.setItem("ashura_brain_ollama", brainOllamaHost);
    } catch {}
  }, [brainProvider, brainApiKey, brainOllamaHost]);

  // Floating Holographic Video Player Dock
  const [videoPlayer, setVideoPlayer] = useState<{
    open: boolean;
    minimized: boolean;
    url: string;
    title: string;
  }>({
    open: false,
    minimized: false,
    url: "https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1",
    title: "Lofi Hip Hop Radio 24/7",
  });

  // Countdown Timer Widget
  const [timerState, setTimerState] = useState<{
    active: boolean;
    remainingSec: number;
    totalSec: number;
    label: string;
  }>({
    active: false,
    remainingSec: 0,
    totalSec: 0,
    label: "Timer",
  });

  // Scratchpad Notes Drawer
  const [notes, setNotes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ashura_notes");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [
      "Welcome to Ashura v2.0 Holographic Notes",
      "Try saying 'Ashura, dance' or 'play lofi beats'",
    ];
  });
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");

  // Optical Vision Scanning State
  const [visionScanning, setVisionScanning] = useState(false);

  // Rock Paper Scissors Game State
  const [rpsModal, setRpsModal] = useState<{
    open: boolean;
    userMove?: string;
    ashuraMove?: string;
    result?: string;
    countdown: number;
  } | null>(null);

  // Timer countdown ticker
  useEffect(() => {
    if (!timerState.active || timerState.remainingSec <= 0) return;
    const id = setInterval(() => {
      setTimerState((prev) => {
        if (prev.remainingSec <= 1) {
          playCyberBeep();
          setActiveToolPill("⏱️ TIMER REACHED ZERO!");
          setTimeout(() => setActiveToolPill(null), 4000);
          return { ...prev, active: false, remainingSec: 0 };
        }
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerState.active, timerState.remainingSec]);

  // Sync notes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ashura_notes", JSON.stringify(notes));
    } catch {}
  }, [notes]);

  // Intro video: plays on load over the orb, fades out on first interaction
  // so the scene underneath is revealed. introFading drives the CSS
  // transition; introVisible unmounts it afterwards so it stops costing
  // compositing work once invisible.
  const [introVisible, setIntroVisible] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const INTRO_FADE_MS = 2800;

  const dismissIntro = useCallback(() => {
    if (!introVisible || introFading) return;
    setIntroFading(true);
    setTimeout(() => setIntroVisible(false), INTRO_FADE_MS);
  }, [introVisible, introFading]);

  // Polls the scene's rolling FPS counter. A plain setInterval survives a
  // backgrounded tab better than an ad-hoc rAF probe would.
  useEffect(() => {
    const interval = setInterval(() => {
      const scene = sceneRef.current;
      if (scene) setFps(scene.getFps());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // mount the scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new OrbScene(canvas);
    sceneRef.current = scene;
    scene.setState("IDLE");
    scene.start();

    const resize = () => scene.resize(window.innerWidth, window.innerHeight);
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // mouse / touch drag + scroll zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      dismissIntro();
      dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      sceneRef.current?.setRotationDelta(dx * 0.005, dy * 0.005);
    };
    const onPointerUp = (e: PointerEvent) => {
      dragRef.current.dragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      dismissIntro();
      e.preventDefault();
      sceneRef.current?.setZoomDelta(e.deltaY * 0.003);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [dismissIntro]);

  const toggleGestures = async () => {
    dismissIntro();
    if (gesturesOn) {
      trackerRef.current?.stop();
      trackerRef.current = null;
      setGesturesOn(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setGestureBusy(true);
    setGestureError(null);
    try {
      const tracker = new HandTracker();
      await tracker.start(video, (gesture) => {
        if (gesture.type === "rotate") {
          sceneRef.current?.setRotationDelta(gesture.dx, gesture.dy);
        } else if (gesture.type === "zoom") {
          sceneRef.current?.setZoomDelta(-gesture.delta);
        }
      });
      trackerRef.current = tracker;
      setGesturesOn(true);
    } catch (err) {
      setGestureError(err instanceof Error ? err.message : "Camera access failed");
    } finally {
      setGestureBusy(false);
    }
  };

  const getOrCreateAssistant = useCallback(() => {
    if (voiceRef.current) return voiceRef.current;
    const assistant = new VoiceAssistant({
      onStateChange: (s) => {
        setState(s);
        sceneRef.current?.setState(s);
      },
      onTranscript: (text, isUser) => {
        setTranscript({ text, isUser });
      },
      onError: (err) => {
        setVoiceError(err);
      },
      onToolPulse: (kind) => {
        sceneRef.current?.pulseToolResult(kind);
        setActiveToolPill(`Tool status: ${kind.toUpperCase()}`);
        setTimeout(() => setActiveToolPill(null), 3000);
      },
      onMemoryGraphUpdate: (graph) => {
        sceneRef.current?.setMemoryGraph(graph.nodes, graph.edges);
      },
      onAmplitude: (amp) => {
        sceneRef.current?.setAmplitude(amp);
      },
      onAvatarChange: (customization) => {
        if (customization.theme) {
          const t = customization.theme as ChibiTheme;
          sceneRef.current?.setAvatarTheme(t);
          setCurrentAvatarTheme(t);
          setActiveToolPill(`AVATAR TRANSFORM: ${CHIBI_THEMES[t]?.name?.toUpperCase() || t.toUpperCase()}`);
          setTimeout(() => setActiveToolPill(null), 3500);
        } else {
          sceneRef.current?.customizeAvatar(customization);
          setActiveToolPill("AVATAR RE-COLORED");
          setTimeout(() => setActiveToolPill(null), 3500);
        }
      },
      onAvatarAction: (action) => {
        sceneRef.current?.triggerAvatarAction(action as ChibiAction);
        setActiveToolPill(`EMOTE: ${action.toUpperCase()}`);
        setTimeout(() => setActiveToolPill(null), 3000);
      },
      onVideoAction: (v) => {
        if (v.action === "close") {
          setVideoPlayer((p) => ({ ...p, open: false }));
        } else if (v.action === "pause") {
          setVideoPlayer((p) => ({ ...p, minimized: true }));
        } else {
          setVideoPlayer({
            open: true,
            minimized: false,
            url: v.url || "https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1",
            title: v.title || "Holographic Video Stream",
          });
        }
        setActiveToolPill(`VIDEO: ${v.action.toUpperCase()}`);
        setTimeout(() => setActiveToolPill(null), 3000);
      },
      onTimerAction: (t) => {
        setTimerState({
          active: true,
          remainingSec: t.durationSec,
          totalSec: t.durationSec,
          label: t.label || "Countdown Timer",
        });
        setActiveToolPill(`TIMER: ${Math.round(t.durationSec)}s`);
        setTimeout(() => setActiveToolPill(null), 3000);
      },
      onNoteAction: (n) => {
        if (n.action === "add" && n.text) {
          setNotes((prev) => [n.text!, ...prev]);
        } else if (n.action === "clear") {
          setNotes([]);
        } else if (n.action === "list") {
          setShowNotesDrawer(true);
        }
        setActiveToolPill(`SCRATCHPAD: ${n.action.toUpperCase()}`);
        setTimeout(() => setActiveToolPill(null), 3000);
      },
      onRpsAction: (rps) => {
        setRpsModal({
          open: true,
          countdown: 0,
          userMove: rps.userMove,
          ashuraMove: rps.ashuraMove,
          result: rps.result,
        });
        if (rps.result === "win") {
          sceneRef.current?.triggerAvatarAction("cheer");
        } else if (rps.result === "lose") {
          sceneRef.current?.triggerAvatarAction("rage");
        } else {
          sceneRef.current?.triggerAvatarAction("spin");
        }
        setActiveToolPill(`RPS: ${rps.result.toUpperCase()}`);
        setTimeout(() => setActiveToolPill(null), 3000);
      },
      getBrainConfig: () => brainConfigRef.current,
    });
    voiceRef.current = assistant;
    return assistant;
  }, []);

  const selectAvatarTheme = (theme: ChibiTheme) => {
    dismissIntro();
    sceneRef.current?.setAvatarTheme(theme);
    setCurrentAvatarTheme(theme);
    setActiveToolPill(`AVATAR: ${CHIBI_THEMES[theme]?.name.toUpperCase()}`);
    setTimeout(() => setActiveToolPill(null), 3000);
  };

  const toggleVoice = async () => {
    dismissIntro();
    if (voiceOn) {
      voiceRef.current?.stop();
      voiceRef.current = null;
      setVoiceOn(false);
      setTranscript(null);
      applyState("IDLE");
      return;
    }
    setVoiceError(null);
    setVoiceBusy(true);
    try {
      const assistant = getOrCreateAssistant();
      if (!assistant.getSupported()) {
        setVoiceError("Speech Recognition unavailable in this browser. Use Chrome or Edge, or type via Chat Prompt [T].");
        return;
      }
      await assistant.start();
      setVoiceOn(true);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Voice activation failed");
      setVoiceOn(false);
    } finally {
      setVoiceBusy(false);
    }
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = textInput.trim();
    if (!query) return;
    dismissIntro();
    setTextInput("");
    const assistant = getOrCreateAssistant();
    void assistant.askAgent(query);
  };

  const captureWebcamSnapshot = async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || !video.srcObject || video.readyState < 2) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (video) {
          video.srcObject = stream;
          await video.play();
          await new Promise((r) => setTimeout(r, 450));
        }
      } catch {
        setVoiceError("Webcam access denied or unavailable for visual optical inspection.");
        return null;
      }
    }
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const captureScreenSnapshot = async (): Promise<string | null> => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setVoiceError("Screen capture is not supported in this browser context.");
        return null;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 350));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      stream.getTracks().forEach((t) => t.stop());
      return dataUrl;
    } catch {
      return null;
    }
  };

  const handleCameraVisionScan = async () => {
    dismissIntro();
    setVisionScanning(true);
    setActiveToolPill("OPTICAL SCAN: CAPTURING CAMERA...");
    const img = await captureWebcamSnapshot();
    if (!img) {
      setVisionScanning(false);
      setActiveToolPill(null);
      return;
    }
    setActiveToolPill("OPTICAL SCAN: ANALYZING SCENE...");
    const assistant = getOrCreateAssistant();
    await assistant.askAgent("Analyze what you see in this optical camera snapshot in detail, identify objects, and explain the scene.", img);
    setVisionScanning(false);
    setActiveToolPill(null);
  };

  const handleScreenVisionScan = async () => {
    dismissIntro();
    setVisionScanning(true);
    setActiveToolPill("SCREEN SCAN: SELECT DISPLAY...");
    const img = await captureScreenSnapshot();
    if (!img) {
      setVisionScanning(false);
      setActiveToolPill(null);
      return;
    }
    setActiveToolPill("SCREEN SCAN: ANALYZING DISPLAY...");
    const assistant = getOrCreateAssistant();
    await assistant.askAgent("Analyze what is currently shown on my screen. Explain the contents, debug any visible errors or code, or summarize the text.", img);
    setVisionScanning(false);
    setActiveToolPill(null);
  };

  const startRpsGame = (userChosenMove?: "rock" | "paper" | "scissors") => {
    dismissIntro();
    let detectedMove = userChosenMove;
    if (!detectedMove && trackerRef.current) {
      const pose = trackerRef.current.getLastPose();
      if (pose !== "unknown") {
        detectedMove = pose as "rock" | "paper" | "scissors";
      }
    }
    const assistant = getOrCreateAssistant();
    const prompt = detectedMove ? `shoot ${detectedMove}` : "play rock paper scissors";
    void assistant.askAgent(prompt);
  };

  const applyState = (s: OrbState) => {
    dismissIntro();
    setState(s);
    sceneRef.current?.setState(s);
  };

  // keyboard: G gestures, V voice, T text chat, C camera, D panel, R reset, +/- zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing when chat input is focused
      if ((e.target as HTMLElement)?.tagName === "INPUT") {
        if (e.key === "Escape") setShowChatInput(false);
        return;
      }

      dismissIntro();
      if (e.key === "g" || e.key === "G") void toggleGestures();
      else if (e.key === "v" || e.key === "V") toggleVoice();
      else if (e.key === "t" || e.key === "T") setShowChatInput((p) => !p);
      else if (e.key === "c" || e.key === "C") setShowCameraPreview((p) => !p);
      else if (e.key === "d" || e.key === "D") setPanelVisible((p) => !p);
      else if (e.key === "r" || e.key === "R") sceneRef.current?.resetView();
      else if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") sceneRef.current?.setZoomDelta(-0.4);
      else if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") sceneRef.current?.setZoomDelta(0.4);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesturesOn, voiceOn, introVisible, introFading, textInput, getOrCreateAssistant]);

  useEffect(() => {
    return () => {
      trackerRef.current?.stop();
      voiceRef.current?.stop();
    };
  }, []);

  const stateMeta = getStateMeta(state);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#03060d", overflow: "hidden" }}>
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Sci-Fi Vignette and Scanlines Overlay */}
      <div className="hud-vignette" />
      <div className="hud-scanlines" />

      {/* Intro Video Overlay */}
      {introVisible && (
        <div
          onClick={dismissIntro}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            cursor: "pointer",
            opacity: introFading ? 0 : 1,
            transition: `opacity ${INTRO_FADE_MS}ms ease`,
            pointerEvents: introFading ? "none" : "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: "80px",
          }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            src="/videos/raone-intro.mp4"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: -1,
            }}
          />
          <div
            className="hud-panel hud-chamfer"
            style={{
              padding: "12px 28px",
              textAlign: "center",
              letterSpacing: "0.2em",
              fontSize: 13,
              fontWeight: 700,
              color: "#00f0ff",
              textShadow: "0 0 10px #00f0ff",
              animation: "neonPulse 2s infinite",
              background: "rgba(3, 10, 22, 0.8)",
            }}
          >
            ⚡ INITIALIZE ASHURA INTERFACE [CLICK ANYWHERE] ⚡
          </div>
        </div>
      )}

      {/* TOP HEADER HUD */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 20,
          right: 20,
          zIndex: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        {/* Brand & System Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, pointerEvents: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: "#00f0ff",
                textShadow: "0 0 12px rgba(0, 240, 255, 0.6)",
              }}
            >
              ASHURA // PROTOCOL
            </span>
            <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(0, 240, 255, 0.6)" }}>
              NEURAL AGENTIC ASSISTANT · WINDOWS v2.0
            </span>
          </div>

          <div
            className="hud-panel hud-chamfer"
            style={{
              padding: "5px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: stateMeta.color,
              borderColor: stateMeta.border,
              boxShadow: `0 0 15px ${stateMeta.glow}`,
            }}
          >
            <div
              className="neon-dot"
              style={{
                background: stateMeta.color,
                boxShadow: `0 0 8px ${stateMeta.color}`,
              }}
            />
            <span>CORE: {state}</span>
          </div>
        </div>

        {/* Center Banner: Active Tool Pill or Voice Equalizer */}
        <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {activeToolPill ? (
            <div
              className="hud-panel hud-chamfer"
              style={{
                padding: "8px 20px",
                color: "#ffeaa7",
                background: "rgba(255, 184, 0, 0.2)",
                borderColor: "#ffb800",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                boxShadow: "0 0 20px rgba(255, 184, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ animation: "spin 2s linear infinite" }}>⚙️</span>
              {activeToolPill}
            </div>
          ) : voiceOn ? (
            <div
              className="hud-panel hud-chamfer"
              style={{
                padding: "6px 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderColor: "rgba(56, 189, 248, 0.6)",
                boxShadow: "0 0 15px rgba(56, 189, 248, 0.3)",
              }}
            >
              <span style={{ fontSize: 11, color: "#38bdf8", letterSpacing: "0.1em", marginRight: 4 }}>
                VOICE LIVE
              </span>
              <div className="eq-bar" style={{ animationDelay: "0s" }} />
              <div className="eq-bar" style={{ animationDelay: "0.2s" }} />
              <div className="eq-bar" style={{ animationDelay: "0.4s" }} />
              <div className="eq-bar" style={{ animationDelay: "0.15s" }} />
              <div className="eq-bar" style={{ animationDelay: "0.35s" }} />
            </div>
          ) : null}
        </div>

        {/* Top Right Quick Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" }}>
          {brainProvider !== "gemini" && (
            <button
              onClick={() => {
                setBrainProvider("gemini");
                setShowBrainSettings(true);
                setShowAvatarPicker(false);
              }}
              className="hud-button active"
              title="Connect free Google Gemini intelligence"
              style={{
                padding: "6px 12px",
                fontSize: 11,
                border: "1px solid #38bdf8",
                boxShadow: "0 0 10px rgba(56, 189, 248, 0.4)",
              }}
            >
              <span>✨</span>
              <span>CONNECT GEMINI (FREE)</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowBrainSettings((p) => !p);
              setShowAvatarPicker(false);
            }}
            className={`hud-button ${showBrainSettings ? "active" : ""}`}
            title="Configure AI Brain (Local ONNX, Groq, Gemini, OpenAI, Ollama)"
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
            <span>🧠</span>
            <span>BRAIN: {brainProvider.toUpperCase()}</span>
          </button>
          <button
            onClick={() => {
              setShowAvatarPicker((p) => !p);
              setShowBrainSettings(false);
            }}
            className={`hud-button ${showAvatarPicker ? "active" : ""}`}
            title="Change Chibi Avatar & Style"
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
            <span>🎭</span>
            <span>CHIBI: {CHIBI_THEMES[currentAvatarTheme]?.name || "CHIBI"}</span>
          </button>
          <button
            onClick={() => sceneRef.current?.resetView()}
            className="hud-button"
            title="Reset 3D camera view (R)"
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
            RESET [R]
          </button>
          <button
            onClick={() => setPanelVisible((p) => !p)}
            className={`hud-button ${panelVisible ? "active" : ""}`}
            title="Toggle telemetry panel (D)"
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
            TELEMETRY [D]
          </button>
        </div>
      </div>

      {/* CHIBI AVATAR SELECTOR DRAWER */}
      {showAvatarPicker && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            top: 72,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 6,
            padding: "10px 16px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.3)",
            maxWidth: "95vw",
            flexWrap: "wrap",
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <span style={{ fontSize: 11, fontWeight: 700, color: "#00f0ff", letterSpacing: "0.12em", marginRight: 4 }}>
            CHIBI PRESETS:
          </span>

          {(Object.keys(CHIBI_THEMES) as ChibiTheme[]).map((themeKey) => {
            const theme = CHIBI_THEMES[themeKey];
            const isSelected = currentAvatarTheme === themeKey;
            return (
              <button
                key={themeKey}
                onClick={() => {
                  selectAvatarTheme(themeKey);
                  setShowAvatarPicker(false);
                }}
                className={`hud-button ${isSelected ? "active" : ""}`}
                style={{ padding: "5px 10px", fontSize: 10 }}
              >
                {theme.name}
              </button>
            );
          })}

          <button
            onClick={() => setShowAvatarPicker(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(0, 240, 255, 0.6)",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 6px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* BRAIN SETTINGS DRAWER */}
      {showBrainSettings && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            top: 72,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 6,
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 10px 35px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 240, 255, 0.3)",
            width: "90%",
            maxWidth: 520,
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#00f0ff", letterSpacing: "0.12em" }}>
              🧠 ASHURA AI BRAIN CONFIGURATION
            </span>
            <button
              onClick={() => setShowBrainSettings(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(0, 240, 255, 0.6)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "local", label: "LOCAL ONNX (OFFLINE)" },
              { id: "groq", label: "GROQ (LLAMA 3.3 70B)" },
              { id: "gemini", label: "GEMINI 2.5 FLASH" },
              { id: "openai", label: "OPENAI (GPT-4o MINI)" },
              { id: "ollama", label: "OLLAMA (LOCAL)" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setBrainProvider(p.id as "local" | "groq" | "gemini" | "openai" | "ollama")}
                className={`hud-button ${brainProvider === p.id ? "active" : ""}`}
                style={{ fontSize: 10, padding: "5px 9px" }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {brainProvider !== "local" && brainProvider !== "ollama" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.08em" }}>
                  {brainProvider.toUpperCase()} API KEY:
                </label>
                {brainProvider === "gemini" && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#38bdf8",
                      fontSize: 10,
                      fontWeight: 700,
                      textDecoration: "underline",
                    }}
                  >
                    GET FREE KEY ↗
                  </a>
                )}
              </div>
              <input
                type="password"
                value={brainApiKey}
                onChange={(e) => setBrainApiKey(e.target.value)}
                placeholder={`Paste your ${brainProvider} API key here...`}
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: "1px solid rgba(0, 240, 255, 0.3)",
                  borderRadius: 4,
                  padding: "6px 10px",
                  color: "#ffffff",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              />
              {brainProvider === "gemini" && (
                <span style={{ fontSize: 10, color: "#38bdf8" }}>
                  ⚡ Free from Google AI Studio. No credit card or billing setup needed.
                </span>
              )}
            </div>
          )}

          {brainProvider === "ollama" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.08em" }}>
                OLLAMA HOST URL:
              </label>
              <input
                type="text"
                value={brainOllamaHost}
                onChange={(e) => setBrainOllamaHost(e.target.value)}
                placeholder="http://localhost:11434"
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: "1px solid rgba(0, 240, 255, 0.3)",
                  borderRadius: 4,
                  padding: "6px 10px",
                  color: "#ffffff",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              />
            </div>
          )}

          <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
            {brainProvider === "local"
              ? "⚡ Local mode runs 100% on-device with SmolLM2-135M ONNX and the built-in Windows Multi-Tool Suite (Math, Live Weather, Wikipedia, Apps, Hardware Controls). No internet or API keys required."
              : "🚀 Cloud/local LLM mode routes reasoning to the selected provider while executing Windows tools on your PC."}
          </div>
        </div>
      )}

      {/* LEFT ACTION DOCK */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 20,
          zIndex: 4,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <button
          onClick={toggleGestures}
          disabled={gestureBusy}
          className={`hud-button ${gesturesOn ? "active" : ""}`}
        >
          <span>✋</span>
          {gestureBusy ? "REQUESTING CAM…" : gesturesOn ? "GESTURES ON" : "GESTURES OFF"}
        </button>
        {gestureError && (
          <div style={{ color: "#ff6b6b", fontSize: 11, maxWidth: 220, paddingLeft: 4 }}>
            ⚠️ {gestureError}
          </div>
        )}

        <button
          onClick={toggleVoice}
          disabled={voiceBusy}
          className={`hud-button ${voiceOn ? "active" : ""}`}
        >
          <span>🎙️</span>
          {voiceBusy ? "CONNECTING MIC…" : voiceOn ? "VOICE MODE ON" : "VOICE MODE OFF"}
        </button>
        {voiceError && (
          <div style={{ color: "#ff6b6b", fontSize: 11, maxWidth: 220, paddingLeft: 4 }}>
            ⚠️ {voiceError}
          </div>
        )}

        <button
          onClick={() => setShowChatInput((p) => !p)}
          className={`hud-button ${showChatInput ? "active" : ""}`}
        >
          <span>⌨️</span>
          {showChatInput ? "PROMPT ACTIVE [T]" : "CHAT PROMPT [T]"}
        </button>

        <button
          onClick={handleCameraVisionScan}
          disabled={visionScanning}
          className={`hud-button ${visionScanning ? "active" : ""}`}
          title="Inspect and analyze live camera scene with Gemini Vision"
        >
          <span>👁️</span>
          {visionScanning ? "SCANNING CAM…" : "SCAN CAMERA"}
        </button>

        <button
          onClick={handleScreenVisionScan}
          disabled={visionScanning}
          className="hud-button"
          title="Share and inspect your screen or code with Ashura"
        >
          <span>🖥️</span>
          <span>SCREEN SCAN</span>
        </button>

        <button
          onClick={() => setVideoPlayer((p) => ({ ...p, open: !p.open, minimized: false }))}
          className={`hud-button ${videoPlayer.open ? "active" : ""}`}
          title="Toggle floating cyberpunk video/music player"
        >
          <span>📺</span>
          {videoPlayer.open ? "HIDE MEDIA" : "CYBER MEDIA"}
        </button>

        <button
          onClick={() => setShowNotesDrawer((p) => !p)}
          className={`hud-button ${showNotesDrawer ? "active" : ""}`}
          title="Open holographic scratchpad notes"
        >
          <span>📝</span>
          <span>NOTES ({notes.length})</span>
        </button>

        <button
          onClick={() => startRpsGame()}
          className="hud-button"
          title="Play Rock Paper Scissors via webcam gestures or prompt"
        >
          <span>🎮</span>
          <span>PLAY RPS</span>
        </button>

        <button
          onClick={() => {
            dismissIntro();
            sceneRef.current?.triggerAvatarAction("dance");
            setActiveToolPill("EMOTE: DANCE");
            setTimeout(() => setActiveToolPill(null), 3000);
          }}
          className="hud-button"
          title="Make Ashura dance to the music"
        >
          <span>💃</span>
          <span>DANCE</span>
        </button>

        {gesturesOn && (
          <button
            onClick={() => setShowCameraPreview((p) => !p)}
            className={`hud-button ${showCameraPreview ? "active" : ""}`}
            style={{ fontSize: 11 }}
          >
            <span>📷</span>
            {showCameraPreview ? "HIDE OPTICAL FEED" : "OPTICAL FEED [C]"}
          </button>
        )}
      </div>

      {/* FLOATING HOLOGRAPHIC VIDEO PLAYER DOCK */}
      {videoPlayer.open && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            bottom: showChatInput ? 190 : 80,
            right: 20,
            width: 380,
            maxWidth: "calc(100vw - 40px)",
            zIndex: 5,
            padding: 10,
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.85), 0 0 30px rgba(0, 240, 255, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(0, 240, 255, 0.2)",
              paddingBottom: 6,
            }}
          >
            <span
              style={{
                color: "#00f0ff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 280,
              }}
            >
              📺 HOLOGRAPHIC MEDIA: {videoPlayer.title}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setVideoPlayer((p) => ({ ...p, minimized: !p.minimized }))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#38bdf8",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                title={videoPlayer.minimized ? "Expand" : "Minimize"}
              >
                {videoPlayer.minimized ? "□" : "—"}
              </button>
              <button
                onClick={() => setVideoPlayer((p) => ({ ...p, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(0, 240, 255, 0.6)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {!videoPlayer.minimized && (
            <>
              <div
                style={{
                  width: "100%",
                  height: 210,
                  borderRadius: 4,
                  overflow: "hidden",
                  background: "#000",
                }}
              >
                <iframe
                  src={videoPlayer.url}
                  title={videoPlayer.title}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    setVideoPlayer({
                      open: true,
                      minimized: false,
                      url: "https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1",
                      title: "Lofi Beats Radio 24/7",
                    })
                  }
                  className="hud-button"
                  style={{ padding: "3px 8px", fontSize: 10 }}
                >
                  ☕ Lofi Girl
                </button>
                <button
                  onClick={() =>
                    setVideoPlayer({
                      open: true,
                      minimized: false,
                      url: "https://www.youtube-nocookie.com/embed/4xDzrJKXOOY?autoplay=1",
                      title: "Cyberpunk Synthwave 24/7",
                    })
                  }
                  className="hud-button"
                  style={{ padding: "3px 8px", fontSize: 10 }}
                >
                  🌆 Synthwave
                </button>
                <button
                  onClick={() =>
                    setVideoPlayer({
                      open: true,
                      minimized: false,
                      url: "https://www.youtube-nocookie.com/embed/rUxyKA_-grg?autoplay=1",
                      title: "Cyber City Ambient",
                    })
                  }
                  className="hud-button"
                  style={{ padding: "3px 8px", fontSize: 10 }}
                >
                  🌌 Cyber Ambient
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* LIVE COUNTDOWN TIMER WIDGET */}
      {(timerState.active || timerState.remainingSec > 0) && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            top: 76,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            padding: "8px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 0 25px rgba(0, 240, 255, 0.4)",
            background: "rgba(3, 10, 22, 0.9)",
          }}
        >
          <div style={{ fontSize: 20 }}>⏱️</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 9, color: "rgba(0, 240, 255, 0.6)", letterSpacing: "0.12em" }}>
              {timerState.label.toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: timerState.active ? "#00f0ff" : "#facc15",
              }}
            >
              {Math.floor(timerState.remainingSec / 60).toString().padStart(2, "0")}:
              {(timerState.remainingSec % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <button
            onClick={() => setTimerState({ active: false, remainingSec: 0, totalSec: 0, label: "Timer" })}
            className="hud-button"
            style={{
              padding: "4px 8px",
              fontSize: 10,
              color: "#ff6b6b",
              borderColor: "rgba(255, 107, 107, 0.4)",
            }}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* SCRATCHPAD NOTES DRAWER */}
      {showNotesDrawer && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            top: 80,
            left: 200,
            width: 320,
            maxWidth: "calc(100vw - 40px)",
            zIndex: 5,
            padding: 14,
            boxShadow: "0 12px 35px rgba(0, 0, 0, 0.8)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#00f0ff", letterSpacing: "0.12em" }}>
              📝 HOLOGRAPHIC SCRATCHPAD
            </span>
            <button
              onClick={() => setShowNotesDrawer(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(0, 240, 255, 0.6)",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newNoteText.trim()) {
                  setNotes((prev) => [newNoteText.trim(), ...prev]);
                  setNewNoteText("");
                }
              }}
              placeholder="Type note and hit Enter..."
              style={{
                flex: 1,
                background: "rgba(0, 240, 255, 0.05)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                color: "#fff",
                fontSize: 11,
                padding: "6px 8px",
                borderRadius: 4,
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                if (newNoteText.trim()) {
                  setNotes((prev) => [newNoteText.trim(), ...prev]);
                  setNewNoteText("");
                }
              }}
              className="hud-button active"
              style={{ padding: "6px 10px", fontSize: 11 }}
            >
              +
            </button>
          </div>

          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {notes.length === 0 ? (
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)", fontStyle: "italic" }}>
                No notes saved.
              </span>
            ) : (
              notes.map((note, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(0, 240, 255, 0.05)",
                    border: "1px solid rgba(0, 240, 255, 0.15)",
                    padding: "6px 10px",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#cbebff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ wordBreak: "break-word" }}>{note}</span>
                  <button
                    onClick={() => setNotes((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(255, 107, 107, 0.7)",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ROCK PAPER SCISSORS ARENA MODAL */}
      {rpsModal?.open && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            top: "45%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 8,
            padding: "16px 24px",
            minWidth: 320,
            textAlign: "center",
            boxShadow: "0 14px 45px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.4)",
            background: "rgba(3, 10, 22, 0.95)",
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div style={{ fontSize: 12, fontWeight: 700, color: "#00f0ff", letterSpacing: "0.15em", marginBottom: 10 }}>
            🎮 ROCK · PAPER · SCISSORS AI ARENA
          </div>

          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", margin: "14px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: "rgba(0, 240, 255, 0.6)" }}>YOU</span>
              <span style={{ fontSize: 32 }}>
                {rpsModal.userMove === "rock"
                  ? "✊"
                  : rpsModal.userMove === "paper"
                  ? "🖐️"
                  : rpsModal.userMove === "scissors"
                  ? "✌️"
                  : "❓"}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {rpsModal.userMove?.toUpperCase() || "SELECTING"}
              </span>
            </div>

            <div style={{ fontSize: 20, fontWeight: 800, color: "#00f0ff" }}>VS</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: "rgba(0, 240, 255, 0.6)" }}>ASHURA</span>
              <span style={{ fontSize: 32 }}>
                {rpsModal.ashuraMove === "rock"
                  ? "✊"
                  : rpsModal.ashuraMove === "paper"
                  ? "🖐️"
                  : rpsModal.ashuraMove === "scissors"
                  ? "✌️"
                  : "🤖"}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {rpsModal.ashuraMove?.toUpperCase() || "THINKING"}
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              margin: "10px 0",
              color:
                rpsModal.result === "win"
                  ? "#34d399"
                  : rpsModal.result === "lose"
                  ? "#ff6b6b"
                  : "#facc15",
              textShadow: "0 0 10px currentColor",
            }}
          >
            {rpsModal.result === "win"
              ? "🏆 YOU WIN!"
              : rpsModal.result === "lose"
              ? "💥 ASHURA WINS!"
              : "⚡ IT'S A DRAW!"}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <button
              onClick={() => startRpsGame("rock")}
              className="hud-button"
              style={{ padding: "6px 12px", fontSize: 11 }}
            >
              ✊ ROCK
            </button>
            <button
              onClick={() => startRpsGame("paper")}
              className="hud-button"
              style={{ padding: "6px 12px", fontSize: 11 }}
            >
              🖐️ PAPER
            </button>
            <button
              onClick={() => startRpsGame("scissors")}
              className="hud-button"
              style={{ padding: "6px 12px", fontSize: 11 }}
            >
              ✌️ SCISSORS
            </button>
            <button
              onClick={() => setRpsModal(null)}
              className="hud-button"
              style={{ padding: "6px 10px", fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* OPTICAL CAMERA PIP FEED (Bottom Left) */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          zIndex: 4,
          display: gesturesOn && showCameraPreview ? "block" : "none",
          width: 170,
          background: "rgba(3, 10, 22, 0.8)",
          border: "1px solid #00f0ff",
          borderRadius: 6,
          padding: 6,
          boxShadow: "0 0 20px rgba(0, 240, 255, 0.25)",
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "#00f0ff",
            marginBottom: 4,
            fontWeight: 700,
          }}
        >
          {"// OPTICAL FEED: HAND TRACKER"}
        </div>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: 115,
            objectFit: "cover",
            borderRadius: 4,
            transform: "scaleX(-1)",
            display: "block",
          }}
        />
      </div>

      {/* TOP-RIGHT TELEMETRY & DIAGNOSTICS PANEL */}
      {panelVisible && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            top: 76,
            right: 20,
            zIndex: 4,
            width: 290,
            maxWidth: "calc(100vw - 40px)",
            padding: "14px 16px",
            fontSize: 11,
            lineHeight: 1.65,
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#00f0ff",
              borderBottom: "1px solid rgba(0, 240, 255, 0.25)",
              paddingBottom: 6,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{"// TELEMETRY"}</span>
            <span style={{ color: "#34d399" }}>ONLINE</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "3px 8px", marginBottom: 10 }}>
            <span style={{ color: "rgba(0, 240, 255, 0.6)" }}>ORB ENGINE:</span>
            <span style={{ color: stateMeta.color, fontWeight: 700 }}>{state}</span>

            <span style={{ color: "rgba(0, 240, 255, 0.6)" }}>RENDER RATE:</span>
            <span style={{ color: "#ffffff" }}>{fps.toFixed(0)} FPS</span>

            <span style={{ color: "rgba(0, 240, 255, 0.6)" }}>NEURAL CORE:</span>
            <span style={{ color: "#38bdf8" }}>SmolLM2 ONNX (135M)</span>

            <span style={{ color: "rgba(0, 240, 255, 0.6)" }}>AUDIO LINK:</span>
            <span style={{ color: voiceOn ? "#34d399" : "#64748b" }}>
              {voiceOn ? "ACTIVE (FFT-1024)" : "STANDBY"}
            </span>

            <span style={{ color: "rgba(0, 240, 255, 0.6)" }}>GESTURES:</span>
            <span style={{ color: gesturesOn ? "#34d399" : "#64748b" }}>
              {gesturesOn ? "TRACKING ACTIVE" : "STANDBY"}
            </span>
          </div>

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(0, 240, 255, 0.8)",
              borderTop: "1px solid rgba(0, 240, 255, 0.15)",
              paddingTop: 6,
              marginBottom: 4,
            }}
          >
            CONTROL MATRIX
          </div>
          <div style={{ fontSize: 10, color: "#8cefff", opacity: 0.85, lineHeight: 1.6 }}>
            <div><b style={{ color: "#00f0ff" }}>[G]</b> Gestures · <b style={{ color: "#00f0ff" }}>[V]</b> Voice Assistant</div>
            <div><b style={{ color: "#00f0ff" }}>[T]</b> Chat Prompt · <b style={{ color: "#00f0ff" }}>[C]</b> Optical Feed</div>
            <div><b style={{ color: "#00f0ff" }}>[R]</b> Reset View · <b style={{ color: "#00f0ff" }}>[D]</b> Toggle Telemetry</div>
            <div><b style={{ color: "#00f0ff" }}>[+] / [−]</b> Zoom · <b style={{ color: "#00f0ff" }}>Drag/Scroll</b> Orbit</div>
          </div>
        </div>
      )}

      {/* HOLOGRAPHIC TRANSMISSION CARD (Transcript) */}
      {transcript && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            bottom: showChatInput ? 138 : 74,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 4,
            width: "90%",
            maxWidth: 620,
            padding: "12px 18px",
            boxShadow: "0 10px 35px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.2)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: transcript.isUser ? "#38bdf8" : "#00f0ff",
              marginBottom: 6,
            }}
          >
            <span>
              {transcript.isUser ? "// TRANSMISSION: OPERATOR" : "// TRANSMISSION: ASHURA NEURAL LINK"}
            </span>
            <button
              onClick={() => setTranscript(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(0, 240, 255, 0.5)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              color: transcript.isUser ? "#cbebff" : "#ffffff",
              fontSize: 13,
              letterSpacing: "0.02em",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {transcript.text}
          </div>
        </div>
      )}

      {/* FLOATING COMMAND PROMPT DOCK */}
      {showChatInput && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            width: "90%",
            maxWidth: 640,
            padding: "8px 12px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 240, 255, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <form onSubmit={handleTextSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "#00f0ff", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>
              ASHURA://EXEC&gt;
            </span>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask Ashura or command PC (e.g. 'open notepad', 'specs', 'calculator')..."
              autoFocus
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: 13,
                fontFamily: "inherit",
                letterSpacing: "0.04em",
              }}
            />
            <button
              type="submit"
              className="hud-button active"
              style={{ padding: "6px 14px", fontSize: 11 }}
            >
              DISPATCH ↵
            </button>
          </form>

          {/* Quick command suggestion pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 4 }}>
            {[
              { label: "LOFI BEATS ☕", cmd: "play lofi beats" },
              { label: "SYNTHWAVE 🌆", cmd: "play synthwave" },
              { label: "DANCE 💃", cmd: "dance for me" },
              { label: "RPS GAME ✊", cmd: "play rock paper scissors" },
              { label: "5M TIMER ⏱️", cmd: "set a 5 minute timer" },
              { label: "TAKE NOTE 📝", cmd: "add note review project progress" },
              { label: "SPACEX NEWS", cmd: "what is happening with SpaceX today?" },
              { label: "AI NEWS", cmd: "what is the latest news about AI?" },
              { label: "FIX AUDIO", cmd: "my audio is not working, how do I fix it?" },
              { label: "REACT VS NEXT", cmd: "compare React vs Next.js for a beginner" },
              { label: "WEATHER", cmd: "what is the weather today?" },
              { label: "54*23", cmd: "calculate 54 * 23" },
              { label: "20% OF 850", cmd: "what is 20 percent of 850" },
              { label: "ALAN TURING", cmd: "who was Alan Turing?" },
              { label: "YOUTUBE", cmd: "open youtube" },
              { label: "BATTERY", cmd: "battery status" },
              { label: "VOLUME UP", cmd: "volume up" },
              { label: "DOWNLOADS", cmd: "open downloads" },
              { label: "JOKE", cmd: "tell me a joke" },
              { label: "ANIME GIRL", cmd: "change avatar to anime girl" },
              { label: "MECHA BOT", cmd: "switch avatar to mecha robot" },
              { label: "SPECS", cmd: "what are my system specs?" },
              { label: "NOTEPAD", cmd: "open notepad" },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  setTextInput(chip.cmd);
                  const assistant = getOrCreateAssistant();
                  void assistant.askAgent(chip.cmd);
                }}
                style={{
                  background: "rgba(0, 240, 255, 0.08)",
                  border: "1px solid rgba(0, 240, 255, 0.2)",
                  color: "#8cefff",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  padding: "2px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                +{chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM-RIGHT STATE SIMULATION DOCK */}
      {!showChatInput && (
        <div
          className="hud-panel hud-chamfer"
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            zIndex: 3,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 10px",
            maxWidth: "calc(100vw - 40px)",
          }}
        >
          {STATES.map((s) => {
            const meta = getStateMeta(s);
            const isSelected = state === s;
            return (
              <button
                key={s}
                onClick={() => applyState(s)}
                style={{
                  background: isSelected ? meta.bg : "rgba(255, 255, 255, 0.04)",
                  border: `1px solid ${isSelected ? meta.border : "rgba(255, 255, 255, 0.15)"}`,
                  color: isSelected ? meta.color : "#64748b",
                  padding: "5px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  borderRadius: 4,
                  transition: "all 0.2s ease",
                  boxShadow: isSelected ? `0 0 12px ${meta.glow}` : "none",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getStateMeta(s: OrbState): { color: string; bg: string; border: string; glow: string } {
  switch (s) {
    case "IDLE":
      return { color: "#00f0ff", bg: "rgba(0, 240, 255, 0.16)", border: "#00f0ff", glow: "rgba(0, 240, 255, 0.4)" };
    case "LISTENING":
      return { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.2)", border: "#38bdf8", glow: "rgba(56, 189, 248, 0.5)" };
    case "THINKING":
      return { color: "#c084fc", bg: "rgba(192, 132, 252, 0.2)", border: "#c084fc", glow: "rgba(192, 132, 252, 0.5)" };
    case "SPEAKING":
      return { color: "#34d399", bg: "rgba(52, 211, 153, 0.2)", border: "#34d399", glow: "rgba(52, 211, 153, 0.5)" };
    case "TOOL_EXECUTION":
      return { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.2)", border: "#fbbf24", glow: "rgba(251, 191, 36, 0.5)" };
    case "ERROR":
      return { color: "#f87171", bg: "rgba(248, 113, 113, 0.2)", border: "#f87171", glow: "rgba(248, 113, 113, 0.5)" };
  }
}
