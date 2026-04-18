// lib/voice.ts
// Gemini 2.0 Flash Live Preview — voice assistant with function calling.
// Handles English and French. Supports rerouting, obstacle reporting,
// transit queries, and parking queries via function calls.

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

// Tool definitions sent to Gemini
const TOOLS = [
  {
    function_declarations: [
      {
        name: "reroute",
        description: "Find a new accessible route because the current path is blocked or inaccessible. Call this when the user says the path is blocked, inaccessible, or asks for another way.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Why the user needs a new route (e.g. 'stairs', 'construction', 'too crowded')" },
          },
          required: ["reason"],
        },
      },
      {
        name: "report_obstacle",
        description: "Report an accessibility obstacle at the current location.",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["stairs", "broken_elevator", "construction", "crowded", "rough_surface", "other"] },
            description: { type: "string" },
          },
          required: ["type"],
        },
      },
      {
        name: "get_next_step",
        description: "Get the next navigation instruction.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "get_eta",
        description: "Get the estimated time of arrival.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "find_transit",
        description: "Find the nearest accessible bus or metro stop.",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["bus", "metro", "any"], description: "Type of transit" },
          },
        },
      },
      {
        name: "find_parking",
        description: "Find the nearest accessible disabled parking spots.",
        parameters: { type: "object", properties: {} },
      },
    ],
  },
];

const SYSTEM_PROMPT_EN = `You are way·go, a friendly accessible navigation assistant. 
You help users with mobility challenges navigate safely. 
Speak naturally and concisely. You understand English and French — respond in the same language the user speaks.
When the user says a path is blocked or inaccessible, call the reroute function immediately.
When asked about transit, call find_transit. For parking, call find_parking.
Keep responses under 2 sentences when navigating. Be encouraging and calm.`;

const SYSTEM_PROMPT_FR = `Tu es way·go, un assistant de navigation accessible et sympathique.
Tu aides les utilisateurs avec des défis de mobilité à naviguer en toute sécurité.
Parle naturellement et brièvement. Tu comprends le français et l'anglais — réponds dans la langue de l'utilisateur.
Si le chemin est bloqué ou inaccessible, appelle immédiatement la fonction reroute.
Pour les transports, appelle find_transit. Pour le stationnement, appelle find_parking.
Garde les réponses courtes lors de la navigation. Sois encourageant et calme.`;

export class VoiceAssistant {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private callbacks: VoiceCallbacks;
  private lang: VoiceLang;
  private apiKey: string;
  private isConnected = false;
  private audioQueue: ArrayBuffer[] = [];
  private isPlayingAudio = false;

  constructor(apiKey: string, lang: VoiceLang, callbacks: VoiceCallbacks) {
    this.apiKey = apiKey;
    this.lang = lang;
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    if (!this.apiKey) {
      this.callbacks.onError("No Gemini API key provided. Add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local");
      return;
    }

    try {
      // Request microphone
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Connect to Gemini Live WebSocket
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        // Send setup message
        this.sendSetup();
      };

      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror   = () => this.callbacks.onError("WebSocket connection failed");
      this.ws.onclose   = () => { this.isConnected = false; this.callbacks.onStatusChange("idle"); };

    } catch (err: any) {
      this.callbacks.onError(err.message ?? "Microphone access denied");
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

    // Start recording after setup
    setTimeout(() => this.startRecording(), 500);
  }

  private startRecording() {
    if (!this.stream || !this.ws) return;
    this.callbacks.onStatusChange("listening");

    // Use ScriptProcessor to capture raw PCM at 16kHz
    const source = this.audioContext!.createMediaStreamSource(this.stream);
    const processor = this.audioContext!.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const float32 = e.inputBuffer.getChannelData(0);
      // Convert to 16-bit PCM
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      }
      const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
      this.ws!.send(JSON.stringify({
        realtime_input: {
          media_chunks: [{ mime_type: "audio/pcm;rate=16000", data: base64 }],
        },
      }));
    };

    source.connect(processor);
    processor.connect(this.audioContext!.destination);
  }

  private async handleMessage(event: MessageEvent) {
    try {
      const data = typeof event.data === "string"
        ? JSON.parse(event.data)
        : JSON.parse(await event.data.text());

      // Server content (audio + text + function calls)
      const serverContent = data?.serverContent?.modelTurn?.parts ?? [];

      for (const part of serverContent) {
        // Audio response — play it
        if (part.inlineData?.mimeType?.startsWith("audio/")) {
          this.callbacks.onStatusChange("speaking");
          const audioData = atob(part.inlineData.data);
          const bytes = new Uint8Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) bytes[i] = audioData.charCodeAt(i);
          this.audioQueue.push(bytes.buffer);
          this.playNextAudio();
        }

        // Text response
        if (part.text) {
          this.callbacks.onAssistantText(part.text);
        }

        // Function call
        if (part.functionCall) {
          this.callbacks.onStatusChange("thinking");
          const result = await this.callbacks.onFunctionCall({
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          });
          // Send function result back
          this.ws?.send(JSON.stringify({
            tool_response: {
              function_responses: [{
                id: part.functionCall.id,
                name: part.functionCall.name,
                response: { result: JSON.stringify(result) },
              }],
            },
          }));
        }
      }

      // Transcription
      const transcript = data?.serverContent?.inputTranscription;
      if (transcript?.text) {
        this.callbacks.onTranscript(transcript.text, transcript.isFinal ?? false);
      }

      // Turn complete
      if (data?.serverContent?.turnComplete) {
        this.callbacks.onStatusChange("listening");
      }
    } catch {
      // Ignore parse errors for binary frames
    }
  }

  private async playNextAudio() {
    if (this.isPlayingAudio || !this.audioQueue.length || !this.audioContext) return;
    this.isPlayingAudio = true;

    const buffer = this.audioQueue.shift()!;
    try {
      const decoded = await this.audioContext.decodeAudioData(buffer.slice(0));
      const source = this.audioContext.createBufferSource();
      source.buffer = decoded;
      source.connect(this.audioContext.destination);
      source.onended = () => {
        this.isPlayingAudio = false;
        this.playNextAudio();
      };
      source.start();
    } catch {
      this.isPlayingAudio = false;
      this.playNextAudio();
    }
  }

  // Send a text message to Gemini (for programmatic messages)
  sendText(text: string) {
    if (!this.ws || !this.isConnected) return;
    this.ws.send(JSON.stringify({
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: true,
      },
    }));
    this.callbacks.onStatusChange("thinking");
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
