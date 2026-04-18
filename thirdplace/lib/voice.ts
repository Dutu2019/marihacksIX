// lib/voice.ts
export type VoiceLang = "en" | "fr";

export interface VoiceCallbacks {
  onTranscript: (text: string, final: boolean) => void;
  onAssistantText: (text: string) => void;
  onFunctionCall: (call: { name: string; args: any }) => Promise<any>;
  onError: (msg: string) => void;
  onStatusChange: (
    status: "idle" | "listening" | "thinking" | "speaking",
  ) => void;
}

const TOOLS = [
  {
    function_declarations: [
      {
        name: "reroute",
        description:
          "Find a new accessible route because the current path is blocked.",
        parameters: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
        },
      },
    ],
  },
];

export class VoiceAssistant {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private callbacks: VoiceCallbacks;
  private lang: VoiceLang;
  private apiKey: string;
  private nextStartTime = 0;

  constructor(apiKey: string, lang: VoiceLang, callbacks: VoiceCallbacks) {
    this.apiKey = apiKey;
    this.lang = lang;
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      if (this.audioContext.state === "suspended")
        await this.audioContext.resume();

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => this.sendSetup();
      this.ws.onmessage = async (e) =>
        this.handleMessage(JSON.parse(await e.data.text()));
      this.ws.onclose = () => this.callbacks.onStatusChange("idle");
      this.ws.onerror = () =>
        this.callbacks.onError("WebSocket Connection Error");
    } catch (err: any) {
      this.callbacks.onError(err.message);
    }
  }

  private sendSetup() {
    const setup = {
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        generation_config: {
          response_modalities: ["AUDIO", "TEXT"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: this.lang === "fr" ? "Charon" : "Aoede",
              },
            },
          },
        },
        tools: TOOLS,
      },
    };
    this.ws?.send(JSON.stringify(setup));
    setTimeout(() => this.startRecording(), 500);
  }

  public sendText(text: string) {
    // placeholder, does nothing
    return;
  }

  private workletAdded = false;

  private async startRecording() {
    if (!this.audioContext || !this.stream) return;
    this.callbacks.onStatusChange("listening");

    if (!this.workletAdded) {
      await this.audioContext.audioWorklet.addModule("/js/pcm-processor.js");
      this.workletAdded = true;
    }
    const source = this.audioContext.createMediaStreamSource(this.stream);
    const worklet = new AudioWorkletNode(this.audioContext, "pcm-processor");

    worklet.port.onmessage = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      const bytes = new Uint8Array(e.data);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64 }],
          },
        }),
      );
    };
    source.connect(worklet);
  }

  private async handleMessage(data: any) {
    // 1. Handle Audio & Text
    console.log(data);
    const parts = data.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData) {
        this.callbacks.onStatusChange("speaking");
        this.playAudio(part.inlineData.data);
      }
      if (part.text) this.callbacks.onAssistantText(part.text);

      if (part.functionCall) {
        this.callbacks.onStatusChange("thinking");
        const result = await this.callbacks.onFunctionCall(part.functionCall);
        // CRITICAL 2026 CHANGE: Use camelCase "toolResponse"
        this.ws?.send(
          JSON.stringify({
            toolResponse: {
              functionResponses: [
                {
                  id: part.functionCall.id,
                  name: part.functionCall.name,
                  response: { result },
                },
              ],
            },
          }),
        );
      }
    }

    // 2. Handle Transcription (Input)
    const transcript = data.serverContent?.inputAudioTranscription;
    if (transcript) {
      this.callbacks.onTranscript(transcript.text, transcript.isFinal);
    }

    // 3. Handle End of Turn
    if (data.serverContent?.turnComplete) {
      this.callbacks.onStatusChange("listening");
    }
  }

  private playAudio(base64: string) {
    if (!this.audioContext) return;
    const binary = atob(base64);
    const bytes = new Int16Array(
      new Uint8Array(binary.split("").map((c) => c.charCodeAt(0))).buffer,
    );
    const float32 = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) float32[i] = bytes[i] / 32768;

    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(
      this.audioContext.currentTime,
      this.nextStartTime,
    );
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  disconnect() {
    this.ws?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
  }
}
