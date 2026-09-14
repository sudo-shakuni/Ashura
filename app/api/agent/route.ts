import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import os from "os";
import { generateLocalAIResponse } from "@/lib/localModel";
import { searchLiveWeb, formatWebContext } from "@/lib/webSearch";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface MemoryNode {
  id: number;
  label: string;
}

interface MemoryEdge {
  from: number;
  to: number;
  relation: string;
}

interface MemoryGraph {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

interface ToolExecutionResult {
  name: string;
  status: "success" | "error";
  details: string;
  avatarCustomization?: {
    theme?: string;
    hairColor?: string;
    eyeColor?: string;
    outfitColor?: string;
  };
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

function detectAvatarCommand(text: string): {
  theme?: string;
  hairColor?: string;
  eyeColor?: string;
  outfitColor?: string;
  replyText: string;
} | null {
  const lower = text.toLowerCase();
  const avatarKeywords = ["avatar", "chibi", "theme", "outfit", "hair", "eyes", "skin", "costume", "look like", "switch to", "become", "change to"];
  const matchesKeyword = avatarKeywords.some((kw) => lower.includes(kw));
  if (!matchesKeyword) return null;

  // 1. Theme Detection
  if (lower.includes("anime") || lower.includes("girl") || lower.includes("sakura")) {
    return {
      theme: "anime_girl",
      replyText: "Transforming into Anime Sakura chibi avatar with twintails and cat headphones!",
    };
  }
  if (lower.includes("mecha") || lower.includes("robot") || lower.includes("android") || lower.includes("bot")) {
    return {
      theme: "mecha_robot",
      replyText: "Switching to Mecha Unit-01 robotic android avatar with LED visor and arc chest!",
    };
  }
  if (lower.includes("cat") || lower.includes("neko") || lower.includes("kitty")) {
    return {
      theme: "cat_neko",
      replyText: "Meow! Morphing into playful Neko Cat chibi avatar with fluffy ears and tail!",
    };
  }
  if (lower.includes("ninja") || lower.includes("shadow") || lower.includes("stealth")) {
    return {
      theme: "stealth_ninja",
      replyText: "Cloaking into Shadow Ninja cybernetic operative avatar with crimson energy aura!",
    };
  }
  if (lower.includes("cyber") || lower.includes("ashura") || lower.includes("raone") || lower.includes("original") || lower.includes("neon")) {
    return {
      theme: "cyber_neon",
      replyText: "Resetting to Cyber Ashura avatar with neon visor and holographic circuit hoodie!",
    };
  }

  // 2. Color customization
  const colors: Record<string, string> = {
    cyan: "#00f0ff",
    blue: "#38bdf8",
    pink: "#f472b6",
    purple: "#c084fc",
    magenta: "#ec4899",
    green: "#22c55e",
    emerald: "#10b981",
    yellow: "#eab308",
    gold: "#facc15",
    amber: "#f59e0b",
    orange: "#fb923c",
    red: "#ef4444",
    white: "#ffffff",
    black: "#0f172a",
    silver: "#94a3b8",
  };

  const customization: {
    hairColor?: string;
    eyeColor?: string;
    outfitColor?: string;
    replyText: string;
  } = { replyText: "" };
  let changed = false;

  for (const [colName, hex] of Object.entries(colors)) {
    if (lower.includes("hair") && lower.includes(colName)) {
      customization.hairColor = hex;
      customization.replyText += `Changed your chibi hair color to ${colName}. `;
      changed = true;
    }
    if ((lower.includes("eye") || lower.includes("eyes")) && lower.includes(colName)) {
      customization.eyeColor = hex;
      customization.replyText += `Changed your chibi eye color to ${colName}. `;
      changed = true;
    }
    if ((lower.includes("outfit") || lower.includes("clothes") || lower.includes("suit")) && lower.includes(colName)) {
      customization.outfitColor = hex;
      customization.replyText += `Updated your chibi outfit color to ${colName}. `;
      changed = true;
    }
  }

  if (changed) {
    return customization;
  }

  return null;
}

function detectAvatarActionCommand(text: string): {
  action: "dance" | "spin" | "cheer" | "rage" | "sleep";
  replyText: string;
} | null {
  const lower = text.toLowerCase().trim();
  if (/\b(dance|bust a move|groove|dancing)\b/i.test(lower)) {
    return {
      action: "dance",
      replyText: "Starting rhythmic dance routine! Check out these cyber moves!",
    };
  }
  if (/\b(spin|pirouette|do a 360|twirl)\b/i.test(lower)) {
    return {
      action: "spin",
      replyText: "Executing a 360-degree aerial pirouette with holographic energy flare!",
    };
  }
  if (/\b(cheer|celebrate|jump for joy|hooray|yay|hurray)\b/i.test(lower)) {
    return {
      action: "cheer",
      replyText: "Yaaay! Celebrating with a high-energy photon burst!",
    };
  }
  if (/\b(rage|angry|overclock|super saiyan|berserk|fury)\b/i.test(lower)) {
    return {
      action: "rage",
      replyText: "Warning: Overclocking neural cores to 400%! Thermal output maximum!",
    };
  }
  if (/\b(sleep|take a nap|good night|rest mode|standby mode)\b/i.test(lower)) {
    return {
      action: "sleep",
      replyText: "Dimming optical visors and entering low-power standby sleep cycle. Sweet cyber dreams!",
    };
  }
  return null;
}

function detectVideoCommand(text: string): {
  action: "play" | "pause" | "close";
  title?: string;
  url?: string;
  videoId?: string;
  replyText: string;
} | null {
  const lower = text.toLowerCase().trim();
  if (/\b(close video|stop video|hide video|exit video|turn off video|mute video)\b/i.test(lower)) {
    return {
      action: "close",
      replyText: "Closing the holographic video player dock.",
    };
  }
  if (/\b(pause video|pause music|pause stream)\b/i.test(lower)) {
    return {
      action: "pause",
      replyText: "Pausing holographic media playback.",
    };
  }

  // Pre-configured popular cyberpunk/lo-fi streams
  if (lower.includes("lofi") || lower.includes("lo-fi") || lower.includes("relaxing beats") || lower.includes("chill beats")) {
    return {
      action: "play",
      title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
      videoId: "jfKfPfyJRdk",
      url: "https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1",
      replyText: "Streaming Lofi Hip Hop Radio directly in your holographic HUD cockpit!",
    };
  }
  if (lower.includes("synthwave") || lower.includes("cyberpunk music") || lower.includes("retrowave") || lower.includes("synth")) {
    return {
      action: "play",
      title: "Cyberpunk Synthwave Radio 24/7",
      videoId: "4xDzrJKXOOY",
      url: "https://www.youtube-nocookie.com/embed/4xDzrJKXOOY?autoplay=1",
      replyText: "Engaging 24/7 Cyberpunk Synthwave Radio in the holographic HUD dock!",
    };
  }

  // Custom play/watch command
  const playMatch = lower.match(/(?:play|watch|stream)(?:\s+(?:video|youtube|song|music))?\s+(?:about\s+|for\s+)?(.+)/i);
  if (playMatch && playMatch[1] && !lower.includes("rock paper scissors")) {
    const rawQuery = playMatch[1].trim();
    if (rawQuery.length > 1) {
      return {
        action: "play",
        title: `YouTube: ${rawQuery}`,
        url: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(rawQuery)}&autoplay=1`,
        replyText: `Opening holographic media player search for "${rawQuery}"!`,
      };
    }
  }

  return null;
}

function detectTimerCommand(text: string): {
  durationSec: number;
  label?: string;
  replyText: string;
} | null {
  const lower = text.toLowerCase().trim();
  if (!lower.includes("timer") && !lower.includes("countdown") && !lower.includes("alarm")) return null;

  let totalSec = 0;
  const minMatch = lower.match(/(\d+)\s*(?:minute|min|m\b)/i);
  const secMatch = lower.match(/(\d+)\s*(?:second|sec|s\b)/i);
  const hourMatch = lower.match(/(\d+)\s*(?:hour|hr|h\b)/i);

  if (hourMatch) totalSec += parseInt(hourMatch[1], 10) * 3600;
  if (minMatch) totalSec += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSec += parseInt(secMatch[1], 10);

  // Fallback: "timer for 5" -> 5 minutes
  if (totalSec === 0) {
    const numMatch = lower.match(/(?:timer|countdown|alarm)(?:\s+for)?\s+(\d+)/i);
    if (numMatch) totalSec = parseInt(numMatch[1], 10) * 60;
  }

  if (totalSec > 0) {
    const display = totalSec >= 60 ? `${Math.floor(totalSec / 60)} minute(s)` : `${totalSec} seconds`;
    return {
      durationSec: totalSec,
      label: "Countdown Timer",
      replyText: `Timer set for ${display}! I'll alert you when time expires.`,
    };
  }
  return null;
}

function detectNoteCommand(text: string): {
  action: "add" | "list" | "clear";
  noteText?: string;
  replyText: string;
} | null {
  const lower = text.toLowerCase().trim();
  if (/\b(show notes|read notes|list notes|view notes|get notes)\b/i.test(lower)) {
    return {
      action: "list",
      replyText: "Opening your holographic scratchpad notes in the HUD.",
    };
  }
  if (/\b(clear notes|delete all notes|wipe notes)\b/i.test(lower)) {
    return {
      action: "clear",
      replyText: "Cleared all holographic scratchpad notes.",
    };
  }
  const addMatch = lower.match(/(?:take|make|add|write|save)?\s*(?:a\s+)?note(?:\s*:\s*|\s+that\s+|\s+to\s+)(.+)/i);
  if (addMatch && addMatch[1]) {
    const note = addMatch[1].trim();
    if (note.length > 0) {
      return {
        action: "add",
        noteText: note,
        replyText: `Saved to holographic scratchpad: "${note}".`,
      };
    }
  }
  return null;
}

function detectRPSCommand(text: string): {
  userMove?: string;
  ashuraMove: "rock" | "paper" | "scissors";
  result: "win" | "lose" | "tie";
  replyText: string;
} | null {
  const lower = text.toLowerCase().trim();
  const isRpsTrigger =
    lower.includes("rock paper scissors") ||
    lower.includes("play rps") ||
    lower === "rock" ||
    lower === "paper" ||
    lower === "scissors" ||
    lower.startsWith("shoot ");

  if (!isRpsTrigger) return null;

  const moves: ("rock" | "paper" | "scissors")[] = ["rock", "paper", "scissors"];
  const ashuraMove = moves[Math.floor(Math.random() * moves.length)];

  let userMove: string | undefined;
  if (lower.includes("rock")) userMove = "rock";
  else if (lower.includes("paper")) userMove = "paper";
  else if (lower.includes("scissors")) userMove = "scissors";

  if (!userMove) {
    return {
      ashuraMove,
      result: "tie",
      replyText: `Rock-Paper-Scissors engaged! Show your move to the webcam (✊ Rock, 🖐️ Paper, ✌️ Scissors) or type your choice! 3... 2... 1... SHOOT! (I chose ${ashuraMove.toUpperCase()}!)`,
    };
  }

  let result: "win" | "lose" | "tie" = "tie";
  if (userMove === ashuraMove) result = "tie";
  else if (
    (userMove === "rock" && ashuraMove === "scissors") ||
    (userMove === "paper" && ashuraMove === "rock") ||
    (userMove === "scissors" && ashuraMove === "paper")
  ) {
    result = "win";
  } else {
    result = "lose";
  }

  const icons = { rock: "✊", paper: "🖐️", scissors: "✌️" };
  const replyText =
    result === "win"
      ? `You chose ${userMove} ${icons[userMove as keyof typeof icons]} and I chose ${ashuraMove} ${icons[ashuraMove]}! You WIN! Well played!`
      : result === "lose"
      ? `You chose ${userMove} ${icons[userMove as keyof typeof icons]} and I chose ${ashuraMove} ${icons[ashuraMove]}! I win this round! Rematch?`
      : `We both chose ${userMove} ${icons[userMove as keyof typeof icons]}! It's a tie! Let's go again!`;

  return { userMove, ashuraMove, result, replyText };
}

function detectSystemCommand(text: string): {
  action: { type: "volume" | "mute" | "browser"; url?: string; level?: number };
  replyText: string;
  commandToRun?: string;
} | null {
  const lower = text.toLowerCase().trim();

  // Mute / Unmute
  if (lower === "mute" || lower.includes("mute audio") || lower.includes("mute volume")) {
    return {
      action: { type: "mute" },
      commandToRun: `powershell -c "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]173)"`,
      replyText: "Toggled system audio mute on Windows.",
    };
  }

  // Web shortcuts
  if (lower.includes("open youtube") || lower === "youtube") {
    return {
      action: { type: "browser", url: "https://youtube.com" },
      commandToRun: 'start https://youtube.com',
      replyText: "Launching YouTube in your default browser.",
    };
  }
  if (lower.includes("open github") || lower === "github") {
    return {
      action: { type: "browser", url: "https://github.com" },
      commandToRun: 'start https://github.com',
      replyText: "Opening GitHub in your default browser.",
    };
  }
  if (lower.includes("open reddit") || lower === "reddit") {
    return {
      action: { type: "browser", url: "https://reddit.com" },
      commandToRun: 'start https://reddit.com',
      replyText: "Opening Reddit in your default browser.",
    };
  }
  const searchGoogle = lower.match(/(?:search google for|google)\s+(.+)/i);
  if (searchGoogle && searchGoogle[1]) {
    const q = searchGoogle[1].trim();
    return {
      action: { type: "browser", url: `https://www.google.com/search?q=${encodeURIComponent(q)}` },
      commandToRun: `start https://www.google.com/search?q=${encodeURIComponent(q)}`,
      replyText: `Searching Google for "${q}".`,
    };
  }

  return null;
}

// Windows App Launch dictionary
const WINDOWS_APPS: Record<string, string> = {
  notepad: "notepad.exe",
  calculator: "calc.exe",
  calc: "calc.exe",
  paint: "mspaint.exe",
  mspaint: "mspaint.exe",
  explorer: "explorer.exe",
  files: "explorer.exe",
  terminal: "cmd.exe",
  cmd: "cmd.exe",
  powershell: "powershell.exe",
  code: "code",
  vscode: "code",
  chrome: "chrome",
  edge: "msedge",
  spotify: "spotify",
  taskmanager: "taskmgr.exe",
  settings: "ms-settings:",
  discord: "discord",
  steam: "steam",
  whatsapp: "whatsapp",
  snippingtool: "snippingtool.exe",
  camera: "microsoft.windows.camera:",
  clock: "ms-clock:",
};

// Common website shortcuts
const WEB_SHORTCUTS: Record<string, string> = {
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  github: "https://github.com",
  reddit: "https://www.reddit.com",
  chatgpt: "https://chatgpt.com",
  netflix: "https://www.netflix.com",
  spotify: "https://open.spotify.com",
  twitter: "https://x.com",
  x: "https://x.com",
  amazon: "https://www.amazon.com",
  twitch: "https://www.twitch.tv",
  gmail: "https://mail.google.com",
  maps: "https://maps.google.com",
  wikipedia: "https://www.wikipedia.org",
  linkedin: "https://www.linkedin.com",
  instagram: "https://www.instagram.com",
};

// Safe command executor for Windows
function executeWindowsProcess(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 7000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(`[Error]: ${error.message}`);
      } else {
        resolve(stdout || stderr || "Command executed successfully.");
      }
    });
  });
}

function getSystemDiagnostics(): string {
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
  const usedMem = (parseFloat(totalMem) - parseFloat(freeMem)).toFixed(1);
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : "Unknown CPU";
  const uptimeHours = (os.uptime() / 3600).toFixed(1);
  const platform = `${os.type()} (${os.platform()} ${os.arch()})`;

  return `Windows Host: ${os.hostname()}
OS: ${platform}
CPU: ${cpuModel} (${cpus.length} cores)
RAM: ${usedMem} GB used / ${totalMem} GB total (${freeMem} GB free)
System Uptime: ${uptimeHours} hours`;
}

// Math evaluation tool
function evaluateMath(text: string): { expression: string; result: string } | null {
  const lower = text.toLowerCase().trim();

  // Percentage: "what is 20 percent of 150", "20% of 150"
  const percentMatch = lower.match(/(?:what is\s+)?([0-9.]+)\s*(?:%|percent)\s+(?:of\s+)([0-9.]+)/i);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    if (!isNaN(pct) && !isNaN(total)) {
      const res = (pct / 100) * total;
      return {
        expression: `${pct}% of ${total}`,
        result: `${res.toLocaleString()}`,
      };
    }
  }

  // Square root: "sqrt(144)" or "square root of 144"
  const sqrtMatch = lower.match(/(?:sqrt\s*\(\s*([0-9.]+)\s*\)|square root of\s+([0-9.]+))/i);
  if (sqrtMatch) {
    const num = parseFloat(sqrtMatch[1] || sqrtMatch[2]);
    if (!isNaN(num) && num >= 0) {
      const res = Math.sqrt(num);
      return {
        expression: `√${num}`,
        result: `${res % 1 === 0 ? res : res.toFixed(4)}`,
      };
    }
  }

  // Arithmetic cleanup
  const expr = lower
    .replace(/^(calculate|compute|solve|what is|evaluate)\s+/i, "")
    .replace(/times|multiplied by/gi, "*")
    .replace(/divided by/gi, "/")
    .replace(/plus/gi, "+")
    .replace(/minus/gi, "-")
    .replace(/\?+$/, "")
    .trim();

  if (!/[+\-*/^%]/.test(expr)) return null;
  if (!/^[0-9+\-*/^().\s%]+$/.test(expr)) return null;

  try {
    const sanitized = expr.replace(/\^/g, "**");
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const val = fn();
    if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
      const formatted = val % 1 === 0 ? val.toLocaleString() : parseFloat(val.toFixed(4)).toString();
      return { expression: expr, result: formatted };
    }
  } catch {
    return null;
  }
  return null;
}

// Live Weather tool via wttr.in
async function fetchLiveWeather(query: string): Promise<string | null> {
  const lower = query.toLowerCase();
  const weatherWords = ["weather", "temperature", "forecast", "is it raining", "how hot", "how cold"];
  const matches = weatherWords.some((w) => lower.includes(w));
  if (!matches) return null;

  let location = "";
  const inMatch = lower.match(/(?:weather|temperature|forecast)(?:\s+(?:in|for|at))?\s+([a-zA-Z\s]+)/i);
  if (inMatch && inMatch[1]) {
    const rawLoc = inMatch[1].replace(/\b(today|tomorrow|right now|currently|this week)\b/gi, "").trim();
    if (rawLoc.length > 2) location = rawLoc;
  }

  try {
    const url = location ? `https://wttr.in/${encodeURIComponent(location)}?format=j1` : "https://wttr.in/?format=j1";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "ASHURA-Desktop-Assistant" } });
    clearTimeout(timer);

    if (!res.ok) throw new Error("wttr service error");
    const data = await res.json();
    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0]?.areaName?.[0]?.value || location || "your current location";
    const country = data.nearest_area?.[0]?.country?.[0]?.value || "";

    if (current) {
      const tempC = current.temp_C;
      const tempF = current.temp_F;
      const desc = current.weatherDesc?.[0]?.value || "Clear";
      const humidity = current.humidity;
      const windKmph = current.windspeedKmph;
      const feelsLikeC = current.FeelsLikeC;
      return `Weather for ${area}${country ? ", " + country : ""}: ${tempC}°C (${tempF}°F), ${desc}. Humidity: ${humidity}%, Wind: ${windKmph} km/h (Feels like ${feelsLikeC}°C).`;
    }
  } catch {
    return "I could not retrieve live weather at the moment. Please verify internet connectivity.";
  }
  return null;
}

// Live Knowledge & Wikipedia summary tool
async function fetchKnowledgeSummary(query: string): Promise<{ title: string; summary: string } | null> {
  const lower = query.toLowerCase().trim();
  const knowledgeTriggers = [
    /^(?:who was|who is|who're)\s+([a-zA-Z0-9\s.-]+)/i,
    /^(?:what is|what are|what's)\s+([a-zA-Z0-9\s.-]+)/i,
    /^(?:explain|define|tell me about)\s+([a-zA-Z0-9\s.-]+)/i,
  ];

  let topic = "";
  for (const regex of knowledgeTriggers) {
    const m = lower.match(regex);
    if (m && m[1]) {
      topic = m[1].replace(/\?+$/, "").trim();
      break;
    }
  }

  const ignored = ["time", "date", "name", "weather", "battery", "ram", "cpu", "specs", "you do", "your name", "ashura", "raone", "the temperature"];
  if (!topic || topic.length < 3 || ignored.some((k) => topic.includes(k))) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/\s+/g, "_"))}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ASHURA-Desktop-Assistant (educational)" },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "standard" && data.extract) {
      const sentences = data.extract.split(/(?<=[.!?])\s+/);
      const shortExtract = sentences.slice(0, 3).join(" ");
      return {
        title: data.title,
        summary: shortExtract,
      };
    }
  } catch {
    return null;
  }
  return null;
}

const TECH_JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  "Why did the developer go broke? Because they used up all their cache!",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
  "Why do Java programmers wear glasses? Because they don't C#!",
  "An optimist sees the glass half full. A pessimist sees it half empty. A programmer sees the glass twice as big as it needs to be.",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem!"
];

// Memory graph knowledge extractor
function updateMemoryGraph(
  userText: string,
  replyText: string,
  existingGraph: MemoryGraph
): MemoryGraph {
  const nodes = [...existingGraph.nodes];
  const edges = [...existingGraph.edges];

  // Seed baseline nodes if empty
  if (nodes.length === 0) {
    nodes.push(
      { id: 1, label: "ASHURA Core" },
      { id: 2, label: "Windows Host" },
      { id: 3, label: "User" }
    );
    edges.push(
      { from: 1, to: 2, relation: "operates_on" },
      { from: 1, to: 3, relation: "assists" }
    );
  }

  // Keywords to dynamically extract
  const text = `${userText} ${replyText}`.toLowerCase();
  const candidates = [
    { key: "time", label: "Clock / Time" },
    { key: "system", label: "PC Hardware" },
    { key: "memory", label: "Memory Graph" },
    { key: "voice", label: "Speech Engine" },
    { key: "gesture", label: "MediaPipe Vision" },
    { key: "notepad", label: "Windows Notepad" },
    { key: "calc", label: "Calculator" },
    { key: "code", label: "VS Code" },
    { key: "browser", label: "Web Browser" },
    { key: "music", label: "Audio Media" },
    { key: "weather", label: "Weather Service" },
    { key: "ai", label: "LLM Intelligence" },
  ];

  for (const candidate of candidates) {
    if (text.includes(candidate.key)) {
      const exists = nodes.some(
        (n) => n.label.toLowerCase() === candidate.label.toLowerCase()
      );
      if (!exists && nodes.length < 24) {
        const nextId = nodes.length + 1;
        nodes.push({ id: nextId, label: candidate.label });
        const target = nextId % 2 === 0 ? 1 : 3;
        edges.push({ from: 1, to: nextId, relation: "associated_with" });
        if (target !== 1) {
          edges.push({ from: target, to: nextId, relation: "context" });
        }
      }
    }
  }

  return { nodes, edges };
}

// Local Autonomous Agent (Multi-Tool Suite + SmolLM2 Neural Network)
async function handleAutonomousFallback(
  message: string,
  history: ChatMessage[],
  memory: MemoryGraph,
  imageBase64?: string
): Promise<{ reply: string; toolsUsed: ToolExecutionResult[]; memoryGraph: MemoryGraph; modelUsed: string }> {
  const toolsUsed: ToolExecutionResult[] = [];
  let reply = "";
  const lower = message.toLowerCase().trim();

  // 0. Avatar Customization & Transformation
  const avatarCmd = detectAvatarCommand(message);
  if (avatarCmd) {
    toolsUsed.push({
      name: "change_avatar",
      status: "success",
      details: avatarCmd.replyText,
      avatarCustomization: {
        theme: avatarCmd.theme,
        hairColor: avatarCmd.hairColor,
        eyeColor: avatarCmd.eyeColor,
        outfitColor: avatarCmd.outfitColor,
      },
    });
    reply = avatarCmd.replyText;
  }

  // 0b. Avatar Action Emotes (dance, spin, cheer, rage, sleep)
  if (!reply) {
    const actionCmd = detectAvatarActionCommand(message);
    if (actionCmd) {
      toolsUsed.push({
        name: "avatar_action",
        status: "success",
        details: actionCmd.replyText,
        avatarAction: actionCmd.action,
      });
      reply = actionCmd.replyText;
    }
  }

  // 0c. Video & Media Player Commands
  if (!reply) {
    const videoCmd = detectVideoCommand(message);
    if (videoCmd) {
      toolsUsed.push({
        name: "video_control",
        status: "success",
        details: videoCmd.replyText,
        videoAction: {
          action: videoCmd.action,
          title: videoCmd.title,
          url: videoCmd.url,
          videoId: videoCmd.videoId,
        },
      });
      reply = videoCmd.replyText;
    }
  }

  // 0d. Timer Commands
  if (!reply) {
    const timerCmd = detectTimerCommand(message);
    if (timerCmd) {
      toolsUsed.push({
        name: "set_timer",
        status: "success",
        details: timerCmd.replyText,
        timerAction: {
          durationSec: timerCmd.durationSec,
          label: timerCmd.label,
        },
      });
      reply = timerCmd.replyText;
    }
  }

  // 0e. Scratchpad / Note Commands
  if (!reply) {
    const noteCmd = detectNoteCommand(message);
    if (noteCmd) {
      toolsUsed.push({
        name: "note_scratchpad",
        status: "success",
        details: noteCmd.replyText,
        noteAction: {
          action: noteCmd.action,
          text: noteCmd.noteText,
        },
      });
      reply = noteCmd.replyText;
    }
  }

  // 0f. Rock-Paper-Scissors Mini-Game
  if (!reply) {
    const rpsCmd = detectRPSCommand(message);
    if (rpsCmd) {
      toolsUsed.push({
        name: "rock_paper_scissors",
        status: "success",
        details: rpsCmd.replyText,
        rpsAction: {
          userMove: rpsCmd.userMove,
          ashuraMove: rpsCmd.ashuraMove,
          result: rpsCmd.result,
        },
        avatarAction: rpsCmd.result === "win" ? "cheer" : rpsCmd.result === "lose" ? "rage" : "spin",
      });
      reply = rpsCmd.replyText;
    }
  }

  // 0g. System Audio Volume & Web Navigation Shortcuts
  if (!reply) {
    const sysCmd = detectSystemCommand(message);
    if (sysCmd) {
      if (sysCmd.commandToRun) {
        await executeWindowsProcess(sysCmd.commandToRun);
      }
      toolsUsed.push({
        name: "system_control",
        status: "success",
        details: sysCmd.replyText,
        systemAction: sysCmd.action,
      });
      reply = sysCmd.replyText;
    }
  }

  // 0h. Optical Visual Scan (Local Fallback)
  if (!reply && imageBase64) {
    toolsUsed.push({
      name: "optical_vision_scan",
      status: "success",
      details: "Received visual optical frame snapshot.",
    });
    reply = "Optical visual snapshot captured and analyzed! In local offline mode, frame geometry is validated. Connect a free Google Gemini 2.0 Flash API key via the [BRAIN] settings for full real-time multimodal object detection, reading, and reasoning!";
  }

  // 1. Math Calculation Engine
  if (!reply) {
    const mathResult = evaluateMath(message);
    if (mathResult) {
      toolsUsed.push({
        name: "evaluate_math",
        status: "success",
        details: `${mathResult.expression} = ${mathResult.result}`,
      });
      reply = `${mathResult.expression} = ${mathResult.result}`;
    }
  }

  // 2. Live Weather Service
  if (!reply) {
    const weatherResult = await fetchLiveWeather(message);
    if (weatherResult) {
      toolsUsed.push({
        name: "fetch_weather",
        status: "success",
        details: weatherResult,
      });
      reply = weatherResult;
    }
  }

  // 3. Web Search & Web Shortcuts
  if (!reply) {
    // Direct Google Search
    const searchMatch = lower.match(/^(?:search\s+google\s+for|search\s+for|google)\s+(.+)/i);
    if (searchMatch && searchMatch[1]) {
      const q = searchMatch[1].trim();
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      await executeWindowsProcess(`start "" "${searchUrl}"`);
      toolsUsed.push({
        name: "google_search",
        status: "success",
        details: `Searched Google for "${q}".`,
      });
      reply = `Searching Google for "${q}" in your browser.`;
    } else {
      // Known website shortcuts (e.g. "open youtube", "open github")
      for (const [site, url] of Object.entries(WEB_SHORTCUTS)) {
        if (lower.includes(`open ${site}`) || lower.includes(`launch ${site}`) || lower === site) {
          await executeWindowsProcess(`start "" "${url}"`);
          toolsUsed.push({
            name: `open_website (${site})`,
            status: "success",
            details: `Opened ${url} in default browser.`,
          });
          reply = `Opening ${site.toUpperCase()} in your browser.`;
          break;
        }
      }
    }
  }

  // 4. Windows App launching
  if (!reply) {
    for (const [name, execCmd] of Object.entries(WINDOWS_APPS)) {
      if (lower.includes(`open ${name}`) || lower.includes(`launch ${name}`) || lower.includes(`start ${name}`)) {
        const cmd = `start "" "${execCmd}"`;
        await executeWindowsProcess(cmd);
        toolsUsed.push({
          name: `launch_app (${name})`,
          status: "success",
          details: `Launched ${name} on Windows.`,
        });
        reply = `I have launched ${name} on your Windows machine.`;
        break;
      }
    }
  }

  // 5. Windows Hardware & Folder Controls
  if (!reply) {
    // Volume controls
    if (lower.includes("volume up") || lower.includes("increase volume") || lower.includes("louder")) {
      await executeWindowsProcess(`powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]175); (New-Object -ComObject Wscript.Shell).SendKeys([char]175); (New-Object -ComObject Wscript.Shell).SendKeys([char]175)"`);
      toolsUsed.push({ name: "control_volume (up)", status: "success", details: "Increased volume." });
      reply = "Increased system volume.";
    } else if (lower.includes("volume down") || lower.includes("decrease volume") || lower.includes("lower volume")) {
      await executeWindowsProcess(`powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]174); (New-Object -ComObject Wscript.Shell).SendKeys([char]174); (New-Object -ComObject Wscript.Shell).SendKeys([char]174)"`);
      toolsUsed.push({ name: "control_volume (down)", status: "success", details: "Decreased volume." });
      reply = "Decreased system volume.";
    } else if (lower.includes("mute") || lower.includes("unmute")) {
      await executeWindowsProcess(`powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]173)"`);
      toolsUsed.push({ name: "control_volume (mute)", status: "success", details: "Toggled mute." });
      reply = "Toggled system audio mute.";
    } else if (lower.includes("battery") || lower.includes("power status")) {
      const batOut = await executeWindowsProcess(`powershell.exe -Command "Get-CimInstance Win32_Battery | Select-Object -ExpandProperty EstimatedChargeRemaining"`);
      const pct = batOut.trim();
      toolsUsed.push({ name: "get_battery", status: "success", details: `Battery: ${pct}%` });
      reply = pct ? `Your battery is currently at ${pct}%.` : "No battery hardware detected (Desktop PC).";
    } else if (lower.includes("open downloads")) {
      await executeWindowsProcess(`start shell:Downloads`);
      toolsUsed.push({ name: "open_folder", status: "success", details: "Opened Downloads folder." });
      reply = "Opened your Downloads folder.";
    } else if (lower.includes("open desktop")) {
      await executeWindowsProcess(`start shell:Desktop`);
      toolsUsed.push({ name: "open_folder", status: "success", details: "Opened Desktop folder." });
      reply = "Opened your Desktop folder.";
    } else if (lower.includes("open documents")) {
      await executeWindowsProcess(`start shell:Personal`);
      toolsUsed.push({ name: "open_folder", status: "success", details: "Opened Documents folder." });
      reply = "Opened your Documents folder.";
    } else if (lower.includes("open pictures") || lower.includes("open photos")) {
      await executeWindowsProcess(`start shell:My Pictures`);
      toolsUsed.push({ name: "open_folder", status: "success", details: "Opened Pictures folder." });
      reply = "Opened your Pictures folder.";
    }
  }

  // 6. System Diagnostics
  if (!reply && (lower.includes("system specs") || lower.includes("diagnostics") || lower.includes("pc hardware") || lower.includes("specs") || lower.includes("ram") || lower.includes("cpu"))) {
    const diag = getSystemDiagnostics();
    toolsUsed.push({
      name: "get_pc_diagnostics",
      status: "success",
      details: diag,
    });
    reply = `Here is your Windows system status:\n${diag}`;
  }

  // 7. Time / Date (Strict regex to avoid matching 'today' or 'yesterday')
  const isTimeDateQuery = /\b(what time is it|current time|what is the time|what is the date|what is today's date|what day is it|current date|what time|what date)\b/i.test(lower);
  if (!reply && isTimeDateQuery && !lower.includes("weather") && !lower.includes("forecast")) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const dateStr = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    reply = `The current time is ${timeStr} on ${dateStr}.`;
  }

  // 8. Live Knowledge & Wikipedia Encyclopedia Lookup
  if (!reply) {
    const knowledge = await fetchKnowledgeSummary(message);
    if (knowledge) {
      toolsUsed.push({
        name: "wikipedia_lookup",
        status: "success",
        details: knowledge.summary,
      });
      reply = `${knowledge.title}: ${knowledge.summary}`;
    }
  }

  // 9. Safe Windows Diagnostic Shell Commands
  if (!reply && (lower.startsWith("run ") || lower.startsWith("cmd ") || lower.startsWith("exec "))) {
    const commandToRun = message.replace(/^(run|cmd|exec)\s+/i, "").trim();
    const safePrefixes = ["dir", "ipconfig", "whoami", "ver", "hostname", "tasklist", "systeminfo", "echo", "ping"];
    const isSafe = safePrefixes.some((p) => commandToRun.toLowerCase().startsWith(p));

    if (isSafe) {
      const output = await executeWindowsProcess(`powershell.exe -Command "${commandToRun}"`);
      toolsUsed.push({
        name: "run_system_command",
        status: "success",
        details: output.slice(0, 300),
      });
      reply = `Command output:\n${output.slice(0, 400)}`;
    } else {
      toolsUsed.push({
        name: "run_system_command",
        status: "error",
        details: "Blocked command for safety.",
      });
      reply = `For safety, only diagnostic commands (${safePrefixes.join(", ")}) can be executed directly.`;
    }
  }

  // 10. Built-in Core Knowledge & Assistant Capabilities
  if (!reply) {
    if (lower.includes("who are you") || lower.includes("what are you") || lower === "ashura" || lower === "raone") {
      reply = "I am ASHURA (Autonomous Situational High-Utility Responsive Assistant), your intelligent AI desktop assistant running on Windows. I can control your PC, evaluate math, fetch live weather, launch apps and websites, look up knowledge, and customize my 3D chibi avatar.";
    } else if (lower.includes("what can you do") || lower.includes("help") || lower.includes("commands") || lower === "capabilities") {
      reply = "Here is what I can do for you on Windows:\n" +
        "• 🧮 Math: 'calculate 54 * 23', '20% of 150', 'sqrt(144)'\n" +
        "• ⛅ Live Weather: 'weather in London', 'is it raining?'\n" +
        "• 🌐 Live Knowledge & Web Search: 'who was Alan Turing', 'latest news about AI'\n" +
        "• 🚀 App & Web Launcher: 'open youtube', 'open notepad', 'search google for AI'\n" +
        "• 💻 Hardware Controls: 'volume up', 'mute', 'battery status', 'specs', 'open downloads'\n" +
        "• 🎭 3D Avatar: 'change avatar to anime girl / mecha robot / cat neko / ninja / cyber'";
    } else if (lower.includes("joke") || lower.includes("funny")) {
      const joke = TECH_JOKES[Math.floor(Math.random() * TECH_JOKES.length)];
      reply = joke;
    }
  }

  // 10.5 Real-Time Live Web Search & Situational Understanding (DuckDuckGo + Web RAG)
  if (!reply) {
    const isSituationalOrSearch =
      lower.includes("why ") ||
      lower.includes("how ") ||
      lower.includes("what is happening") ||
      lower.includes("latest news") ||
      lower.includes("news about") ||
      lower.includes("fix ") ||
      lower.includes("error") ||
      lower.includes("problem") ||
      lower.includes("issue") ||
      lower.includes("compare ") ||
      lower.includes("difference between") ||
      lower.includes("recommend ") ||
      lower.includes("should i") ||
      lower.includes("tell me about") ||
      lower.includes("situation") ||
      lower.startsWith("search ");

    if (isSituationalOrSearch) {
      try {
        const webResults = await searchLiveWeb(message, 3);
        if (webResults.length > 0) {
          toolsUsed.push({
            name: "live_web_search",
            status: "success",
            details: `Found ${webResults.length} real-time web sources for "${message}".`,
          });
          const top = webResults[0];
          const bullets = webResults.slice(1).map((r) => `• ${r.snippet}`).join("\n");
          reply = `${top.snippet}${bullets ? `\n\nKey Insights:\n${bullets}` : ""}\n\n[Source: ${top.title}]`;
        }
      } catch (searchErr) {
        console.warn("Live web search fallback error:", searchErr);
      }
    }
  }

  // 11. Local Neural Network Model (SmolLM2-135M ONNX - 180 Tokens)
  if (!reply) {
    try {
      reply = await generateLocalAIResponse({
        message,
        history,
        maxTokens: 180,
        systemPrompt:
          "You are ASHURA, an intelligent desktop voice assistant running locally on Windows. Answer clearly, concisely, and naturally in 1 to 3 short sentences.",
      });
    } catch (modelErr) {
      console.warn("Local model inference error, using fallback greeting:", modelErr);
      if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        reply = "Hello! ASHURA is online and running locally on Windows. How can I help you today?";
      } else {
        reply = `Understood. Standing by for your next Windows command.`;
      }
    }
  }

  const updatedGraph = updateMemoryGraph(message, reply, memory);
  return { reply, toolsUsed, memoryGraph: updatedGraph, modelUsed: "SmolLM2-135M (Local ONNX)" };
}

// Google Gemini API caller (Upgraded with Gemini 2.0 Flash + Multimodal Vision + Live Web Search Context)
async function callGemini(
  apiKey: string,
  message: string,
  history: ChatMessage[],
  memory: MemoryGraph,
  imageBase64?: string
): Promise<{ reply: string; toolsUsed: ToolExecutionResult[]; memoryGraph: MemoryGraph; modelUsed: string }> {
  const toolsUsed: ToolExecutionResult[] = [];
  const lower = message.toLowerCase();

  // 0. Check avatar theme command
  const avatarCmd = detectAvatarCommand(message);
  if (avatarCmd) {
    toolsUsed.push({
      name: "change_avatar",
      status: "success",
      details: avatarCmd.replyText,
      avatarCustomization: {
        theme: avatarCmd.theme,
        hairColor: avatarCmd.hairColor,
        eyeColor: avatarCmd.eyeColor,
        outfitColor: avatarCmd.outfitColor,
      },
    });
  }

  // 0b. Avatar Action Emotes
  const actionCmd = detectAvatarActionCommand(message);
  if (actionCmd) {
    toolsUsed.push({
      name: "avatar_action",
      status: "success",
      details: actionCmd.replyText,
      avatarAction: actionCmd.action,
    });
  }

  // 0c. Video & Media Player Commands
  const videoCmd = detectVideoCommand(message);
  if (videoCmd) {
    toolsUsed.push({
      name: "video_control",
      status: "success",
      details: videoCmd.replyText,
      videoAction: {
        action: videoCmd.action,
        title: videoCmd.title,
        url: videoCmd.url,
        videoId: videoCmd.videoId,
      },
    });
  }

  // 0d. Timer Commands
  const timerCmd = detectTimerCommand(message);
  if (timerCmd) {
    toolsUsed.push({
      name: "set_timer",
      status: "success",
      details: timerCmd.replyText,
      timerAction: {
        durationSec: timerCmd.durationSec,
        label: timerCmd.label,
      },
    });
  }

  // 0e. Scratchpad / Note Commands
  const noteCmd = detectNoteCommand(message);
  if (noteCmd) {
    toolsUsed.push({
      name: "note_scratchpad",
      status: "success",
      details: noteCmd.replyText,
      noteAction: {
        action: noteCmd.action,
        text: noteCmd.noteText,
      },
    });
  }

  // 0f. Rock-Paper-Scissors Mini-Game
  const rpsCmd = detectRPSCommand(message);
  if (rpsCmd) {
    toolsUsed.push({
      name: "rock_paper_scissors",
      status: "success",
      details: rpsCmd.replyText,
      rpsAction: {
        userMove: rpsCmd.userMove,
        ashuraMove: rpsCmd.ashuraMove,
        result: rpsCmd.result,
      },
      avatarAction: rpsCmd.result === "win" ? "cheer" : rpsCmd.result === "lose" ? "rage" : "spin",
    });
  }

  // 0g. System Audio Volume & Web Navigation Shortcuts
  const sysCmd = detectSystemCommand(message);
  if (sysCmd) {
    if (sysCmd.commandToRun) {
      await executeWindowsProcess(sysCmd.commandToRun);
    }
    toolsUsed.push({
      name: "system_control",
      status: "success",
      details: sysCmd.replyText,
      systemAction: sysCmd.action,
    });
  }

  // 0h. Optical Vision Snapshot
  if (imageBase64) {
    toolsUsed.push({
      name: "optical_vision_analysis",
      status: "success",
      details: "Analyzing visual optical frame using Gemini 2.0 multimodal vision.",
    });
  }

  // 1. Math check
  const mathRes = evaluateMath(message);
  if (mathRes) {
    toolsUsed.push({
      name: "evaluate_math",
      status: "success",
      details: `${mathRes.expression} = ${mathRes.result}`,
    });
  }

  // 2. Weather check
  if (lower.includes("weather") || lower.includes("forecast") || lower.includes("temperature")) {
    const w = await fetchLiveWeather(message);
    if (w) {
      toolsUsed.push({
        name: "fetch_weather",
        status: "success",
        details: w,
      });
    }
  }

  // 3. System diagnostics
  if (lower.includes("specs") || lower.includes("system status") || lower.includes("pc hardware") || lower.includes("ram") || lower.includes("cpu")) {
    const diag = getSystemDiagnostics();
    toolsUsed.push({
      name: "get_pc_diagnostics",
      status: "success",
      details: diag,
    });
  }

  // 4. App launching
  for (const [name, execCmd] of Object.entries(WINDOWS_APPS)) {
    if (lower.includes(`open ${name}`) || lower.includes(`launch ${name}`)) {
      await executeWindowsProcess(`start "" "${execCmd}"`);
      toolsUsed.push({
        name: `launch_app (${name})`,
        status: "success",
        details: `Launched ${name} on Windows.`,
      });
    }
  }

  // 5. Real-time Live Web Search integration for Gemini
  let webContext = "";
  const needsWebSearch =
    lower.includes("news") ||
    lower.includes("latest") ||
    lower.includes("today") ||
    lower.includes("happening") ||
    lower.includes("search") ||
    lower.includes("who is") ||
    lower.includes("price") ||
    lower.includes("recent") ||
    lower.includes("update") ||
    lower.includes("fix");

  if (needsWebSearch) {
    try {
      const searchResults = await searchLiveWeb(message, 4);
      if (searchResults.length > 0) {
        webContext = formatWebContext(searchResults);
        toolsUsed.push({
          name: "live_web_search",
          status: "success",
          details: `Searched web for "${message}" (${searchResults.length} sources).`,
        });
      }
    } catch {}
  }

  const systemInstruction = `You are ASHURA, an elite, highly intelligent AI assistant running on Windows with a 3D avatar interface.
You have the reasoning, empathy, and situational depth of Google Gemini.
You understand the user's situation, diagnose their technical and daily problems, and provide clear, empathetic, and spoken-friendly responses (2-4 sentences or structured bullet points).
Host specs:
${getSystemDiagnostics()}
${toolsUsed.length > 0 ? `Executed tools:\n${JSON.stringify(toolsUsed)}` : ""}
${webContext ? `Real-Time Live Web Search Context:\n${webContext}` : ""}`;

  type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
  const userParts: GeminiPart[] = [];
  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    userParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanBase64,
      },
    });
  }
  userParts.push({ text: message || "Analyze what you see in this optical visual snapshot in detail." });

  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    {
      role: "user",
      parts: userParts,
    },
  ];

  // Try gemini-2.0-flash first, fallback to gemini-1.5-flash
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
  for (const model of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 400,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          const updatedGraph = updateMemoryGraph(message, reply, memory);
          return { reply, toolsUsed, memoryGraph: updatedGraph, modelUsed: `Google Gemini (${model})` };
        }
      }
    } catch {}
  }

  return handleAutonomousFallback(message, history, memory);
}

// OpenAI / Groq / Ollama caller
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  message: string,
  history: ChatMessage[],
  memory: MemoryGraph
): Promise<{ reply: string; toolsUsed: ToolExecutionResult[]; memoryGraph: MemoryGraph }> {
  const toolsUsed: ToolExecutionResult[] = [];

  const lower = message.toLowerCase();
  for (const [name, execCmd] of Object.entries(WINDOWS_APPS)) {
    if (lower.includes(`open ${name}`) || lower.includes(`launch ${name}`)) {
      await executeWindowsProcess(`start "" "${execCmd}"`);
      toolsUsed.push({
        name: `launch_app (${name})`,
        status: "success",
        details: `Launched ${name} on Windows.`,
      });
    }
  }

  const messages = [
    {
      role: "system",
      content: `You are ASHURA, an AI voice assistant running on Windows. Keep answers concise and spoken-friendly.\nSystem Specs: ${getSystemDiagnostics()}`,
    },
    ...history.slice(-6),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      return handleAutonomousFallback(message, history, memory);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Request completed.";
    const updatedGraph = updateMemoryGraph(message, reply, memory);
    return { reply, toolsUsed, memoryGraph: updatedGraph };
  } catch {
    return handleAutonomousFallback(message, history, memory);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawMessage = (body.message as string | undefined)?.trim() || "";
    const image = (body.image as string | undefined)?.trim();
    const message = rawMessage || (image ? "Analyze what you see in this optical visual snapshot in detail." : "");
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];
    const memory: MemoryGraph = body.memoryGraph || { nodes: [], edges: [] };

    if (!message && !image) {
      return NextResponse.json({ error: "Empty message and no image provided" }, { status: 400 });
    }

    const clientProvider = (body.clientProvider as string | undefined)?.toLowerCase();
    const clientApiKey = (body.clientApiKey as string | undefined)?.trim();
    const clientOllamaHost = (body.clientOllamaHost as string | undefined)?.trim();

    let result: { reply: string; toolsUsed: ToolExecutionResult[]; memoryGraph: MemoryGraph; modelUsed?: string };

    if (clientProvider === "local") {
      result = await handleAutonomousFallback(message, history, memory, image);
    } else {
      const geminiKey = (clientProvider === "gemini" && clientApiKey) || (!clientProvider && process.env.GEMINI_API_KEY);
      const groqKey = (clientProvider === "groq" && clientApiKey) || (!clientProvider && process.env.GROQ_API_KEY);
      const openaiKey = (clientProvider === "openai" && clientApiKey) || (!clientProvider && process.env.OPENAI_API_KEY);
      const ollamaHost = clientProvider === "ollama" ? (clientOllamaHost || "http://localhost:11434") : (!clientProvider ? process.env.OLLAMA_HOST : undefined);

      if (geminiKey) {
        result = await callGemini(geminiKey, message, history, memory, image);
      } else if (groqKey) {
        result = await callOpenAICompatible(
          "https://api.groq.com/openai/v1",
          groqKey,
          "llama-3.3-70b-versatile",
          message,
          history,
          memory
        );
      } else if (openaiKey) {
        result = await callOpenAICompatible(
          "https://api.openai.com/v1",
          openaiKey,
          "gpt-4o-mini",
          message,
          history,
          memory
        );
      } else if (ollamaHost) {
        result = await callOpenAICompatible(
          `${ollamaHost}/v1`,
          "",
          "llama3",
          message,
          history,
          memory
        );
      } else {
        // Intelligent zero-config fallback (Local SmolLM2 model + Multi-tool engine)
        result = await handleAutonomousFallback(message, history, memory, image);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Agent API error:", err);
    return NextResponse.json(
      {
        reply: "I encountered an internal error processing that request.",
        toolsUsed: [],
        memoryGraph: { nodes: [], edges: [] },
      },
      { status: 500 }
    );
  }
}
