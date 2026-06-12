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
  const right = b.replace(/^\s+/, "").replace(/\s+$/, "");
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

  let baseline = "";
  let sessionFinal = "";
  let stopped = false;
  let rec: InstanceType<SpeechCtor> | null = null;

  const emit = (interim: string) => {
    const committed = baseline ? joinKo(baseline, sessionFinal) : sessionFinal;
    onUpdate({ committed, interim });
  };

  const startSession = () => {
    const r = new Ctor();
    r.lang = "ko-KR";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const seg = e.results[i];
        const text = seg[0].transcript;
        if (seg.isFinal) final = joinKo(final, text.trim());
        else interim = joinKo(interim, text.trim());
      }
      sessionFinal = final;
      emit(interim);
    };

    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      onError?.(e.error);
    };

    r.onend = () => {
      if (sessionFinal) {
        baseline = baseline ? joinKo(baseline, sessionFinal) : sessionFinal;
        sessionFinal = "";
      }
      if (stopped) return;
      try {
        startSession();
      } catch {
        stopped = true;
      }
    };

    try {
      r.start();
      rec = r;
    } catch (err) {
      onError?.(String(err));
      stopped = true;
    }
  };

  startSession();

  return {
    stop: () => {
      stopped = true;
      try {
        rec?.stop();
      } catch {
        // ignore
      }
    },
  };
}
