// app/utils/elevenLabs.ts

const ELEVEN_LABS_API_KEY = process.env.NEXT_PUBLIC_ELEVEN_LABS_KEY;
const TTS_VOICE_ID = "Gfpl8Yo74Is0W6cPUWWT"; 

let isMuted = false;

export const setMuteSpeech = (val: boolean) => {
  isMuted = val;
  if (val) window.speechSynthesis.cancel(); // Stop any current audio
};


// 1. Text-to-Speech (Speaking)
export const speak = async (text: string) => {
  if (isMuted) return;
  if (!ELEVEN_LABS_API_KEY) return;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_LABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  } catch (error) {
    console.error("TTS Error:", error);
  }
};

// 2. Speech-to-Text (Listening) - NEW!
export const transcribe = async (audioBlob: Blob): Promise<string | null> => {
  if (!ELEVEN_LABS_API_KEY) {
    console.error("Missing API Key");
    return null;
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model_id", "scribe_v2"); // The new Scribe model
  // Optional: Add 'language_code' if you want to force English, otherwise it detects auto.

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_LABS_API_KEY, // Note: No Content-Type header! Fetch adds it automatically for FormData
      },
      body: formData,
    });

    if (!response.ok) {
        const err = await response.json();
        console.error("Scribe API Error:", err);
        return null;
    }

    const data = await response.json();
    return data.text; // ElevenLabs returns { text: "..." }
  } catch (error) {
    console.error("Transcription Error:", error);
    return null;
  }
};