import { OrbState } from "./orbScene";
import type { ChibiCustomization } from "./chibiAvatar";

// Web Speech API Types
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export interface MemoryNode {
  id: number;
  label: string;
}

export interface MemoryEdge {
  from: number;
  to: number;
  relation: string;
}

export interface MemoryGraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export interface ToolExecutionResult {
  name: string;
  status: "success" | "error";
  details?: string;
  avatarCustomization?: ChibiCustomization;
  avatarAction?: "dance" | "spin" | "cheer" | "rage" | "sleep";
  videoAction?: {
    action: "play" | "pause" | "close";
    title?: string;
    url?: string;
    videoId?: string;
  };
  timerAction?: {
    durationSec: number;
    label?: string;
  };
  noteAction?: {
    action: "add" | "list" | "clear";
    text?: string;
  };
  rpsAction?: {
    userMove?: string;
    ashuraMove: "rock" | "paper" | "scissors";
    result: "win" | "lose" | "tie";
  };
  systemAction?: {
    type: "volume" | "mute" | "browser";
    url?: string;
    level?: number;
  };
}

export interface AgentResponseData {
  reply: string;
  toolsUsed: ToolExecutionResult[];
  memoryGraph: MemoryGraphData;
}

export interface BrainConfig {
  provider: "local" | "groq" | "gemini" | "openai" | "ollama";
  apiKey?: string;
  ollamaHost?: string;
}

export interface VoiceAssistantOptions {
  onStateChange: (state: OrbState) => void;
  onTranscript?: (transcript: string, isUser: boolean) => void;
  onError?: (error: string) => void;
  onToolPulse?: (kind: "success" | "confirmation" | "error") => void;
  onMemoryGraphUpdate?: (graph: MemoryGraphData) => void;
  onAmplitude?: (amp: number) => void;
  onAvatarChange?: (customization: ChibiCustomization) => void;
  onAvatarAction?: (action: "dance" | "spin" | "cheer" | "rage" | "sleep") => void;
  onVideoAction?: (action: { action: "play" | "pause" | "close"; title?: string; url?: string; videoId?: string }) => void;
  onTimerAction?: (action: { durationSec: number; label?: string }) => void;
  onNoteAction?: (action: { action: "add" | "list" | "clear"; text?: string }) => void;
  onRpsAction?: (action: { userMove?: string; ashuraMove: "rock" | "paper" | "scissors"; result: "win" | "lose" | "tie" }) => void;
  onToolsExecuted?: (tools: ToolExecutionResult[]) => void;
  getBrainConfig?: () => BrainConfig;
}

export class VoiceAssistant {
  private recognition: ISpeechRecognition | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private mode: "idle" | "listening" | "processing" | "speaking" = "idle";
  private options: VoiceAssistantOptions;
  private isSupported = false;
  private history: Array<{ role: "user" | "assistant"; content: string }> = [];
  private currentMemory: MemoryGraphData = { nodes: [], edges: [] };
  private amplitudeInterval: NodeJS.Timeout | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private meterRaf: number | null = null;
  private restartDelay = 150;

  constructor(options: VoiceAssistantOptions) {
    this.options = options;
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindowWithSpeech;
      const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      this.isSupported = !!SpeechClass;
    }
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  private initRecognition() {
    if (typeof window === "undefined") return;
    const win = window as unknown as IWindowWithSpeech;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechClass) return;

    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        // Ignore abort error
      }
      this.recognition = null;
    }

    const rec = new SpeechClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      if (this.mode === "listening") {
        this.options.onStateChange("LISTENING");
      }
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (this.mode !== "listening") return;

      let interim = "";
      let finalTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalTranscript += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      // Real-time live visual feedback as user is speaking
      const liveText = finalTranscript || interim;
      if (liveText.trim()) {
        this.restartDelay = 150;
        this.options.onTranscript?.(liveText.trim(), true);
      }

      // If a final utterance has landed, process it
      if (finalTranscript.trim()) {
        void this.handleUserSpeech(finalTranscript.trim());
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.options.onError?.(
          "Microphone access blocked. Allow mic permissions in your browser address bar."
        );
        this.stop();
      } else if (event.error === "network") {
        this.restartDelay = 3000;
        this.options.onError?.(
          "Speech recognition network link busy. Voice is still active, or use Chat Prompt [T]."
        );
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        this.options.onError?.(`Microphone listener notice: ${event.error}`);
      }
    };

    rec.onend = () => {
      // Auto-restart if we are still meant to be in listening mode
      if (this.mode === "listening") {
        setTimeout(() => {
          if (this.mode === "listening") {
            try {
              this.recognition?.start();
            } catch {
              // Ignore restart collision
            }
          }
        }, this.restartDelay);
      }
    };

    this.recognition = rec;
  }

  private setupAudioMeter(stream: MediaStream) {
    try {
      const win = window as unknown as IWindowWithSpeech;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.audioContext = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const poll = () => {
        if (this.mode !== "listening") return;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        const normalized = Math.min(avg / 80, 1);
        if (normalized > 0.05) {
          this.options.onAmplitude?.(normalized * 0.7);
        }
        this.meterRaf = requestAnimationFrame(poll);
      };
      poll();
    } catch (e) {
      console.warn("Audio meter setup skipped:", e);
    }
  }

  public async start() {
    if (!this.isSupported) {
      this.options.onError?.(
        "Speech Recognition is not supported by your browser. Please use Google Chrome or Microsoft Edge, or use Chat Prompt [T]."
      );
      return;
    }

    // 1. Explicitly request microphone stream so browser prompts user if permissions not granted yet
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaStream = stream;
        this.setupAudioMeter(stream);
      } catch (micErr) {
        console.warn("Microphone access error:", micErr);
        this.options.onError?.(
          "Microphone permission blocked or not found. Please click the site icon in your address bar and allow microphone access."
        );
        this.options.onStateChange("IDLE");
        return;
      }
    }

    this.mode = "listening";
    this.options.onStateChange("LISTENING");
    this.initRecognition();

    try {
      this.recognition?.start();
    } catch (e) {
      console.warn("Recognition start issue:", e);
    }
  }

  public stop() {
    this.mode = "idle";
    if (this.meterRaf !== null) {
      cancelAnimationFrame(this.meterRaf);
      this.meterRaf = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.stopSpeaking();
    this.options.onStateChange("IDLE");
  }

  private stopSpeaking() {
    if (this.amplitudeInterval) {
      clearInterval(this.amplitudeInterval);
      this.amplitudeInterval = null;
    }
    this.currentUtterance = null;
    this.options.onAmplitude?.(0);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public async askAgent(input: string, image?: string) {
    await this.handleUserSpeech(input, image);
  }

  private async handleUserSpeech(transcript: string, image?: string) {
    // Transition to processing mode so onend will not restart listening while fetching
    this.mode = "processing";
    this.options.onTranscript?.(transcript, true);
    this.options.onStateChange("THINKING");

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }

    try {
      const brain = this.options.getBrainConfig?.();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          image,
          history: this.history,
          memoryGraph: this.currentMemory,
          clientProvider: brain?.provider,
          clientApiKey: brain?.apiKey,
          clientOllamaHost: brain?.ollamaHost,
        }),
      });

      if (!res.ok) {
        throw new Error(`Agent server returned status ${res.status}`);
      }

      const data: AgentResponseData = await res.json();

      // Tool execution state & pulse
      if (data.toolsUsed && data.toolsUsed.length > 0) {
        for (const tool of data.toolsUsed) {
          if (tool.avatarCustomization) {
            this.options.onAvatarChange?.(tool.avatarCustomization);
          }
          if (tool.avatarAction) {
            this.options.onAvatarAction?.(tool.avatarAction);
          }
          if (tool.videoAction) {
            this.options.onVideoAction?.(tool.videoAction);
          }
          if (tool.timerAction) {
            this.options.onTimerAction?.(tool.timerAction);
          }
          if (tool.noteAction) {
            this.options.onNoteAction?.(tool.noteAction);
          }
          if (tool.rpsAction) {
            this.options.onRpsAction?.(tool.rpsAction);
          }
        }
        this.options.onToolsExecuted?.(data.toolsUsed);
        this.options.onStateChange("TOOL_EXECUTION");
        const hasError = data.toolsUsed.some((t) => t.status === "error");
        this.options.onToolPulse?.(hasError ? "error" : "success");
        await new Promise((r) => setTimeout(r, 900));
      }

      // Memory graph visual update
      if (data.memoryGraph && data.memoryGraph.nodes.length > 0) {
        this.currentMemory = data.memoryGraph;
        this.options.onMemoryGraphUpdate?.(data.memoryGraph);
      }

      // History retention
      this.history.push({ role: "user", content: transcript });
      this.history.push({ role: "assistant", content: data.reply });
      if (this.history.length > 12) {
        this.history = this.history.slice(-12);
      }

      this.speak(data.reply);
    } catch (err) {
      console.error("Failed to query agent backend:", err);
      const fallbackReply = "I encountered an error connecting to my backend agent. Standing by.";
      this.options.onError?.(err instanceof Error ? err.message : "Agent connection failed");
      this.speak(fallbackReply);
    }
  }

  private speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.options.onTranscript?.(text, false);
      this.resumeListeningOrIdle();
      return;
    }

    this.stopSpeaking();
    this.mode = "speaking";
    this.options.onTranscript?.(text, false);
    this.options.onStateChange("SPEAKING");

    // Dynamic amplitude modulation to drive orb pulse while speaking
    this.amplitudeInterval = setInterval(() => {
      const simulatedAmp = 0.25 + Math.random() * 0.75;
      this.options.onAmplitude?.(simulatedAmp);
    }, 120);

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Natural") ||
          v.name.includes("David") ||
          v.name.includes("Mark") ||
          v.name.includes("Google"))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      this.stopSpeaking();
      this.resumeListeningOrIdle();
    };

    utterance.onerror = () => {
      this.stopSpeaking();
      this.resumeListeningOrIdle();
    };

    window.speechSynthesis.speak(utterance);
  }

  private resumeListeningOrIdle() {
    if (this.mediaStream) {
      // User has voice mode engaged — resume listening
      this.mode = "listening";
      this.options.onStateChange("LISTENING");
      if (this.mediaStream) {
        this.setupAudioMeter(this.mediaStream);
      }
      setTimeout(() => {
        if (this.mode === "listening") {
          this.initRecognition();
          try {
            this.recognition?.start();
          } catch {
            // Ignore
          }
        }
      }, 350);
    } else {
      this.mode = "idle";
      this.options.onStateChange("IDLE");
    }
  }
}
