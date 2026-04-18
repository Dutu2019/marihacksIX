// lib/voice.ts
export type VoiceLang = "en" | "fr";

export interface VoiceFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface VoiceCallbacks {
  onTranscript: (text: string, final: boolean) => void;
  onAssistantText: (text: string) => void;
  onFunctionCall: (call: VoiceFunctionCall) => Promise<any>;
  onError: (msg: string) => void;
  onStatusChange: (status: "idle" | "listening" | "thinking" | "speaking") => void;
}

const TOOLS = [
  {
    function_declarations: [
      {
        name: "reroute",
        description: "Find a new accessible route because the current path is blocked.",
        parameters: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
        },
      },
      {
        name: "report_obstacle",
        description: "Report an accessibility obstacle.",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["stairs", "broken_elevator", "construction", "crowded", "rough_surface", "other"] },
            description: { type: "string" },
          },
          required: ["type"],
        },
      },
      { name: "get_next_step", description: "Get navigation instruction.", parameters: { type: "object", properties: {} } },
      { name: "find_transit", description: "Find nearest accessible stop.", parameters: { type: "object", properties: { type: { type: "string" } } } },
      { name: "find_parking", description: "Find accessible parking.", parameters: { type: "object", properties: {} } },
    ],
  },
];

const SYSTEM_PROMPT_EN = `You are way·go, a friendly accessible navigation assistant. 
Speak naturally and concisely. Responses under 2 sentences. Use tools for navigation/transit.`;

const SYSTEM_PROMPT_FR = `Tu es way·go, un assistant de navigation accessible.
Parle naturellement et brièvement. Moins de 2 phrases. Utilise les outils pour la navigation.`;

export class VoiceAssistant {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private callbacks: VoiceCallbacks;
  private lang: VoiceLang;
  private apiKey: string;
  private isConnected = false;
  private nextStartTime = 0; // For gapless audio scheduling

  constructor(apiKey: string, lang: VoiceLang, callbacks: VoiceCallbacks) {
    this.apiKey = apiKey;
    this.lang = lang;
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    if (!this.apiKey) {
      this.callbacks.onError("No API key provided.");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Gemini Live prefers 24kHz for output, we use 16kHz for input
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendSetup();
      };

      this.ws.onmessage = async (event) => {
        const data = JSON.parse(await event.data.text());
        this.handleMessage(data);
      };

      this.ws.onerror = () => this.callbacks.onError("WebSocket connection failed");
      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onStatusChange("idle");
      };
    } catch (err: any) {
      this.callbacks.onError(err.message ?? "Mic access denied");
    }
  }

  private sendSetup() {
    if (!this.ws) return;
    const setup = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
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
        system_instruction: {
          parts: [{ text: this.lang === "fr" ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN }],
        },
        tools: TOOLS,
      },
    };
    this.ws.send(JSON.stringify(setup));
    setTimeout(() => this.startRecording(), 500);
  }

  private async startRecording() {
    if (!this.stream || !this.ws || !this.audioContext) return;
    this.callbacks.onStatusChange("listening");

    // Ensure pcm-processing-module.js is in your /public/js/ folder
    await this.audioContext.audioWorklet.addModule('/js/pcm-processing-module.js');

    const source = this.audioContext.createMediaStreamSource(this.stream);
    const pcmWorkerNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

    pcmWorkerNode.port.onmessage = (event) => {
      if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) return;
      const buffer = event.data;
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      this.ws!.send(JSON.stringify({
        realtimeInput: {
          media_chunks: [{ mime_type: "audio/pcm;rate=16000", data: base64 }],
        },
      }));
    };

    source.connect(pcmWorkerNode);
    // Do NOT connect to destination (prevents feedback)
  }

  private async handleMessage(data: any) {
    const serverContent = data?.serverContent?.modelTurn?.parts ?? [];

    for (const part of serverContent) {
      // HANDLE AUDIO
      if (part.inlineData?.data) {
        this.callbacks.onStatusChange("speaking");
        this.playPCM(part.inlineData.data);
      }

      // HANDLE TEXT
      if (part.text) {
        this.callbacks.onAssistantText(part.text);
      }

      // HANDLE FUNCTION CALLS
      if (part.functionCall) {
        this.callbacks.onStatusChange("thinking");
        const result = await this.callbacks.onFunctionCall({
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        });
        
        this.ws?.send(JSON.stringify({
          tool_response: {
            function_responses: [{
              id: part.functionCall.id,
              name: part.functionCall.name,
              response: { result },
            }],
          },
        }));
      }
    }

    if (data?.serverContent?.inputTranscription) {
      const trans = data.serverContent.inputTranscription;
      this.callbacks.onTranscript(trans.text, trans.isFinal ?? false);
    }

    if (data?.serverContent?.turnComplete) {
      this.callbacks.onStatusChange("listening");
    }

    if (data?.serverContent?.interrupted) {
      this.nextStartTime = 0; // Reset scheduling on interrupt
    }
  }

  private playPCM(base64Data: string) {
    if (!this.audioContext) return;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Gemini outputs 16-bit PCM, Little Endian, 24kHz
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  sendText(text: string) {
    if (!this.ws || !this.isConnected) return;
    this.ws.send(JSON.stringify({
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: true,
      },
    }));
  }

  disconnect() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws?.close();
    this.audioContext?.close();
    this.isConnected = false;
    this.callbacks.onStatusChange("idle");
  }

  setLang(lang: VoiceLang) {
    this.lang = lang;
  }
}