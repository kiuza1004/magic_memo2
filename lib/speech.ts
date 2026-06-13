type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export type SttState = "idle" | "listening";

export type SttOptions = {
  onPartial?: (text: string) => void;
  onResult?: (text: string) => void;
  onStateChange?: (state: SttState) => void;
  onFatal?: (msg: string) => void;
  lang?: string;
};

export class Stt {
  private listening = false;
  private userStopped = false;
  private recognizer: SpeechRecognitionLike | null = null;
  private lang: string;
  private onPartial?: (text: string) => void;
  private onResult?: (text: string) => void;
  private onStateChange?: (state: SttState) => void;
  private onFatal?: (msg: string) => void;

  constructor(opts: SttOptions) {
    this.onPartial = opts.onPartial;
    this.onResult = opts.onResult;
    this.onStateChange = opts.onStateChange;
    this.onFatal = opts.onFatal;
    this.lang = opts.lang ?? "ko-KR";
  }

  setLang(lang: string) {
    this.lang = lang;
  }

  start() {
    if (this.listening) return;
    const Ctor = getCtor();
    if (!Ctor) {
      this.onFatal?.("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.");
      return;
    }
    this.userStopped = false;
    this.listening = true;
    this.spawn();
  }

  stop() {
    this.userStopped = true;
    this.listening = false;
    this.destroy();
    this.onStateChange?.("idle");
  }

  isListening(): boolean {
    return this.listening;
  }

  private spawn() {
    this.destroy();
    const Ctor = getCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = this.lang;
    r.interimResults = true;
    r.continuous = false;
    r.onstart = () => this.onStateChange?.("listening");
    r.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (finalText.trim()) this.onResult?.(finalText.trim());
      else if (interim) this.onPartial?.(interim.trim());
    };
    r.onerror = (e) => {
      const code = e.error ?? "unknown";
      if (code === "not-allowed" || code === "service-not-allowed") {
        this.listening = false;
        this.userStopped = true;
        this.onFatal?.("마이크 권한이 거부되었습니다");
        this.onStateChange?.("idle");
      }
    };
    r.onend = () => {
      if (this.userStopped || !this.listening) {
        this.listening = false;
        this.onStateChange?.("idle");
        return;
      }
      this.spawn();
    };
    this.recognizer = r;
    try {
      r.start();
    } catch {
      // InvalidStateError on rapid restart — ignore, onend will respawn
    }
  }

  private destroy() {
    if (!this.recognizer) return;
    const r = this.recognizer;
    this.recognizer = null;
    try {
      r.onstart = null;
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
    } catch {
      // ignore
    }
    try {
      r.abort();
    } catch {
      // ignore
    }
  }
}
