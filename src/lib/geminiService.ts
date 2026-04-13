import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const LANGUAGES = [
  { code: "auto", name: "Auto-detect", native: "Автоопределение" },
  { code: "en", name: "English", native: "English" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
];

export interface TranslationResult {
  text: string;
  detectedLang?: string;
  tone?: string;
  examples?: { original: string; translated: string }[];
  explanation?: string;
}

export async function translateText(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
  if (!text.trim()) return { text: "" };

  const isAuto = sourceLang === "auto";
  const targetLangName = LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
  
  const prompt = `Translate the following text to ${targetLangName}. 
${isAuto ? "Detect the source language." : `Source language is ${sourceLang}.`}

Return ONLY a JSON object with the following structure:
{
  "translatedText": "string",
  "detectedLanguage": "string (only if source was auto)",
  "tone": "string (brief description of tone, e.g., formal, casual, poetic)",
  "examples": [
    {"original": "short example sentence in source language", "translated": "same sentence in target language"}
  ],
  "explanation": "string (brief grammatical or cultural note if relevant, otherwise empty)"
}

Text to translate:
${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      text: json.translatedText || "",
      detectedLang: json.detectedLanguage,
      tone: json.tone,
      examples: json.examples,
      explanation: json.explanation
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate text.");
  }
}

export async function generateSpeech(text: string, voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Kore') {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received");
    
    return `data:audio/wav;base64,${base64Audio}`;
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
}
