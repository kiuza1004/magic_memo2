type SpeechRecognitionResult = {
  transcript: string;
  isFinal: boolean;
};

type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
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

export function startListening(
  onResult: (r: SpeechRecognitionResult) => void,
  onError?: (err: string) => void,
): SpeechHandle | null {
  const Ctor = getCtor();
  if (!Ctor) {
    onError?.("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.");
    return null;
  }
  const rec = new Ctor();
  rec.lang = "ko-KR";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    const transcript = last[0].transcript;
    onResult({ transcript, isFinal: last.isFinal });
  };
  rec.onerror = (e) => onError?.(e.error);
  rec.start();
  return { stop: () => rec.stop() };
}
