import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { 
  Languages, 
  ArrowRightLeft, 
  Copy, 
  Trash2, 
  History, 
  Volume2, 
  Sparkles,
  Search,
  Check,
  ChevronDown,
  Globe,
  Star,
  Moon,
  Sun,
  X,
  Mic,
  MicOff,
  Share2,
  Info,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { translateText, LANGUAGES, generateSpeech, TranslationResult } from "@/lib/geminiService";

interface TranslationHistory extends TranslationResult {
  id: string;
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  isFavorite?: boolean;
}

export default function App() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [metadata, setMetadata] = useState<Partial<TranslationResult>>({});
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<TranslationHistory[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // PWA Install Logic
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSourceText(transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast.error("Голосовой ввод не поддерживается в этом браузере");
        return;
      }
      recognitionRef.current.lang = sourceLang === "auto" ? "ru-RU" : sourceLang;
      recognitionRef.current.start();
      setIsListening(true);
      toast.info("Слушаю...");
    }
  };

  // Load state from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("translation_history");
    const savedTheme = localStorage.getItem("theme");
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("translation_history", JSON.stringify(history));
  }, [history]);

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) {
      setTranslatedText("");
      setMetadata({});
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateText(sourceText, sourceLang, targetLang);
      setTranslatedText(result.text);
      setMetadata(result);
      
      const newHistoryItem: TranslationHistory = {
        id: Math.random().toString(36).substring(7),
        sourceText,
        sourceLang,
        targetLang,
        timestamp: Date.now(),
        ...result
      };
      
      setHistory(prev => {
        if (prev.length > 0 && prev[0].sourceText === sourceText && prev[0].targetLang === targetLang) return prev;
        return [newHistoryItem, ...prev.slice(0, 49)];
      });
    } catch (error) {
      toast.error("Ошибка перевода");
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sourceText.trim()) handleTranslate();
    }, 1200);
    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang, handleTranslate]);

  const speakText = async (text: string) => {
    if (!text) return;
    setIsSpeaking(true);
    try {
      const audioData = await generateSpeech(text);
      if (audioRef.current) {
        audioRef.current.src = audioData;
        audioRef.current.play();
      } else {
        const audio = new Audio(audioData);
        audioRef.current = audio;
        audio.play();
      }
      audioRef.current!.onended = () => setIsSpeaking(false);
    } catch (error) {
      toast.error("Не удалось воспроизвести звук");
      setIsSpeaking(false);
    }
  };

  const swapLanguages = () => {
    if (sourceLang === "auto") {
      setSourceLang(targetLang);
      setTargetLang("ru");
    } else {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }
    setSourceText(translatedText);
  };

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.native.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-20">
      <Toaster position="top-center" richColors />
      
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Lingo Pro</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-4">
              AI <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" /> GEMINI 3
            </div>
            {showInstallBtn && (
              <Button variant="outline" size="sm" onClick={handleInstall} className="rounded-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50">
                Скачать
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="rounded-full">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="translate" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1 h-12">
              <TabsTrigger value="translate" className="rounded-full px-8 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Перевод</TabsTrigger>
              <TabsTrigger value="history" className="rounded-full px-8 data-[state=active]:bg-blue-600 data-[state=active]:text-white">История</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="translate" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4">
              {/* Source */}
              <Card className="border-none shadow-xl dark:bg-slate-900 overflow-hidden flex flex-col">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                  <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="w-[180px] border-none focus:ring-0 font-semibold bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2"><input placeholder="Поиск языка..." className="w-full p-2 text-sm rounded bg-slate-100 dark:bg-slate-800" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                      {filteredLanguages.map(l => <SelectItem key={l.code} value={l.code}>{l.native} ({l.name})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={toggleListening} className={isListening ? "text-red-500 animate-pulse" : "text-slate-400"}>
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                </div>
                <Textarea 
                  placeholder="Введите текст или используйте голос..." 
                  className="flex-1 min-h-[250px] border-none focus-visible:ring-0 text-2xl p-6 resize-none bg-transparent"
                  value={sourceText}
                  onChange={e => setSourceText(e.target.value)}
                />
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${sourceText.length > 4500 ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <span className="text-xs font-bold text-slate-400">{sourceText.length} / 5000</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => speakText(sourceText)} disabled={!sourceText}><Volume2 className="w-4 h-4" /></Button>
                </div>
              </Card>

              {/* Swap */}
              <div className="flex lg:flex-col justify-center items-center py-2">
                <Button variant="outline" size="icon" onClick={swapLanguages} className="rounded-full w-12 h-12 shadow-md bg-white dark:bg-slate-900">
                  <ArrowRightLeft className="w-5 h-5 lg:rotate-0 rotate-90" />
                </Button>
              </div>

              {/* Target */}
              <Card className="border-none shadow-xl dark:bg-slate-900 overflow-hidden flex flex-col">
                <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="w-[180px] border-none focus:ring-0 font-semibold bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.filter(l => l.code !== "auto").map(l => <SelectItem key={l.code} value={l.code}>{l.native} ({l.name})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-h-[250px] p-6 text-2xl whitespace-pre-wrap">
                  {isTranslating ? (
                    <div className="space-y-4">
                      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
                    </div>
                  ) : (
                    translatedText || <span className="text-slate-300 dark:text-slate-700">Перевод появится здесь...</span>
                  )}
                </div>
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => speakText(translatedText)} disabled={!translatedText} className={isSpeaking ? "text-blue-500" : ""}><Volume2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" title="Поделиться" onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'Перевод Lingo Pro',
                        text: `${sourceText} -> ${translatedText}`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(translatedText);
                      toast.success("Скопировано (Поделиться не поддерживается)");
                    }
                  }} disabled={!translatedText}><Share2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" title="Копировать" onClick={() => { navigator.clipboard.writeText(translatedText); toast.success("Скопировано!"); }} disabled={!translatedText}><Copy className="w-4 h-4" /></Button>
                </div>
              </Card>
            </div>

            {/* Metadata & Insights */}
            <AnimatePresence>
              {translatedText && !isTranslating && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-none shadow-lg dark:bg-slate-900 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest"><MessageSquare className="w-4 h-4" /> Тон</div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{metadata.tone || "Обычный"}</p>
                  </Card>
                  <Card className="border-none shadow-lg dark:bg-slate-900 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest"><Lightbulb className="w-4 h-4" /> Анализ</div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{metadata.explanation || "Особых примечаний нет."}</p>
                  </Card>
                  <Card className="border-none shadow-lg dark:bg-slate-900 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest"><Info className="w-4 h-4" /> Примеры</div>
                    <div className="space-y-2">
                      {metadata.examples?.map((ex, i) => (
                        <div key={i} className="text-xs border-l-2 border-emerald-500 pl-2 py-1">
                          <div className="font-medium">{ex.original}</div>
                          <div className="text-slate-400">{ex.translated}</div>
                        </div>
                      )) || <p className="text-sm text-slate-400">Примеры недоступны.</p>}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-none shadow-xl dark:bg-slate-900 divide-y dark:divide-slate-800">
              {history.length === 0 ? (
                <div className="p-20 text-center text-slate-400">История пуста.</div>
              ) : (
                history.map(item => (
                  <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {LANGUAGES.find(l => l.code === item.sourceLang)?.native || "Авто"} → {LANGUAGES.find(l => l.code === item.targetLang)?.native}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setHistory(h => h.filter(i => i.id !== item.id))} className="h-8 w-8 text-slate-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-300 uppercase mb-1">Оригинал</p>
                        <p className="text-sm">{item.sourceText}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-300 uppercase mb-1">Перевод</p>
                        <p className="text-sm font-medium">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
