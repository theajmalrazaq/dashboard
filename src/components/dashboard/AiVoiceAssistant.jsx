import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { loadPuter } from "../../lib/puter";
import { getWhisperTranscriber } from "../../lib/whisper";

export default function AiVoiceAssistant({ isActive }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [isInitializingWhisper, setIsInitializingWhisper] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [memory, setMemory] = useState({ crab: [], octo: [] });
  const [vaultData, setVaultData] = useState({ notes: [], todos: [] });
  const [customPrompts, setCustomPrompts] = useState({
    systemPrompt: "",
    potencyReminder: "",
    whatsappChat: "",
  });
  const isProcessing = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const whisperRef = useRef(null);

  const getMicrophoneErrorMessage = (err) => {
    if (err?.name === "NotAllowedError") {
      return "Microphone permission was denied.";
    }

    if (err?.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }

    if (err?.name === "NotReadableError") {
      return "The microphone is busy in another app.";
    }

    if (err?.name === "SecurityError") {
      return "Microphone access requires HTTPS or localhost.";
    }

    return "Microphone access failed.";
  };

  useEffect(() => {
    if (!isActive) return;

    loadPuter().catch((e) =>
      console.warn("Failed to load Puter.js in AiVoiceAssistant:", e),
    );
  }, [isActive]);

  const ensureWhisperReady = async () => {
    if (whisperRef.current) {
      return whisperRef.current;
    }

    setIsInitializingWhisper(true);
    try {
      const transcriber = await getWhisperTranscriber();
      whisperRef.current = transcriber;
      return transcriber;
    } catch (err) {
      console.error("Failed to initialize Whisper in AiVoiceAssistant:", err);
      setError("Whisper could not be initialized.");
      const nextError = new Error("WHISPER_INIT_FAILED");
      nextError.cause = err;
      throw nextError;
    } finally {
      setIsInitializingWhisper(false);
    }
  };

  useEffect(() => {
    if (!isActive || whisperRef.current) return;

    ensureWhisperReady().catch(() => {
      // Error state is handled in ensureWhisperReady.
    });
  }, [isActive]);

  // Fetch memory (facts about Crab and octo) from Supabase
  const fetchMemory = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("ai_memory")
        .select("category, content")
        .eq("user_id", user.id);

      if (error) throw error;

      const mem = { crab: [], octo: [] };
      let sysPrompt = "";
      let potReminder = "";
      let chatLog = "";

      data?.forEach((item) => {
        if (item.category === "crab") mem.crab.push(item.content);
        if (item.category === "octo") mem.octo.push(item.content);
        if (item.category === "system_prompt") sysPrompt = item.content;
        if (item.category === "potency_reminder") potReminder = item.content;
        if (item.category === "whatsapp_chat") chatLog = item.content;
      });
      setMemory(mem);
      setCustomPrompts({
        systemPrompt: sysPrompt,
        potencyReminder: potReminder,
        whatsappChat: chatLog,
      });
    } catch (err) {
      /* silent */
    }
  };

  // Fetch Notes and Todos for AI context
  const fetchVaultData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [notesRes, todosRes] = await Promise.all([
        supabase
          .from("notes")
          .select("title, content")
          .eq("user_id", user.id)
          .limit(10),
        supabase
          .from("todos")
          .select("text, completed")
          .eq("user_id", user.id)
          .limit(20),
      ]);

      setVaultData({
        notes: notesRes.data || [],
        todos: todosRes.data || [],
      });
    } catch (err) {
      /* silent */
    }
  };

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/system");
      const data = await res.json();
      if (Array.isArray(data)) {
        const filtered = data.filter((s) => {
          const n = s.name.replace("omarchy-", "");
          return (
            !n.startsWith("cmd-") &&
            !n.startsWith("refresh-") &&
            !n.startsWith("webapp-")
          );
        });
        setScripts(filtered);
      }
    } catch (err) {
      console.error("Failed to fetch scripts", err);
    }
  };

  useEffect(() => {
    if (!isActive) return;

    fetchScripts();
    fetchMemory();
    fetchVaultData();
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakResponse = (text) => {
    if (!text || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = async () => {
    if (isListening) {
      setIsListening(false);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    setTranscript("");
    setAiResponse("");
    setError(null);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    audioChunksRef.current = [];

    try {
      if (!window.isSecureContext) {
        setError("Microphone access requires HTTPS or localhost.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support microphone access.");
        return;
      }

      if (typeof MediaRecorder === "undefined") {
        setError("This browser does not support in-browser audio recording.");
        return;
      }

      await ensureWhisperReady();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        },
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (!audioChunksRef.current.length) {
          return;
        }

        const mimeType =
          mediaRecorder.mimeType ||
          audioChunksRef.current[0]?.type ||
          "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        try {
          const result = await whisperRef.current(audioUrl);
          const nextTranscript = result.text.trim();
          setTranscript(nextTranscript);

          if (nextTranscript) {
            await processCommand(nextTranscript);
          }
        } catch (err) {
          console.error("Whisper processing error in AiVoiceAssistant:", err);
          setError("Could not transcribe that recording.");
        } finally {
          URL.revokeObjectURL(audioUrl);
          audioChunksRef.current = [];
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          setIsListening(false);
          mediaRecorder.stop();
        }
      }, 120000);
    } catch (err) {
      if (err?.name === "AbortError") {
        setIsListening(false);
        return;
      }

      if (err?.message === "WHISPER_INIT_FAILED") {
        setIsListening(false);
        return;
      }

      if (err?.name !== "AbortError") {
        console.error("Voice assistant microphone error:", err);
      }

      setError(getMicrophoneErrorMessage(err));
      setIsListening(false);
    }
  };

  const processCommand = async (text) => {
    if (!text || isProcessing.current) return;
    isProcessing.current = true;
    setLoading(true);
    setAiResponse("");
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const scriptList = scripts
        .map((s) => s.name.replace("omarchy-", ""))
        .join(", ");
      const sysPrompt = `${customPrompts.systemPrompt}

            AUTHENTIC HISTORICAL CHAT LOGS FOR REFERENCE:
            ${customPrompts.whatsappChat || "No historical logs imported yet."}

            MEMORY (Things you remember):
            Things about Crab: ${memory.crab.join(", ") || "Nothing yet."}
            Things you've told Crab about yourself: ${memory.octo.join(", ") || "Nothing yet."}

            VAULT CONTEXT (Active data in Crab's dashboard):
            Notes: ${vaultData.notes.map((n) => n.title).join(", ") || "No notes."}
            Pending Tasks: ${vaultData.todos
          .filter((t) => !t.completed)
          .map((t) => t.text)
          .join(", ") || "No pending tasks."
        }

            Actions:
            - Create Note: [[CREATE_NOTE: Title | Content]]
            - Create Task: [[CREATE_TODO: Task Text]]
            - Open Website: [[OPEN_URL: https://...]]
            - Run Command: [[EXEC_CMD: name]]
            Commands list: ${scriptList}
            
            You HAVE the ability to execute commands and open websites. Never say you don't have the option.
            Keep replies very short (1-2 sentences). Use "..." and "haha" or "lol". 
            NEVER use emojis or hashtags.
            Put tags at the very END.`;

      const latestUserMsg = {
        role: "user",
        content: `${customPrompts.potencyReminder}\n\nUser Message: ${text}`,
      };

      const puterMessages = [
        { role: "user", content: `SYSTEM INSTRUCTIONS:\n${sysPrompt}` },
        ...messages.slice(-6).map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        })),
        latestUserMsg,
      ];

      const response = await window.puter.ai.chat(puterMessages, {
        stream: true,
        model: "gpt-4o-mini",
      });
      let fullContent = "";
      let processedActions = new Set();

      for await (const part of response) {
        if (part?.text) {
          fullContent += part.text;
          const cleanResponse = fullContent.replace(/\[\[.*?\]\]/gs, "").trim();
          setAiResponse(cleanResponse);

          // Instant URL opening
          const urlMatch = fullContent.match(/\[\[OPEN_URL:\s*(.*?)\s*\]\]/);
          if (urlMatch && !processedActions.has("open_url")) {
            const url = urlMatch[1].trim();
            window.open(
              url.startsWith("http") ? url : `https://${url}`,
              "_blank",
            );
            processedActions.add("open_url");
          }

          // Instant Command execution
          const cmdMatch = fullContent.match(/\[\[EXEC_CMD:\s*(.*?)\s*\]\]/);
          if (cmdMatch && !processedActions.has("exec_cmd")) {
            const fullStr = cmdMatch[1].trim();
            const parts = fullStr.split(/\s+/);
            const cmdName = parts[0];
            const cmdArgs = parts.slice(1);

            const fullName =
              scripts.find((s) => s.name.includes(cmdName))?.name ||
              `omarchy-${cmdName}`;
            fetch("/api/system", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "bin",
                command: fullName,
                args: cmdArgs,
              }),
            });
            processedActions.add("exec_cmd");
          }
        }
      }

      // Persistence actions at the end
      const noteMatch = fullContent.match(
        /\[\[CREATE_NOTE:\s*(.*?)\s*\|\s*(.*?)\s*\]\]/s,
      );
      if (noteMatch) {
        await supabase.from("notes").insert({
          user_id: user.id,
          title: noteMatch[1].trim(),
          content: noteMatch[2].trim(),
          tags: ["voice-generated"],
        });
      }
      const todoMatch = fullContent.match(/\[\[CREATE_TODO:\s*(.*?)\s*\]\]/);
      if (todoMatch) {
        await supabase.from("todos").insert({
          user_id: user.id,
          text: todoMatch[1].trim(),
          completed: false,
          items: [],
        });
      }

      // Save conversation history
      const cleanFinal = fullContent.replace(/\[\[.*?\]\]/gs, "").trim();
      setMessages((prev) => [
        ...prev.slice(-10),
        { role: "user", content: text },
        { role: "assistant", content: cleanFinal },
      ]);
      speakResponse(cleanFinal);
    } catch (err) {
      console.error("Voice processing error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      isProcessing.current = false;
    }
  };

  const handleCancel = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (isListening && mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsListening(false);
    setTranscript("");
    setAiResponse("");
    setError(null);
    setLoading(false);
    isProcessing.current = false;
  };

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex flex-col items-center gap-6">
        <div className="relative group">
          {isListening && (
            <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping scale-150 opacity-30"></div>
          )}
          {isListening && (
            <div className="absolute inset-0 bg-accent/10 rounded-full animate-ping [animation-delay:0.5s] scale-[2] opacity-20"></div>
          )}

          <button
            onClick={toggleListening}
            disabled={loading || isInitializingWhisper}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${isListening
              ? "bg-accent text-white scale-110"
              : "bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-500 hover:text-accent hover:border-accent/30 border border-gray-100 dark:border-neutral-800"
              }`}
          >
            <i
              className={`hgi hgi-stroke ${isListening ? "hgi-mic-01 animate-pulse" : "hgi-mic-01"} text-5xl`}
            ></i>
          </button>
        </div>

        {(isListening || transcript || aiResponse || error || loading) && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-neutral-950 text-[10px] font-product-sans font-bold text-gray-600 dark:text-neutral-600 hover:text-red-500 hover:bg-red-500/10 border border-gray-200 dark:border-neutral-800 transition-all duration-300 animate-in fade-in slide-in-from-top-2 cursor-pointer  st"
          >
            <i className="hgi hgi-stroke hgi-cancel-01 text-xs"></i>
            cancel
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 text-center max-w-lg px-4">
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-bold text-gray-600 dark:text-neutral-500 font-product-sans  ">
            {isListening ? (
              <span className="flex items-center gap-2 animate-pulse text-accent">
                <i className="hgi-stroke hgi-cleaning-01 text-xs"></i>
                listening...
              </span>
            ) : isInitializingWhisper ? (
              <span className="flex items-center gap-2 text-blue-500">
                <i className="hgi-stroke hgi-ai-network text-xs animate-spin-slow"></i>
                loading whisper...
              </span>
            ) : loading ? (
              <span className="flex items-center gap-2 text-emerald-500">
                <i className="hgi-stroke hgi-ai-network text-xs animate-spin-slow"></i>
                thinking...
              </span>
            ) : (
              "octo "
            )}
          </h3>
        </div>

        {transcript && (
          <p className="text-sm text-gray-700 dark:text-neutral-400 italic font-product-sans leading-relaxed">
            "{transcript}"
          </p>
        )}

        {aiResponse && (
          <div className="mt-4 p-6 bg-accent/5 rounded-3xl border border-accent/10 animate-in slide-in-from-bottom-4 duration-500">
            <p className="text-base text-accent font-product-sans font-bold">
              {aiResponse}
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 font-bold  st mt-2">
            {error}
          </p>
        )}

        {!isListening && !loading && !transcript && !error && (
          <p className="text-[10px] font-product-sans font-bold text-gray-600 dark:text-neutral-600">
            {isInitializingWhisper
              ? "warming up whisper..."
              : "Click the mic, speak, then tap again to send"}
          </p>
        )}
      </div>
    </div>
  );
}
