export interface AudioCaptureOptions {
  micOnly?: boolean;
  sampleRate?: number;
  onAudioData?: (pcmData: Int16Array) => void;
  onVolumeUpdate?: (levels: { teamLevel: number; clientLevel: number }) => void;
}

export interface AudioCaptureSession {
  micStream: MediaStream;
  tabStream: MediaStream | null;
  audioContext: AudioContext;
  mergerNode: ChannelMergerNode;
  stop: () => void;
  isMicOnly: boolean;
}
