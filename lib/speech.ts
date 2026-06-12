type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

function getCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export type SpeechHandle = {
  stop: () => void;
};

export type SpeechUpdate = {
  committed: string;
  interim: string;
};

function joinKo(a: string, b: string): string {
  const left = a.replace(/\s+$/, "");
  const right = b.replace(/^\s+/, "");
  if (!left) return right;
  if (!right) return left;
  return left + " " + right;
}

export function startListening(
  onUpdate: (u: SpeechUpdate) => void,
  onError?: (err: string) => void,
): SpeechHandle | null {
  const Ctor = getCtor();
  if (!Ctor) {
    onError?.("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.");
    return null;
  }

  let committed = "";
  let stopped = false;
  let rec = newRec();

  function newRec() {
    const r = new Ctor!();
    r.lang = "ko-KR";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i];
        const text = seg[0].transcript;
        if (seg.isFinal) {
          committed = joinKo(committed, text.trim());
        } else {
          interim = joinKo(interim, text);
        }
      }
      onUpdate({ committed, interim });
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      onError?.(e.error);
    };
    r.onend = () => {
      if (stopped) return;
      try {
        rec = newRec();
        rec.start();
      } catch {
        stopped = true;
      }
    };
    return r;
  }

  try {
    rec.start();
  } catch (err) {
    onError?.(String(err));
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    },
  };
}
