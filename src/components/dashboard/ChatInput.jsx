import { useState, useRef, useEffect } from "react";
import DashboardModal from "./DashboardModal";
import { getWhisperTranscriber } from "../../lib/whisper";

const SLASH_COMMANDS = [
  {
    name: "google",
    description: "Search",
    icon: "hgi-google",
    url: "https://google.com",
  },
  {
    name: "github",
    description: "GitHub",
    icon: "hgi-github-01",
    url: "https://github.com",
  },
  {
    name: "stackoverflow",
    description: "Stack Overflow",
    icon: "hgi-stack-overflow",
    url: "https://stackoverflow.com",
  },
  {
    name: "youtube",
    description: "YouTube",
    icon: "hgi-youtube",
    url: "https://youtube.com",
  },
  {
    name: "twitter",
    description: "Twitter/X",
    icon: "hgi-twitter-01",
    url: "https://twitter.com",
  },
  {
    name: "linkedin",
    description: "LinkedIn",
    icon: "hgi-linkedin-01",
    url: "https://linkedin.com",
  },
  {
    name: "reddit",
    description: "Reddit",
    icon: "hgi-reddit",
    url: "https://reddit.com",
  },
  {
    name: "netflix",
    description: "Netflix",
    icon: "hgi-netflix",
    url: "https://netflix.com",
  },
  {
    name: "chatgpt",
    description: "ChatGPT",
    icon: "hgi-openai",
    url: "https://chat.openai.com",
  },
  {
    name: "claude",
    description: "Claude",
    icon: "hgi-brain",
    url: "https://claude.ai",
  },
];

const AT_COMMANDS = [
  { name: "blog", description: "Personal Blog", icon: "hgi-note-01" },
  { name: "feed", description: "GitHub Feed", icon: "hgi-github" },
  { name: "chat", description: "AI Chatbot", icon: "hgi-ai-chat-02" },
  { name: "files", description: "File Explorer", icon: "hgi-folder-02" },
  { name: "clip", description: "Clipboard", icon: "hgi-copy-01" },
  {
    name: "terminal",
    description: "Terminal",
    icon: "hgi-computer-terminal-01",
  },
  {
    name: "system",
    description: "System Apps",
    icon: "hgi-dashboard-square-01",
  },
  { name: "notes", description: "Notes", icon: "hgi-note" },
  { name: "tasks", description: "Tasks", icon: "hgi-task-01" },
  { name: "links", description: "Link Vault", icon: "hgi-link-02" },
  { name: "voice", description: "Voice Assistant", icon: "hgi-mic-01" },
];

export default function ChatInput({
  input,
  setInput,
  onSend,
  loading,
  isActive,
  view,
  scripts,
  models,
  stats,
  onViewChange,
  onTabChange,
  onNewChat,
  onLoadPuter,
  onShortcutScopeChange,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [model, setModel] = useState("gpt-4o-mini");
  const [webSearch, setWebSearch] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showTabCommands, setShowTabCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [filteredTabCommands, setFilteredTabCommands] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedTabIndex, setSelectedTabIndex] = useState(-1);
  const [customCommands, setCustomCommands] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCommand, setNewCommand] = useState({ name: "", url: "" });
  const [commandType, setCommandType] = useState("slash");
  const [showDollarCommands, setShowDollarCommands] = useState(false);
  const [filteredDollarCommands, setFilteredDollarCommands] = useState([]);
  const [selectedDollarIndex, setSelectedDollarIndex] = useState(-1);
  const [isReminderActive, setIsReminderActive] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(null);
  const [executing, setExecuting] = useState(null);
  const [status, setStatus] = useState({ type: null, message: "" });
  const selectedButtonRef = useRef(null);
  const inputRef = useRef(null);
  const customInputRef = useRef(null);

  const [reminderSetupStep, setReminderSetupStep] = useState(null);
  const [focusedPillIndex, setFocusedPillIndex] = useState(0);
  const [customMinutes, setCustomMinutes] = useState("");
  const [isCustomActive, setIsCustomActive] = useState(false);
  const [reminderStartTime, setReminderStartTime] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isInitializingWhisper, setIsInitializingWhisper] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const isListeningRef = useRef(false);
  const whisperRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  const getMicrophoneStatusMessage = (err) => {
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
      console.error("Failed to initialize Whisper:", err);
      setStatus({ type: "error", message: "Voice input could not be initialized." });
      const nextError = new Error("WHISPER_INIT_FAILED");
      nextError.cause = err;
      throw nextError;
    } finally {
      setIsInitializingWhisper(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceInput = async () => {
    if (isListeningRef.current) {
      // Stop listening
      console.log("Stopping listening");
      isListeningRef.current = false;
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
    } else {
      // Start listening
      try {
        if (!window.isSecureContext) {
          setStatus({
            type: "error",
            message: "Microphone access requires HTTPS or localhost.",
          });
          return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus({
            type: "error",
            message: "This browser does not support microphone access.",
          });
          return;
        }

        if (typeof MediaRecorder === "undefined") {
          setStatus({
            type: "error",
            message: "This browser does not support in-browser audio recording.",
          });
          return;
        }

        await ensureWhisperReady();

        console.log("Starting listening");
        isListeningRef.current = true;
        setIsListening(true);
        setVoiceTranscript("");
        setInput("");
        audioChunksRef.current = [];

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Create media recorder
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

          if (!isListeningRef.current) {
            if (!audioChunksRef.current.length) {
              return;
            }

            // Process audio with Whisper
            const mimeType =
              mediaRecorder.mimeType ||
              audioChunksRef.current[0]?.type ||
              "audio/webm";
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);

            try {
              console.log("Processing audio with Whisper...");
              const result = await whisperRef.current(audioUrl);
              const transcript = result.text.trim();
              console.log("Whisper result:", transcript);

              if (transcript) {
                setVoiceTranscript(transcript);
                setInput(transcript);
                requestAnimationFrame(() => {
                  if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(transcript.length, transcript.length);
                  }
                });
              }
            } catch (err) {
              console.error("Whisper processing error:", err);
            } finally {
              URL.revokeObjectURL(audioUrl);
            }
          }
        };

        mediaRecorder.start();

        // Stop recording after 30 seconds of silence or max 2 minutes
        recordingTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current) {
            console.log("Max recording time reached");
            isListeningRef.current = false;
            setIsListening(false);
            mediaRecorder.stop();
          }
        }, 120000);
      } catch (err) {
        if (err?.name === "AbortError") {
          isListeningRef.current = false;
          setIsListening(false);
          return;
        }

        if (err?.message === "WHISPER_INIT_FAILED") {
          isListeningRef.current = false;
          setIsListening(false);
          return;
        }

        if (err?.name !== "AbortError") {
          console.error("Microphone error:", err);
        }

        setStatus({
          type: "error",
          message: getMicrophoneStatusMessage(err),
        });
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    if (isCustomActive) {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [isCustomActive]);

  useEffect(() => {
    if (reminderSetupStep !== "duration") return;

    const handleDurationKeyDown = (e) => {
      const PRESETS = [5, 10, 15, 30, 45, 60, "custom"];

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedPillIndex((prev) => (prev < PRESETS.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedPillIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (Date.now() - reminderStartTime < 200) return;

        const selected = PRESETS[focusedPillIndex];
        if (selected === "custom") {
          setIsCustomActive(true);
        } else {
          setReminderMinutes(selected);
          setReminderSetupStep("message");
          setIsCustomActive(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsReminderActive(false);
        setReminderSetupStep(null);
        setIsCustomActive(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setFocusedPillIndex(PRESETS.indexOf("custom"));
        setIsCustomActive(true);
        setCustomMinutes(e.key);
        setReminderMinutes(parseInt(e.key) || 5);
      }
    };

    window.addEventListener("keydown", handleDurationKeyDown);
    return () => window.removeEventListener("keydown", handleDurationKeyDown);
  }, [reminderSetupStep, focusedPillIndex, isCustomActive, reminderStartTime]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isActive || view === "history" || showAddModal || reminderSetupStep === "duration") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      if ((e.key.length === 1 && e.key !== " ") || e.key === "Backspace") {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isActive, view, showAddModal, reminderSetupStep]);

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, selectedTabIndex, selectedDollarIndex]);

  useEffect(() => {
    const isPopupNavigating =
      showCommands ||
      showTabCommands ||
      showDollarCommands ||
      showAddModal ||
      reminderSetupStep === "duration";

    onShortcutScopeChange?.(isPopupNavigating);
  }, [
    onShortcutScopeChange,
    reminderSetupStep,
    showAddModal,
    showCommands,
    showDollarCommands,
    showTabCommands,
  ]);

  useEffect(() => {
    return () => onShortcutScopeChange?.(false);
  }, [onShortcutScopeChange]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setSelectedIndex(-1);
    setSelectedTabIndex(-1);
    setSelectedDollarIndex(-1);

    // Check for /add command
    if (value.toLowerCase() === "/add") {
      setShowAddModal(true);
      setShowCommands(false);
      setShowTabCommands(false);
      setShowDollarCommands(false);
      return;
    }

    // Show @ commands when user types @
    if (value.startsWith("@")) {
      const query = value.substring(1).toLowerCase();
      const filtered = AT_COMMANDS.filter((cmd) => cmd.name.includes(query));
      setFilteredTabCommands(filtered);
      setShowTabCommands(filtered.length > 0 || query === "");
      setShowCommands(false);
      setShowDollarCommands(false);
      setCommandType("tab");
    }
    // Show dollar commands when user types $
    else if (value.startsWith("$")) {
      if (value.toLowerCase().startsWith("$reminder")) {
        setIsReminderActive(true);
        setReminderSetupStep("duration");
        setFocusedPillIndex(0);
        setReminderStartTime(Date.now());
        const rest = value.substring(9).trimStart();
        setInput(rest);
        setShowDollarCommands(false);
        setTimeout(() => inputRef.current?.blur(), 50);
        return;
      }
      const query = value.substring(1).toLowerCase();
      const dollarCmds = [
        {
          name: "reminder",
          icon: "hgi-clock-02",
          description: "Set a lightweight system reminder",
        },
      ];
      const filtered = dollarCmds.filter((cmd) => cmd.name.includes(query));
      setFilteredDollarCommands(filtered);
      setShowDollarCommands(filtered.length > 0 || query === "");
      setShowCommands(false);
      setShowTabCommands(false);
      setCommandType("dollar");
    }
    // Show slash commands when user types /
    else if (value.startsWith("/")) {
      const query = value.substring(1).toLowerCase();
      const allCommands = [...SLASH_COMMANDS, ...customCommands];
      const filtered = allCommands.filter((cmd) => cmd.name.includes(query));
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0 || query === "");
      setShowTabCommands(false);
      setShowDollarCommands(false);
      setCommandType("slash");
    } else {
      setShowCommands(false);
      setShowTabCommands(false);
      setShowDollarCommands(false);
    }
  };

  const executeCommand = (command, type = "slash") => {
    if (type === "tab") {
      // For @ commands - switch tabs
      onTabChange?.(command.name);
      setInput("");
      setShowTabCommands(false);
      setSelectedTabIndex(-1);
    } else if (type === "dollar") {
      if (command.name === "reminder") {
        setIsReminderActive(true);
        setReminderSetupStep("duration");
        setFocusedPillIndex(0);
        setReminderStartTime(Date.now());
        setInput("");
        setTimeout(() => inputRef.current?.blur(), 50);
      }
      setShowDollarCommands(false);
      setSelectedDollarIndex(-1);
    } else {
      // For / commands - open URL
      window.open(command.url, "_blank");
      setInput("");
      setShowCommands(false);
      setSelectedIndex(-1);
    }
  };

  const handleAddCommand = (e) => {
    e.preventDefault();
    if (!newCommand.name.trim() || !newCommand.url.trim()) return;

    const newCmd = {
      name: newCommand.name.toLowerCase().trim(),
      url: newCommand.url.trim(),
      description: newCommand.name,
      icon: "hgi-link-01",
    };

    setCustomCommands([...customCommands, newCmd]);
    setNewCommand({ name: "", url: "" });
    setShowAddModal(false);
    setInput("");
  };

  const handleRemoveCommand = (cmdName) => {
    setCustomCommands(customCommands.filter((cmd) => cmd.name !== cmdName));
  };

  const handleKeyDown = (e) => {
    // Revert to duration setup when backspacing empty input field
    if (isReminderActive && reminderSetupStep === "message" && input === "") {
      if (e.key === "Backspace") {
        e.preventDefault();
        setReminderSetupStep("duration");
        setFocusedPillIndex(0);
        setTimeout(() => inputRef.current?.blur(), 50);
        return;
      }
    }

    // Handle @ (tab) commands
    if (showTabCommands && filteredTabCommands.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedTabIndex((prev) =>
          prev < filteredTabCommands.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedTabIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = selectedTabIndex >= 0 ? selectedTabIndex : 0;
        executeCommand(filteredTabCommands[idx], "tab");
      }
      return;
    }

    // Handle $ (dollar) commands
    if (showDollarCommands && filteredDollarCommands.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedDollarIndex((prev) =>
          prev < filteredDollarCommands.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedDollarIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = selectedDollarIndex >= 0 ? selectedDollarIndex : 0;
        executeCommand(filteredDollarCommands[idx], "dollar");
      }
      return;
    }

    // Handle / (slash) commands
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = selectedIndex >= 0 ? selectedIndex : 0;
        executeCommand(filteredCommands[idx], "slash");
      }
      return;
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    if (isReminderActive) {
      const message = input.trim();
      setExecuting("set-reminder");
      setStatus({ type: "info", message: "setting reminder..." });
      try {
        const res = await fetch("/api/system", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "omarchy-reminder",
            action: "bin",
            args: [(reminderMinutes || 5).toString(), message],
          }),
        });
        const result = await res.json();
        if (result.success) {
          setStatus({ type: "success", message: "reminder set!" });
          setInput("");
          setIsReminderActive(false);
        } else {
          setStatus({ type: "error", message: `failed: ${result.error || "unknown"}` });
        }
      } catch {
        setStatus({ type: "error", message: "network error." });
      } finally {
        setExecuting(null);
        setTimeout(() => setStatus({ type: null, message: "" }), 4000);
      }
      return;
    }

    // Check if it's an @ command (tab)
    if (input.startsWith("@")) {
      const commandName = input.substring(1).toLowerCase().split(" ")[0];
      const tabCommand = AT_COMMANDS.find((cmd) => cmd.name === commandName);
      if (tabCommand) {
        executeCommand(tabCommand, "tab");
        return;
      }
    }

    // Check if it's a slash command
    if (input.startsWith("/")) {
      const commandName = input.substring(1).toLowerCase().split(" ")[0];

      // Check for /add command
      if (commandName === "add") {
        setShowAddModal(true);
        setInput("");
        return;
      }

      const allCommands = [...SLASH_COMMANDS, ...customCommands];
      const command = allCommands.find((cmd) => cmd.name === commandName);
      if (command) {
        executeCommand(command, "slash");
        return;
      }
    }

    const userMsg = { role: "user", content: input };
    setInput("");
    setShowMenu(false);

    // Pass to parent
    await onSend(userMsg, model, webSearch);
  };

  return (
    <>
      {/* Add Command Modal - Render at root level for proper popup */}
      <DashboardModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewCommand({ name: "", url: "" });
        }}
        title="Add Custom Link"
        subtitle="Create your own slash command"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddCommand} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 font-product-sans  st block mb-2">
              Name
            </label>
            <input
              type="text"
              value={newCommand.name}
              onChange={(e) =>
                setNewCommand({ ...newCommand, name: e.target.value })
              }
              placeholder="e.g., notion"
              className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-white/2 border border-gray-100 dark:border-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-600 dark:placeholder:text-neutral-700 font-product-sans text-sm rounded-3xl outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 font-product-sans  st block mb-2">
              URL
            </label>
            <input
              type="url"
              value={newCommand.url}
              onChange={(e) =>
                setNewCommand({ ...newCommand, url: e.target.value })
              }
              placeholder="https://example.com"
              className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-white/2 border border-gray-100 dark:border-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-600 dark:placeholder:text-neutral-700 font-product-sans text-sm rounded-3xl outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setNewCommand({ name: "", url: "" });
              }}
              className="flex-1 px-4 py-2 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-white/2 border border-gray-200 dark:border-neutral-800 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-neutral-700 transition-all duration-300  cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-xs font-product-sans font-bold text-white bg-accent border border-accent rounded-full hover:bg-accent/90 transition-all duration-300  cursor-pointer"
            >
              Add
            </button>
          </div>
        </form>

        {customCommands.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-900">
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 font-product-sans  st mb-3">
              Your Links
            </h3>
            <div className="flex flex-wrap gap-2">
              {customCommands.map((cmd) => (
                <div
                  key={cmd.name}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50/50 dark:bg-white/2 border border-gray-100 dark:border-neutral-900 rounded-full text-xs"
                >
                  <span className="text-gray-900 dark:text-gray-100 font-product-sans font-medium">
                    /{cmd.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCommand(cmd.name)}
                    className="p-1 text-gray-600 hover:text-red-500 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <i className="hgi-stroke hgi-close-square text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardModal>

      {isActive && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-100">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-3 bg-white/90 dark:bg-black/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-4xl p-1.5 px-4"
          >
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${showMenu ? "bg-accent text-white" : "text-gray-700 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10"}`}
              title="AI Settings"
            >
              <i
                className={`hgi-stroke ${showMenu ? "hgi-cancel-01" : "hgi-menu-01"} text-xl`}
              ></i>
            </button>

            <div className="flex-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onViewChange(view === "chat" ? "history" : "chat");
                }}
                className={`cursor-pointer w-8 h-8 flex items-center justify-center rounded-full transition-all ${view === "history" ? "bg-accent text-white" : "text-gray-700 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10"}`}
                title="Chat History"
              >
                <i className="hgi-stroke hgi-clock-01 text-lg"></i>
              </button>

              {isReminderActive && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/25 text-accent rounded-full text-[10px] font-bold font-product-sans animate-in zoom-in duration-300 select-none shrink-0">
                  <i className="hgi hgi-stroke hgi-clock-02 text-xs"></i>
                  {reminderSetupStep === "duration" ? "$reminder" : `$reminder ${reminderMinutes}`}
                  <button
                    type="button"
                    onClick={() => {
                      setIsReminderActive(false);
                      setReminderSetupStep(null);
                      setInput("");
                    }}
                    className="hover:text-accent-hover ml-1 p-0.5"
                    title="Cancel reminder"
                  >
                    <i className="hgi hgi-stroke hgi-cancel-01 text-[9px]"></i>
                  </button>
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                value={isListening ? voiceTranscript : input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowMenu(false)}
                disabled={view === "history"}
                readOnly={reminderSetupStep === "duration" || isListening}
                placeholder={
                  view === "history"
                    ? "Viewing history..."
                    : isReminderActive
                      ? "what should we remind you of? (e.g. get some eggs)"
                      : isListening
                        ? "Listening..."
                        : webSearch
                          ? "Search the universe..."
                          : "Ask Octo or type / for links, @ for tabs, $ for reminders..."
                }
                className="flex-1 bg-transparent border-none outline-none font-product-sans text-sm text-gray-900 dark:text-white placeholder:text-gray-700 dark:placeholder:text-gray-500 py-2 disabled:opacity-50"
              />
	              <button
	                type="button"
	                onClick={toggleVoiceInput}
	                disabled={isInitializingWhisper || view === "history"}
	                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 cursor-pointer ${isListening
	                  ? "bg-red-500 text-white animate-pulse"
	                  : "text-gray-700 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10"
	                  }`}
	                title={isListening ? "Stop listening" : isInitializingWhisper ? "Loading voice input" : "Start voice input"}
	              >
	                <i
	                  className={`hgi-stroke ${isInitializingWhisper ? "hgi-loading animate-spin" : isListening ? "hgi-mic-02" : "hgi-mic-01"
	                    } text-sm`}
	                ></i>
	              </button>
              <button
                type="submit"
                disabled={loading || (!input.trim() && !isListening) || view === "history"}
                className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center transition-all duration-500 disabled:opacity-20 shrink-0 cursor-pointer active:scale-95"
              >
                <i
                  className={`hgi-stroke ${loading ? "hgi-loading animate-spin" : "hgi-sent"} text-sm`}
                ></i>
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

            <button
              type="button"
              onClick={onNewChat}
              className="cursor-pointer w-9 h-9 flex items-center justify-center text-gray-700 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-300 rounded-full"
              title="New Chat"
            >
              <i className="hgi hgi-stroke hgi-plus-sign-square text-lg"></i>
            </button>
          </form>

          {/* Dollar Commands Line - Horizontal Scrolling */}
          {showDollarCommands && filteredDollarCommands.length > 0 && (
            <div
              className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide animate-in fade-in duration-200"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {filteredDollarCommands.map((cmd, index) => (
                <button
                  key={cmd.name}
                  ref={selectedDollarIndex === index ? selectedButtonRef : null}
                  onClick={() => executeCommand(cmd, "dollar")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${selectedDollarIndex === index
                    ? "bg-accent text-white animate-pulse"
                    : "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20"
                    }`}
                >
                  <i className={`hgi hgi-stroke ${cmd.icon} text-xs`}></i>$
                  {cmd.name}
                </button>
              ))}
            </div>
          )}

          {/* Tab Commands Line - Horizontal Scrolling */}
          {showTabCommands && filteredTabCommands.length > 0 && (
            <div
              className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {filteredTabCommands.map((cmd, index) => (
                <button
                  key={cmd.name}
                  ref={selectedTabIndex === index ? selectedButtonRef : null}
                  onClick={() => executeCommand(cmd, "tab")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${selectedTabIndex === index
                    ? "bg-accent text-white"
                    : "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20"
                    }`}
                >
                  <i className={`hgi hgi-stroke ${cmd.icon} text-xs`}></i>@
                  {cmd.name}
                </button>
              ))}
            </div>
          )}

          {/* Slash Commands Line - Horizontal Scrolling */}
          {showCommands && filteredCommands.length > 0 && (
            <div
              className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(true);
                  setInput("");
                  setShowCommands(false);
                }}
                className="px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap shrink-0 bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30"
                title="Add new link"
              >
                <i className="hgi-stroke hgi-plus-sign"></i> Add Link
              </button>
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.name}
                  ref={selectedIndex === index ? selectedButtonRef : null}
                  onClick={() => executeCommand(cmd)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap shrink-0 ${selectedIndex === index
                    ? "bg-accent text-white"
                    : "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20"
                    }`}
                >
                  /{cmd.name}
                </button>
              ))}
            </div>
          )}

          {isReminderActive && reminderSetupStep === "duration" && (
            <div className="mt-2 flex flex-col gap-3 p-4 bg-white/90 dark:bg-black/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-3xl animate-in slide-in-from-top-4 duration-300 transition-all">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-product-sans font-bold text-gray-600 dark:text-neutral-500  st px-1">
                  select duration
                </span>
                {status.message && (
                  <div
                    className={`px-2 py-0.5 rounded-full border text-[8px] font-product-sans font-bold flex items-center gap-1 animate-in fade-in duration-200 ${status.type === "success"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : status.type === "error"
                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                        : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${status.type === "success" ? "bg-emerald-500" : status.type === "error" ? "bg-red-500" : "bg-blue-500 animate-pulse"}`}
                    ></span>
                    {status.message}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[5, 10, 15, 30, 45, 60, "custom"].map((t, index) => {
                  const isFocused = reminderSetupStep === "duration" && focusedPillIndex === index;
                  const isSelected = reminderMinutes === t && t !== "custom";

                  if (t === "custom") {
                    return (
                      <button
                        key="custom"
                        type="button"
                        onClick={() => {
                          setFocusedPillIndex(index);
                          setIsCustomActive(true);
                        }}
                        className={`cursor-pointer px-3.5 py-1.5 rounded-full text-[10px] font-product-sans font-bold border transition-all flex items-center justify-center ${isFocused
                          ? "bg-accent/20 border-accent/40 text-accent ring-2 ring-accent/30 scale-105"
                          : isCustomActive
                            ? "bg-accent/15 border-accent/25 text-accent"
                            : "border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900/40"
                          }`}
                      >
                        {isCustomActive ? (
                          <input
                            ref={customInputRef}
                            type="number"
                            placeholder="min"
                            min="1"
                            max="1440"
                            value={customMinutes}
                            onChange={(e) => {
                              setCustomMinutes(e.target.value);
                              setReminderMinutes(parseInt(e.target.value) || 5);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                setReminderSetupStep("message");
                                setIsCustomActive(false);
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }
                            }}
                            className="bg-transparent border-none outline-none text-center w-8 text-[10px] font-bold text-accent"
                          />
                        ) : (
                          "custom"
                        )}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setFocusedPillIndex(index);
                        setReminderMinutes(t);
                        setReminderSetupStep("message");
                        setIsCustomActive(false);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className={`cursor-pointer px-3.5 py-1.5 rounded-full text-[10px] font-product-sans font-bold border transition-all ${isSelected
                        ? "bg-accent/15 text-accent border-accent/25"
                        : isFocused
                          ? "bg-accent/20 border-accent/40 text-accent ring-2 ring-accent/30 scale-105"
                          : "border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900/40"
                        }`}
                    >
                      {t}m
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showMenu && (
            <div className="mt-4 bg-white/90 dark:bg-black/90 border border-gray-100 dark:border-neutral-900 rounded-4xl p-6 animate-in slide-in-from-top-6 zoom-in-95 duration-500 backdrop-blur-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] font-bold text-gray-600 dark:text-neutral-500 font-product-sans flex items-center gap-2  st">
                    <i className="hgi-stroke hgi-brain text-xs"></i>
                    engine
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setModel(m.id);
                          setShowMenu(false);
                        }}
                        className={`cursor-pointer flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold font-product-sans transition-all duration-300 border ${model === m.id
                          ? "bg-accent/5 border-accent/20 text-accent"
                          : "bg-gray-50 dark:bg-white/3 border-transparent text-gray-700 hover:border-gray-200 dark:hover:border-neutral-800"
                          }`}
                      >
                        <i
                          className={`hgi-stroke ${m.icon} ${model === m.id ? "text-accent" : "text-gray-600"}`}
                        ></i>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold text-gray-600 dark:text-neutral-500 font-product-sans flex items-center gap-2  st">
                      <i className="hgi-stroke hgi-globe text-xs"></i>
                      capabilities
                    </h4>
                    <button
                      onClick={() => setWebSearch(!webSearch)}
                      className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${webSearch
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
                        : "bg-gray-50 dark:bg-white/3 border-transparent text-gray-700"
                        }`}
                    >
                      <span className="text-[11px] font-bold font-product-sans">
                        Web Search
                      </span>
                      <div
                        className={`w-8 h-4 rounded-full relative transition-colors ${webSearch ? "bg-emerald-500" : "bg-gray-300 dark:bg-neutral-800"}`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-all ${webSearch ? "translate-x-4" : "translate-x-0"}`}
                        ></div>
                      </div>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold text-gray-600 dark:text-neutral-500 font-product-sans flex items-center gap-2  st">
                      <i className="hgi-stroke hgi-analytics-up text-xs"></i>
                      resources
                    </h4>
                    <div className="flex items-center justify-between text-[10px] font-bold font-product-sans">
                      <span className="text-gray-600">Available</span>
                      {stats.loading ? (
                        <div className="h-4 w-20 skeleton"></div>
                      ) : (
                        <span className="text-gray-900 dark:text-white">
                          {(stats.remaining / 1000000).toFixed(2)}M
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-accent transition-all duration-700 ${stats.loading ? "skeleton" : ""}`}
                        style={{
                          width: stats.loading
                            ? "40%"
                            : `${Math.min((stats.used / stats.limit) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await window.puter?.auth?.signOut();
                          window.location.reload();
                        } catch (e) {
                          console.error("Failed to sign out from Puter", e);
                        }
                      }}
                      className="cursor-pointer mt-2 flex items-center justify-center gap-2 p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20 text-[10px] font-bold font-product-sans  st"
                    >
                      <i className="hgi-stroke hgi-logout-02 text-xs"></i>
                      Logout Puter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Universal Floating Toast/Notification (Shadcn UI style) */}
      {status.message && (
        <div className="fixed bottom-6 right-6 z-999 animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-90 p-4 rounded-xl border flex items-start gap-3 backdrop-blur-md bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-none lowercase">
                {status.type === "success" ? "success" : status.type === "error" ? "error" : "system"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed font-product-sans">
                {status.message}
              </p>
            </div>
            {status.type === "info" && (
              <div className="w-3.5 h-3.5 border-2 border-t-transparent border-accent rounded-full animate-spin shrink-0 mt-0.5"></div>
            )}
            <button
              onClick={() => setStatus({ type: null, message: "" })}
              className="text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors shrink-0 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
              title="Close toast"
            >
              <i className="hgi hgi-stroke hgi-cancel-01 text-[10px]"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
