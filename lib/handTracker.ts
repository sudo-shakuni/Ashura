import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type HandGesture =
  | { type: "rotate"; dx: number; dy: number }
  | { type: "zoom"; delta: number };

const PINCH_ON_THRESHOLD = 0.045; // normalized distance to engage pinch
const PINCH_OFF_THRESHOLD = 0.065; // must open past this to release (hysteresis)

interface HandPinchState {
  pinched: boolean;
  lastX: number | null;
  lastY: number | null;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private onGesture: ((gesture: HandGesture) => void) | null = null;
  private rafId: number | null = null;
  private running = false;

  private hand0: HandPinchState = { pinched: false, lastX: null, lastY: null };
  private hand1: HandPinchState = { pinched: false, lastX: null, lastY: null };
  private lastTwoHandDistance: number | null = null;

  async start(videoEl: HTMLVideoElement, onGesture: (gesture: HandGesture) => void) {
    this.video = videoEl;
    this.onGesture = onGesture;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera API not available in this browser context (requires localhost or HTTPS).");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
    } catch {
      // Fallback for cameras with strict or unmatching constraints on Windows
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }

    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch (err) {
      console.warn("Video play interrupted or delayed:", err);
    }

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const modelAssetPath =
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
    } catch (gpuErr) {
      console.warn("GPU delegate unavailable or failed on this Windows graphics setup, falling back to CPU:", gpuErr);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
    }

    this.running = true;
    this.loop();
  }

  private loop = () => {
    if (!this.running || !this.landmarker || !this.video) return;
    if (this.video.readyState >= 2) {
      try {
        const result = this.landmarker.detectForVideo(this.video, performance.now());
        this.processResult(result);
      } catch (frameErr) {
        // Prevent single transient frame error from crashing entire loop
        console.warn("Hand tracking frame processing issue:", frameErr);
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private processResult(result: HandLandmarkerResult) {
    const hands = result.landmarks ?? [];

    if (hands.length >= 2) {
      // two-hand pinch -> zoom
      const pinch0 = this.updatePinch(this.hand0, hands[0]);
      const pinch1 = this.updatePinch(this.hand1, hands[1]);
      if (pinch0 && pinch1) {
        const c0 = hands[0][9]; // middle finger MCP as hand-center proxy
        const c1 = hands[1][9];
        const d = distance(c0.x, c0.y, c1.x, c1.y);
        if (this.lastTwoHandDistance !== null) {
          const delta = d - this.lastTwoHandDistance;
          if (Math.abs(delta) > 0.001) {
            this.onGesture?.({ type: "zoom", delta: delta * 10 });
          }
        }
        this.lastTwoHandDistance = d;
      } else {
        this.lastTwoHandDistance = null;
      }
      this.hand1.lastX = this.hand1.lastY = null;
      if (!pinch1) this.releaseHandDrag(this.hand1);
      if (!pinch0) this.releaseHandDrag(this.hand0);
    } else if (hands.length === 1) {
      this.lastTwoHandDistance = null;
      this.releaseHandDrag(this.hand1);
      const pinch0 = this.updatePinch(this.hand0, hands[0]);
      if (pinch0) {
        const tip = hands[0][8]; // index fingertip
        if (this.hand0.lastX !== null && this.hand0.lastY !== null) {
          const dx = tip.x - this.hand0.lastX;
          const dy = tip.y - this.hand0.lastY;
          if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
            this.onGesture?.({ type: "rotate", dx: dx * 6, dy: dy * 6 });
          }
        }
        this.hand0.lastX = tip.x;
        this.hand0.lastY = tip.y;
      } else {
        this.releaseHandDrag(this.hand0);
      }
    } else {
      this.lastTwoHandDistance = null;
      this.releaseHandDrag(this.hand0);
      this.releaseHandDrag(this.hand1);
    }
  }

  private releaseHandDrag(hand: HandPinchState) {
    hand.lastX = null;
    hand.lastY = null;
  }

  /** Updates pinch state with hysteresis and returns whether the hand is currently pinched. */
  private updatePinch(state: HandPinchState, landmarks: { x: number; y: number }[]): boolean {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const d = distance(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);

    if (state.pinched) {
      if (d > PINCH_OFF_THRESHOLD) {
        state.pinched = false;
      }
    } else {
      if (d < PINCH_ON_THRESHOLD) {
        state.pinched = true;
      }
    }
    return state.pinched;
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.landmarker?.close();
    this.landmarker = null;
    if (this.video?.srcObject) {
      const stream = this.video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }
    this.video = null;
    this.onGesture = null;
    this.hand0 = { pinched: false, lastX: null, lastY: null };
    this.hand1 = { pinched: false, lastX: null, lastY: null };
    this.lastTwoHandDistance = null;
  }
}
