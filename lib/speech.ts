type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
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

const MAX_RECORDING_MS = 10 * 60 * 1000;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export type SpeechHandle = { stop: () => void };
export type SpeechUpdate = { committed: string; interim: string };

export function startListening(
  onUpdate: (u: SpeechUpdate) => void,
  onError?: (err: string) => void,
): SpeechHandle | null {
  const Ctor = getCtor();
  if (!Ctor) {
    onError?.("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.");
    return null;
  }

  let finalText = "";
  let stopped = false;
  let rec: SpeechRecognitionLike | null = null;
  const startedAt = Date.now();

  const launch = () => {
    const r = new Ctor();
    r.lang = "ko-KR";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = "";
      let finalAdd = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalAdd += t;
        else interim += t;
      }
      if (finalAdd) {
        const fa = finalAdd.trim();
        const norm = (s: string) => s.replace(/\s+/g, " ").trim();
        const prev = norm(finalText);
        const incoming = norm(fa);
        if (!prev) {
          finalText = incoming;
        } else if (incoming.startsWith(prev)) {
          finalText = incoming;
        } else if (prev.endsWith(incoming)) {
          // 이미 마지막에 포함된 중복 final — 무시
        } else {
          finalText = prev + " " + incoming;
        }
      }
      onUpdate({ committed: finalText, interim });
    };

    r.onerror = (ev) => {
      const code = ev.error ?? "unknown";
      if (code === "no-speech" || code === "aborted") return;
      onError?.(code);
    };

    r.onend = () => {
      const elapsed = Date.now() - startedAt;
      if (!stopped && elapsed < MAX_RECORDING_MS) {
        try {
          launch();
        } catch {
          stopped = true;
        }
      }
    };

    try {
      r.start();
      rec = r;
    } catch {
      window.setTimeout(() => {
        if (!stopped) {
          try {
            r.start();
            rec = r;
          } catch {
            stopped = true;
          }
        }
      }, 200);
    }
  };

  launch();

  return {
    stop: () => {
      stopped = true;
      try {
        rec?.abort();
      } catch {
        // ignore
      }
    },
  };
}
