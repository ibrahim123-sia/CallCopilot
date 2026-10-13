import { TranscriptEntry } from "../types";

export type TranscriptionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "paused"
  | "error"
  | "disconnected";

export interface ProviderConnectOptions {
  token?: string;
  language?: "en" | "ur" | "auto";
  multichannel?: boolean;
  sampleRate?: number;
  speedMultiplier?: number; // for demo mode acceleration
}

export type TranscriptCallback = (entry: TranscriptEntry) => void;
export type StatusCallback = (status: TranscriptionStatus, errorDetail?: string) => void;

export interface TranscriptionProvider {
  connect(options: ProviderConnectOptions): Promise<void>;
  sendAudio(pcmChunk: Int16Array): void;
  disconnect(): void;
  pause(): void;
  resume(): void;
  onTranscript(callback: TranscriptCallback): void;
  onStatusChange(callback: StatusCallback): void;
  getStatus(): TranscriptionStatus;
}
