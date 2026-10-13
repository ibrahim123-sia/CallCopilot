import { TranscriptEntry } from "../types";
import { DEMO_CALL_SCRIPT, DemoStep } from "./demoScript";
import {
  ProviderConnectOptions,
  StatusCallback,
  TranscriptCallback,
  TranscriptionProvider,
  TranscriptionStatus,
} from "./types";

export class DemoTranscriptionProvider implements TranscriptionProvider {
  private status: TranscriptionStatus = "idle";
  private transcriptCallbacks: TranscriptCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentStepIndex: number = 0;
  private script: DemoStep[] = DEMO_CALL_SCRIPT;
  private speedMultiplier: number = 1.0;
  private activeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(customScript?: DemoStep[]) {
    if (customScript) {
      this.script = customScript;
    }
  }

  public async connect(options: ProviderConnectOptions = {}): Promise<void> {
    this.speedMultiplier = options.speedMultiplier ?? 1.0;
    this.setStatus("connecting");

    await new Promise((r) => setTimeout(r, 400));
    this.setStatus("listening");
    this.isRunning = true;
    this.isPaused = false;
    this.currentStepIndex = 0;

    this.playNextStep();
  }

  public sendAudio(_pcmChunk: Int16Array): void {
    // In demo mode, live microphone audio is ignored as audio is scripted
    void _pcmChunk;
  }

  public disconnect(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    this.setStatus("disconnected");
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    this.setStatus("paused");
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.setStatus("listening");
    this.playNextStep();
  }

  public onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallbacks.push(callback);
  }

  public onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  public getStatus(): TranscriptionStatus {
    return this.status;
  }

  private setStatus(status: TranscriptionStatus, errorDetail?: string): void {
    this.status = status;
    for (const cb of this.statusCallbacks) {
      cb(status, errorDetail);
    }
  }

  private emitTranscript(entry: TranscriptEntry): void {
    for (const cb of this.transcriptCallbacks) {
      cb(entry);
    }
  }

  private playNextStep(): void {
    if (!this.isRunning || this.isPaused) return;

    if (this.currentStepIndex >= this.script.length) {
      // Finished all steps
      return;
    }

    const step = this.script[this.currentStepIndex];
    const words = step.text.split(" ");
    const entryId = `demo-${Date.now()}-${this.currentStepIndex}`;
    const startTime = Date.now();

    // Stream interim words progressively
    const totalDuration = (step.interimDelayMs || 2500) / this.speedMultiplier;
    const wordInterval = totalDuration / Math.max(words.length, 1);

    let currentWordCount = 1;

    const streamWords = () => {
      if (!this.isRunning || this.isPaused) return;

      if (currentWordCount <= words.length) {
        const interimText = words.slice(0, currentWordCount).join(" ");
        this.emitTranscript({
          id: entryId,
          speaker: step.speaker,
          text: interimText,
          timestamp: startTime,
          isFinal: false,
          channel: step.channel,
          language: step.language,
        });
        currentWordCount++;
        this.activeTimeout = setTimeout(streamWords, wordInterval);
      } else {
        // Emit final utterance
        this.emitTranscript({
          id: entryId,
          speaker: step.speaker,
          text: step.text,
          timestamp: startTime,
          durationMs: totalDuration,
          isFinal: true,
          channel: step.channel,
          language: step.language,
        });

        this.currentStepIndex++;
        const pauseAfter = (step.pauseAfterMs || 2000) / this.speedMultiplier;
        this.activeTimeout = setTimeout(() => {
          this.playNextStep();
        }, pauseAfter);
      }
    };

    streamWords();
  }
}
