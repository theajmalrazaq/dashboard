import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import DashboardModal from "./DashboardModal";

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
  { name: "voice", description: "Voice Assistant", icon: "hgi-mic-01" },
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
  const selectedButtonRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isActive || view === "history" || showAddModal) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      if (e.key.length === 1 || e.key === "Backspace") {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isActive, view, showAddModal]);

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, selectedTabIndex]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setSelectedIndex(-1);
    setSelectedTabIndex(-1);

    // Check for /add command
    if (value.toLowerCase() === "/add") {
      setShowAddModal(true);
      setShowCommands(false);
      setShowTabCommands(false);
      return;
    }

    // Show @ commands when user types @
    if (value.startsWith("@")) {
      const query = value.substring(1).toLowerCase();
      const filtered = AT_COMMANDS.filter((cmd) => cmd.name.includes(query));
      setFilteredTabCommands(filtered);
      setShowTabCommands(filtered.length > 0 || query === "");
      setShowCommands(false);
      setCommandType("tab");
    }
    // Show slash commands when user types /
    else if (value.startsWith("/")) {
      const query = value.substring(1).toLowerCase();
      const allCommands = [...SLASH_COMMANDS, ...customCommands];
      const filtered = allCommands.filter((cmd) => cmd.name.includes(query));
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0 || query === "");
      setShowTabCommands(false);
      setCommandType("slash");
    } else {
      setShowCommands(false);
      setShowTabCommands(false);
    }
  };

  const executeCommand = (command, type = "slash") => {
    if (type === "tab") {
      // For @ commands - switch tabs
      onTabChange?.(command.name);
      setInput("");
      setShowTabCommands(false);
      setSelectedTabIndex(-1);
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
        if (
          selectedTabIndex >= 0 &&
          selectedTabIndex < filteredTabCommands.length
        ) {
          executeCommand(filteredTabCommands[selectedTabIndex], "tab");
        }
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
        if (selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
          executeCommand(filteredCommands[selectedIndex], "slash");
        }
      }
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

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
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 font-product-sans uppercase tracking-widest block mb-2">
              Name
            </label>
            <input
              type="text"
              value={newCommand.name}
              onChange={(e) =>
                setNewCommand({ ...newCommand, name: e.target.value })
              }
              placeholder="e.g., notion"
              className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-700 font-product-sans text-sm rounded-3xl outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 font-product-sans uppercase tracking-widest block mb-2">
              URL
            </label>
            <input
              type="url"
              value={newCommand.url}
              onChange={(e) =>
                setNewCommand({ ...newCommand, url: e.target.value })
              }
              placeholder="https://example.com"
              className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-700 font-product-sans text-sm rounded-3xl outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setNewCommand({ name: "", url: "" });
              }}
              className="flex-1 px-4 py-2 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-neutral-800 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-neutral-700 transition-all duration-300 uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-xs font-product-sans font-bold text-white bg-accent border border-accent rounded-full hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 transition-all duration-300 uppercase cursor-pointer"
            >
              Add
            </button>
          </div>
        </form>

        {customCommands.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-900">
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 font-product-sans uppercase tracking-widest mb-3">
              Your Links
            </h3>
            <div className="flex flex-wrap gap-2">
              {customCommands.map((cmd) => (
                <div
                  key={cmd.name}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-neutral-900 rounded-full text-xs"
                >
                  <span className="text-gray-900 dark:text-gray-100 font-product-sans font-medium">
                    /{cmd.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCommand(cmd.name)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[100]">
          {showMenu && (
            <div className="mb-4 bg-white/90 dark:bg-black/90 border border-gray-100 dark:border-neutral-900 rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-6 zoom-in-95 duration-500 backdrop-blur-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 font-product-sans flex items-center gap-2 uppercase tracking-widest">
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
                        className={`cursor-pointer flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold font-product-sans transition-all duration-300 border ${
                          model === m.id
                            ? "bg-accent/[0.05] border-accent/20 text-accent"
                            : "bg-gray-50 dark:bg-white/[0.03] border-transparent text-gray-500 hover:border-gray-200 dark:hover:border-neutral-800"
                        }`}
                      >
                        <i
                          className={`hgi-stroke ${m.icon} ${model === m.id ? "text-accent" : "text-gray-400"}`}
                        ></i>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 font-product-sans flex items-center gap-2 uppercase tracking-widest">
                      <i className="hgi-stroke hgi-globe text-xs"></i>
                      capabilities
                    </h4>
                    <button
                      onClick={() => setWebSearch(!webSearch)}
                      className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                        webSearch
                          ? "bg-emerald-500/[0.05] border-emerald-500/20 text-emerald-500"
                          : "bg-gray-50 dark:bg-white/[0.03] border-transparent text-gray-500"
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
                    <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 font-product-sans flex items-center gap-2 uppercase tracking-widest">
                      <i className="hgi-stroke hgi-analytics-up text-xs"></i>
                      resources
                    </h4>
                    <div className="flex items-center justify-between text-[10px] font-bold font-product-sans">
                      <span className="text-gray-400">Available</span>
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
                      className="cursor-pointer mt-2 flex items-center justify-center gap-2 p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20 text-[10px] font-bold font-product-sans uppercase tracking-widest"
                    >
                      <i className="hgi-stroke hgi-logout-02 text-xs"></i>
                      Logout Puter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Commands Line - Horizontal Scrolling */}
          {showTabCommands && filteredTabCommands.length > 0 && (
            <div
              className="mb-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {filteredTabCommands.map((cmd, index) => (
                <button
                  key={cmd.name}
                  ref={selectedTabIndex === index ? selectedButtonRef : null}
                  onClick={() => executeCommand(cmd, "tab")}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
                    selectedTabIndex === index
                      ? "bg-accent text-white shadow-lg"
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
              className="mb-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setInput("");
                  setShowCommands(false);
                }}
                className="px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap flex-shrink-0 bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30"
                title="Add new link"
              >
                <i className="hgi-stroke hgi-plus-sign"></i> Add Link
              </button>
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.name}
                  ref={selectedIndex === index ? selectedButtonRef : null}
                  onClick={() => executeCommand(cmd)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    selectedIndex === index
                      ? "bg-accent text-white shadow-lg"
                      : "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20"
                  }`}
                >
                  /{cmd.name}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSend}
            className="flex items-center gap-3 bg-white/90 dark:bg-black/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-[32px] p-1.5 px-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${showMenu ? "bg-accent text-white" : "text-gray-500 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10"}`}
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
                className={`cursor-pointer w-8 h-8 flex items-center justify-center rounded-full transition-all ${view === "history" ? "bg-accent text-white" : "text-gray-500 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10"}`}
                title="Chat History"
              >
                <i className="hgi-stroke hgi-clock-01 text-lg"></i>
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowMenu(false)}
                disabled={view === "history"}
                placeholder={
                  view === "history"
                    ? "Viewing history..."
                    : webSearch
                      ? "Search the universe..."
                      : "Ask Octo or type / for links, @ for tabs..."
                }
                className="flex-1 bg-transparent border-none outline-none font-product-sans text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-500 py-2 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || view === "history"}
                className="w-8 h-8 bg-accent hover:shadow-lg hover:shadow-accent/20 text-white rounded-full flex items-center justify-center transition-all duration-500 disabled:opacity-20 flex-shrink-0 cursor-pointer active:scale-95"
              >
                <i
                  className={`hgi-stroke ${loading ? "hgi-loading animate-spin" : "hgi-sent"} text-sm`}
                ></i>
              </button>
            </div>

            <div className="w-[1px] h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

            <button
              type="button"
              onClick={onNewChat}
              className="cursor-pointer w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-300 rounded-full"
              title="New Chat"
            >
              <i className="hgi hgi-stroke hgi-plus-sign-square text-lg"></i>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
