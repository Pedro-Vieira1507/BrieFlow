import type { Session } from "@google/genai";
import { requestLiveAudioToken } from "@/lib/multimodal";

export interface LiveBriefingCallbacks {
  onInputTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onStatus: (status: "connecting" | "listening" | "closed" | "error") => void;
  onError: (error: Error) => void;
}

export interface LiveBriefingSession {
  stop: () => Promise<void>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary);
}

function floatTo16BitPcm(input: Float32Array, inputRate: number): Uint8Array {
  const ratio = inputRate / 16_000;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Uint8Array(outputLength * 2);
  const view = new DataView(output.buffer);
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return output;
}

class PcmPlayer {
  private context: AudioContext | null = null;
  private nextStart = 0;

  async play(base64: string): Promise<void> {
    this.context ??= new AudioContext({ sampleRate: 24_000 });
    if (this.context.state === "suspended") await this.context.resume();
    const binary = atob(base64);
    const samples = new Float32Array(Math.floor(binary.length / 2));
    for (let index = 0; index < samples.length; index += 1) {
      const low = binary.charCodeAt(index * 2);
      const high = binary.charCodeAt(index * 2 + 1);
      const signed = (high << 8) | low;
      samples[index] = (signed & 0x8000 ? signed - 0x10000 : signed) / 0x8000;
    }
    const buffer = this.context.createBuffer(1, samples.length, 24_000);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const startAt = Math.max(this.context.currentTime, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close().catch(() => undefined);
    this.context = null;
    this.nextStart = 0;
  }
}

export async function startLiveBriefing(
  callbacks: LiveBriefingCallbacks,
): Promise<LiveBriefingSession> {
  callbacks.onStatus("connecting");
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Este navegador não permite captura de microfone.");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const player = new PcmPlayer();
  let session: Session | null = null;
  let stopped = false;

  try {
    const credentials = await requestLiveAudioToken();
    const { GoogleGenAI, Modality } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: credentials.token,
      apiVersion: "v1beta",
    });
    session = await ai.live.connect({
      model: credentials.model,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: [
          "Você é o diretor de briefing do BrieFlow.",
          "Converse em português do Brasil, faça uma pergunta curta por vez e ajude a definir objetivo, público, oferta, tom e canais.",
          "Não gere a campanha durante a conversa; apenas consolide o briefing.",
        ].join(" "),
      },
      callbacks: {
        onopen: () => callbacks.onStatus("listening"),
        onmessage: (message) => {
          const input = message.serverContent?.inputTranscription?.text?.trim();
          const output =
            message.serverContent?.outputTranscription?.text?.trim();
          if (input) callbacks.onInputTranscript(input);
          if (output) callbacks.onAssistantTranscript(output);
          if (message.data) void player.play(message.data);
        },
        onerror: () => {
          callbacks.onStatus("error");
          callbacks.onError(new Error("A conversa por voz foi interrompida."));
        },
        onclose: () => {
          if (!stopped) callbacks.onStatus("closed");
        },
      },
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await player.close();
    throw error;
  }
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  processor.onaudioprocess = (event) => {
    if (!session || stopped) return;
    const pcm = floatTo16BitPcm(
      event.inputBuffer.getChannelData(0),
      audioContext.sampleRate,
    );
    session.sendRealtimeInput({
      audio: { data: bytesToBase64(pcm), mimeType: "audio/pcm;rate=16000" },
    });
  };
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      session?.sendRealtimeInput({ audioStreamEnd: true });
      processor.disconnect();
      source.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close().catch(() => undefined);
      session?.close();
      session = null;
      await player.close();
      callbacks.onStatus("closed");
    },
  };
}
