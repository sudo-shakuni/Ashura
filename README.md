# RAONE — Orb UI

**Frontend only · Backend coming soon**

The interface layer of **RAONE**, a real-time voice assistant for macOS.

This repository contains the Three.js orb, its shader and post-processing stack, and MediaPipe hand-gesture control. It runs standalone — no backend, no API keys, no configuration.

The voice pipeline, tool server, and memory system aren't here yet. They'll be uploaded separately.

![The RAONE orb in its SPEAKING state](docs/orb.png)

---

## What's here

| | |
|---|---|
| **The orb** | Layered wireframe shells, a spiral inner core, a particle-assembled avatar, floating code-text sprites, and an orbiting graph visualization — all custom Three.js with hand-written shaders. |
| **Post-processing** | Bloom and chromatic aberration through an `EffectComposer` pass stack. |
| **Six visual states** | `IDLE` · `LISTENING` · `THINKING` · `SPEAKING` · `TOOL_EXECUTION` · `ERROR`, each with its own colour, motion and intensity. |
| **Hand gestures** | Webcam hand tracking via MediaPipe — pinch to zoom, move to rotate. Runs entirely in the browser. |
| **Direct controls** | Mouse drag to rotate, scroll to zoom, keyboard shortcuts. |

In the full system the orb's state is driven by a live speech session and by tool calls executing on the machine. Here, a state switcher stands in for that so the visuals can be explored on their own.

---

## Running it

```bash
git clone https://github.com/suvamneog/RaOnev1.0.git
cd RaOnev1.0
npm install
npm run dev
```

Open <http://localhost:3000>. Nothing else to configure.

Gestures ask for camera permission when you enable them; everything else works without it.

---

## Controls

| Input | Action |
|---|---|
| `G` | Toggle hand-gesture tracking |
| `C` | Toggle the camera self-view |
| `D` | Toggle the info panel |
| `R` | Reset the view |
| `+` / `−` | Zoom |
| Drag | Rotate |
| Scroll | Zoom |
| State buttons | Switch the orb's visual state |

---

## Structure

```
app/          Next.js app shell
components/   RaoneOrb.tsx — canvas, controls, gesture wiring
lib/
  orbScene.ts     the full Three.js scene, shaders and post-processing
  handTracker.ts  MediaPipe hand tracking and gesture recognition
public/       static assets
```

`lib/orbScene.ts` and `lib/handTracker.ts` are the complete, unmodified implementations from the full project.

---

## Built with

Next.js 16 · React 19 · Three.js · MediaPipe Tasks Vision · TypeScript
