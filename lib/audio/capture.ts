import { AudioCaptureOptions, AudioCaptureSession } from "./types";
export type { AudioCaptureOptions, AudioCaptureSession };

export function checkBrowserAudioSupport(): {
  supported: boolean;
  isChromeOrEdge: boolean;
  message?: string;
} {
  if (typeof window === "undefined" || !navigator.mediaDevices) {
    return {
      supported: false,
      isChromeOrEdge: false,
      message: "Browser mediaDevices API is not available.",
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isChromeOrEdge =
    ua.includes("chrome") || ua.includes("edg") || ua.includes("chromium");

  if (!navigator.mediaDevices.getDisplayMedia) {
    return {
      supported: false,
      isChromeOrEdge,
      message:
        "Screen and tab audio capture (getDisplayMedia) is not supported in this browser. Please use Google Chrome or Microsoft Edge.",
    };
  }

  return {
    supported: true,
    isChromeOrEdge,
  };
}

export async function startAudioCapture(
  options: AudioCaptureOptions = {}
): Promise<AudioCaptureSession> {
  const { micOnly = false, sampleRate = 16000, onAudioData, onVolumeUpdate } = options;

  if (typeof window === "undefined") {
    throw new Error("startAudioCapture must be run in browser context");
  }

  // 1. Request Microphone (Channel 0: Our Team)
  let micStream: MediaStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error && err.name === "NotAllowedError"
        ? "Microphone access denied. Please allow microphone permissions in your browser."
        : "Failed to access microphone.";
    throw new Error(errorMsg);
  }

  // 2. Request Tab Audio if not mic-only (Channel 1: Client)
  let tabStream: MediaStream | null = null;
  if (!micOnly) {
    try {
      tabStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // required by getDisplayMedia spec to trigger browser picker
        audio: true,
      });

      const audioTracks = tabStream.getAudioTracks();
      if (audioTracks.length === 0) {
        // User forgot to check "Share tab audio"
        // Clean up video track
        tabStream.getTracks().forEach((t) => t.stop());
        micStream.getTracks().forEach((t) => t.stop());
        throw new Error(
          "TAB_AUDIO_MISSING: No audio track detected from the shared tab. When sharing the tab, make sure the 'Share tab audio' toggle is checked in the browser dialog."
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("TAB_AUDIO_MISSING")) {
        throw err;
      }
      micStream.getTracks().forEach((t) => t.stop());
      throw new Error(
        "Screen/Tab sharing was cancelled or not allowed. Use Mic-only mode if you only want to transcribe your microphone."
      );
    }
  }

  // 3. Web Audio Setup
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const audioContext = new AudioContextClass({ sampleRate });
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const micSource = audioContext.createMediaStreamSource(micStream);
  const mergerNode = audioContext.createChannelMerger(2);

  // Mic source goes to Channel 0 (Left / Team)
  micSource.connect(mergerNode, 0, 0);

  let tabSource: MediaStreamAudioSourceNode | null = null;
  if (tabStream && tabStream.getAudioTracks().length > 0) {
    tabSource = audioContext.createMediaStreamSource(tabStream);
    // Tab source goes to Channel 1 (Right / Client)
    tabSource.connect(mergerNode, 0, 1);
  }

  // Analysers for volume levels
  const micAnalyser = audioContext.createAnalyser();
  micAnalyser.fftSize = 256;
  micSource.connect(micAnalyser);

  let tabAnalyser: AnalyserNode | null = null;
  if (tabSource) {
    tabAnalyser = audioContext.createAnalyser();
    tabAnalyser.fftSize = 256;
    tabSource.connect(tabAnalyser);
  }

  let volumeInterval: ReturnType<typeof setInterval> | null = null;
  if (onVolumeUpdate) {
    const micData = new Uint8Array(micAnalyser.frequencyBinCount);
    const tabData = new Uint8Array(tabAnalyser ? tabAnalyser.frequencyBinCount : 0);

    volumeInterval = setInterval(() => {
      micAnalyser.getByteFrequencyData(micData);
      let micSum = 0;
      for (let i = 0; i < micData.length; i++) micSum += micData[i];
      const teamLevel = Math.min(100, Math.round((micSum / micData.length / 255) * 100));

      let clientLevel = 0;
      if (tabAnalyser) {
        tabAnalyser.getByteFrequencyData(tabData);
        let tabSum = 0;
        for (let i = 0; i < tabData.length; i++) tabSum += tabData[i];
        clientLevel = Math.min(100, Math.round((tabSum / tabData.length / 255) * 100));
      }

      onVolumeUpdate({ teamLevel, clientLevel });
    }, 100);
  }

  // 4. PCM Extractor: Attempt AudioWorklet with ScriptProcessor fallback
  let processorNode: ScriptProcessorNode | AudioNode | null = null;

  // ScriptProcessor fallback provides universal cross-browser reliability
  const bufferSize = 2048;
  const scriptNode = audioContext.createScriptProcessor(bufferSize, 2, 2);

  scriptNode.onaudioprocess = (e) => {
    if (!onAudioData) return;
    const inputBuffer = e.inputBuffer;
    const left = inputBuffer.getChannelData(0); // Team
    const right = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : left; // Client

    const interleavedLength = left.length * 2;
    const pcm16 = new Int16Array(interleavedLength);

    for (let i = 0; i < left.length; i++) {
      // Clamp and convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
      const sLeft = Math.max(-1, Math.min(1, left[i]));
      const sRight = Math.max(-1, Math.min(1, right[i]));

      pcm16[i * 2] = sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7fff;
      pcm16[i * 2 + 1] = sRight < 0 ? sRight * 0x8000 : sRight * 0x7fff;
    }

    onAudioData(pcm16);
  };

  mergerNode.connect(scriptNode);
  // ScriptProcessor requires a downstream connection to clock in Chrome
  scriptNode.connect(audioContext.destination);
  processorNode = scriptNode;

  const stop = () => {
    if (volumeInterval) {
      clearInterval(volumeInterval);
      volumeInterval = null;
    }
    if (processorNode) {
      try {
        processorNode.disconnect();
      } catch {}
    }
    try {
      mergerNode.disconnect();
      micSource.disconnect();
      tabSource?.disconnect();
    } catch {}

    micStream.getTracks().forEach((track) => track.stop());
    tabStream?.getTracks().forEach((track) => track.stop());

    if (audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  };

  return {
    micStream,
    tabStream,
    audioContext,
    mergerNode,
    stop,
    isMicOnly: micOnly,
  };
}
