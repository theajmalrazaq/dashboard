let whisperTranscriber = null;
let whisperTranscriberPromise = null;

export const getWhisperTranscriber = async () => {
  if (typeof window === "undefined" || import.meta.env.SSR) {
    throw new Error("Whisper transcriber is only available in the browser.");
  }

  if (whisperTranscriber) {
    return whisperTranscriber;
  }

  if (!whisperTranscriberPromise) {
    whisperTranscriberPromise = import("@xenova/transformers")
      .then(({ pipeline }) =>
        pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
          quantized: true,
        })
      )
      .then((transcriber) => {
        whisperTranscriber = transcriber;
        return transcriber;
      })
      .catch((error) => {
        whisperTranscriberPromise = null;
        throw error;
      });
  }

  return whisperTranscriberPromise;
};
