import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import PersonalVault from "./PersonalVault";
import SpotifyWidget from "./SpotifyWidget";
import GithubFeed from "./GithubFeed";
import { loadPuter } from "../../lib/puter";
import AiChatbot from "./AiChatbot";
import FileExplorer from "./FileExplorer";
import SystemApps from "./SystemApps";
import Terminal from "./Terminal";
import ClipboardManager from "./ClipboardManager";
import AiVoiceAssistant from "./AiVoiceAssistant";
import ChatInput from "./ChatInput";
import LinkVault from "./LinkVault";
import { FlickeringGrid } from "../ui/FlickeringGrid";

// 7-Segment Clock Constants
const H = { h: 0, m: 180 },
  V = { h: 270, m: 90 },
  TL = { h: 180, m: 270 },
  TR = { h: 0, m: 270 },
  BL = { h: 180, m: 90 },
  BR = { h: 0, m: 90 },
  E = { h: 135, m: 135 };

const digits = [
  [
    BR,
    H,
    H,
    BL,
    V,
    BR,
    BL,
    V,
    V,
    V,
    V,
    V,
    V,
    V,
    V,
    V,
    V,
    TR,
    TL,
    V,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    H,
    BL,
    E,
    TR,
    BL,
    V,
    E,
    E,
    V,
    V,
    E,
    E,
    V,
    V,
    E,
    BR,
    TL,
    TR,
    BL,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    TR,
    H,
    BL,
    V,
    BR,
    H,
    TL,
    V,
    V,
    BR,
    H,
    TL,
    V,
    TR,
    H,
    BL,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    TR,
    H,
    BL,
    V,
    E,
    BR,
    TL,
    V,
    E,
    TR,
    BL,
    V,
    BR,
    H,
    TL,
    V,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    BL,
    BR,
    BL,
    V,
    V,
    V,
    V,
    V,
    TR,
    TL,
    V,
    TR,
    H,
    BL,
    V,
    E,
    E,
    V,
    V,
    E,
    E,
    TR,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    V,
    BR,
    H,
    TL,
    V,
    TR,
    H,
    BL,
    TR,
    H,
    BL,
    V,
    BR,
    H,
    TL,
    V,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    V,
    BR,
    H,
    TL,
    V,
    TR,
    H,
    BL,
    V,
    BR,
    BL,
    V,
    V,
    TR,
    TL,
    V,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    TR,
    H,
    BL,
    V,
    E,
    E,
    V,
    V,
    E,
    E,
    V,
    V,
    E,
    E,
    V,
    V,
    E,
    E,
    TR,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    V,
    BR,
    BL,
    V,
    V,
    TR,
    TL,
    V,
    V,
    BR,
    BL,
    V,
    V,
    TR,
    TL,
    V,
    TR,
    H,
    H,
    TL,
  ],
  [
    BR,
    H,
    H,
    BL,
    V,
    BR,
    BL,
    V,
    V,
    TR,
    TL,
    V,
    TR,
    H,
    BL,
    V,
    BR,
    H,
    TL,
    V,
    TR,
    H,
    H,
    TL,
  ],
];

const normalizeAngle = (next, prev) => {
  const delta = (((next - prev) % 360) + 360) % 360;
  return prev + delta;
};

const getTimeDigits = () => {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()].flatMap((val) =>
    String(val).padStart(2, "0").split("").map(Number),
  );
};

const randomAngle = () => Math.floor(Math.random() * 360);

const Clock = ({ h, m, initial }) => {
  const prev = useRef({ h: 0, m: 0 });
  const hourAngle = normalizeAngle(h, prev.current.h);
  const minuteAngle = normalizeAngle(m, prev.current.m);
  prev.current = { h: hourAngle, m: minuteAngle };

  return (
    <div
      className="clock"
      style={{
        "--hour-angle": initial ? randomAngle() : hourAngle,
        "--minute-angle": initial ? randomAngle() : minuteAngle,
        "--dur": initial ? 1 : 0.4,
      }}
    />
  );
};

const SegmentClockDisplay = () => {
  const [time, setTime] = useState(Array(6).fill(0));
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    let updateTimerId;
    const updateTime = () => {
      setTime(getTimeDigits());
      const now = Date.now();
      const delay = 1000 - (now % 1000);
      updateTimerId = setTimeout(updateTime, delay);
    };

    const initialTimerId = setTimeout(() => {
      setInitial(false);
      updateTime();
    }, 600);

    return () => {
      clearTimeout(updateTimerId);
      clearTimeout(initialTimerId);
    };
  }, []);

  return (
    <>
      <style>{`
        .app {
          --clock-size: 1.2vw;
          --gap: calc(var(--clock-size) * 0.05);
          --clock-segment-w: calc(var(--clock-size) * 4 + var(--gap) * 5);
          --clock-segment-h: calc(var(--clock-size) * 6 + var(--gap) * 5);
          display: flex;
          gap: var(--gap);
          align-items: center;
          justify-content: center;
          width: 100%;
        }

        .app > div {
          display: flex;
          flex-wrap: wrap;
          gap: var(--gap);
          width: var(--clock-segment-w);
          height: var(--clock-segment-h);
        }

        .app > div:nth-of-type(even) {
          margin-right: var(--clock-size);
        }

        .clock {
          position: relative;
          width: var(--clock-size);
          height: var(--clock-size);
          border: 1px solid rgba(160, 152, 255, 0.2);
          border-radius: 50%;
        }

        

        .clock::before,
        .clock::after {
          position: absolute;
          content: '';
          top: 50%;
          left: 50%;
          transform-origin: 0% 50%;
          width: 47%;
          height: 1px;
          background: currentColor;
          transition: 0.4s ease-in-out;
          transform: rotate(calc(var(--angle) * 1deg));
        }

        .clock::before {
          --angle: var(--hour-angle);
        }

        .clock::after {
          --angle: var(--minute-angle);
        }
      `}</style>
      <div className="app text-gray-900 dark:text-white">
        {time.map((t, i) => (
          <div key={i}>
            {digits[t].map(({ h, m }, j) => (
              <Clock key={j} h={h} m={m} initial={initial} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

export default function DashboardHome() {
  const [posts, setPosts] = useState([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null); // null | "blog" | "feed" | "chat" | "notes" | "todo"
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isScrolled, setIsScrolled] = useState(false);
  const [input, setInput] = useState("");
  const [scripts, setScripts] = useState([]);
  const [stats, setStats] = useState({
    used: 0,
    limit: 50000000,
    remaining: 50000000,
    loading: true,
  });
  const [pendingChatAction, setPendingChatAction] = useState(null); // { type: "message" | "history" | "new-chat", data: {...} }
  const [pendingMessage, setPendingMessage] = useState(null); // { content, model, webSearch }
  const [systemData, setSystemData] = useState({
    toggles: {},
    clipboard: { history: [], current: "" },
    spotify: { active: false },
    battery: { percentage: 0, status: "unknown", remainingTime: "", capacity: 0, powerRate: 0, hasBattery: false },
    theme: { current: "", available: [] },
    powerProfile: { active: "", available: [] },
    reminders: [],
  });

  const [executing, setExecuting] = useState(null);
  const [status, setStatus] = useState({ type: null, message: "" });

  // Single persistent Server-Sent Events (SSE) stream connection
  useEffect(() => {
    if (!ready) return;

    const eventSource = new EventSource("/api/system?action=stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data) {
          setSystemData((prev) => {
            const togglesChanged =
              JSON.stringify(prev.toggles) !== JSON.stringify(data.toggles);
            const clipboardChanged =
              JSON.stringify(prev.clipboard) !== JSON.stringify(data.clipboard);
            const spotifyChanged =
              JSON.stringify(prev.spotify) !== JSON.stringify(data.spotify);
            const batteryChanged =
              JSON.stringify(prev.battery) !== JSON.stringify(data.battery);
            const themeChanged =
              JSON.stringify(prev.theme) !== JSON.stringify(data.theme);
            const powerProfileChanged =
              JSON.stringify(prev.powerProfile) !== JSON.stringify(data.powerProfile);
            const remindersChanged =
              JSON.stringify(prev.reminders) !== JSON.stringify(data.reminders);

            if (togglesChanged || clipboardChanged || spotifyChanged || batteryChanged || themeChanged || powerProfileChanged || remindersChanged) {
              return {
                toggles: data.toggles || {},
                clipboard: data.clipboard || { history: [], current: "" },
                spotify: data.spotify || { active: false },
                battery: data.battery || { percentage: 0, status: "unknown", remainingTime: "", capacity: 0, powerRate: 0, hasBattery: false },
                theme: data.theme || { current: "", available: [] },
                powerProfile: data.powerProfile || { active: "", available: [] },
                reminders: data.reminders || [],
              };
            }
            return prev;
          });
        }
      } catch (e) {
        console.error("Failed to parse SSE message data", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [ready]);

  // Handle scroll for sticky header states
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle Spacebar & Arrow keys to control Spotify on Home View
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only trigger if we are on the home view (no active tab)
      if (activeTab) return;

      // Check if user is typing in an input/textarea/editable element
      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      // Check if the key is space
      if (e.key === " " || e.code === "Space") {
        e.preventDefault(); // Prevent page scrolling

        // Call the Spotify API playpause command
        fetch("/api/spotify?command=playpause", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ command: "playpause" }),
        }).catch((err) => console.error("Failed to toggle Spotify play/pause", err));
      } else if (e.key === "ArrowRight") {
        e.preventDefault(); // Prevent page scrolling
        const command = e.shiftKey ? "seekforward" : "next";
        // Call the Spotify API command
        fetch(`/api/spotify?command=${command}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ command }),
        }).catch((err) => console.error(`Failed to execute Spotify ${command}`, err));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); // Prevent page scrolling
        const command = e.shiftKey ? "seekbackward" : "prev";
        // Call the Spotify API command
        fetch(`/api/spotify?command=${command}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ command }),
        }).catch((err) => console.error(`Failed to execute Spotify ${command}`, err));
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); // Prevent page scrolling
        // Call the Spotify API volup command
        fetch("/api/spotify?command=volup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ command: "volup" }),
        }).catch((err) => console.error("Failed to increase Spotify volume", err));
      } else if (e.key === "ArrowDown") {
        e.preventDefault(); // Prevent page scrolling
        // Call the Spotify API voldown command
        fetch("/api/spotify?command=voldown", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ command: "voldown" }),
        }).catch((err) => console.error("Failed to decrease Spotify volume", err));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab]);

  // Handle Escape key to return to Home View
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === "Escape" || e.code === "Escape") {
        if (activeTab) {
          e.preventDefault();
          setActiveTab(null);
        }
      }
    };

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [activeTab]);

  // Pull fresh data whenever the active tab changes
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab === "blog") fetchPosts();
  }, [activeTab]);

  useEffect(() => {
    init();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const init = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/dashboard/login";
      return;
    }
    setReady(true);
    fetchPosts();
    fetchScripts();
    fetchStats();
  };

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, date, is_published, slug")
      .order("date", { ascending: false });

    if (!error) setPosts(data || []);
    setTimeout(() => setLoading(false), 1500);
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
      /* Silent fail */
    }
  };

  const fetchStats = async () => {
    try {
      // Load puter script
      await loadPuter();

      if (window.puter?.auth?.getMonthlyUsage) {
        const data = await window.puter.auth.getMonthlyUsage();
        if (data?.allowanceInfo) {
          const limit = data.allowanceInfo.monthUsageAllowance || 50000000;
          const remaining = data.allowanceInfo.remaining || 0;
          setStats({
            used: limit - remaining,
            limit,
            remaining,
            loading: false,
          });
        }
      }
    } catch (err) {
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleChatFromHome = async (userMsg, model, webSearch) => {
    // Store the message and action, then open chat tab
    setPendingMessage({ content: userMsg.content, model, webSearch });
    setPendingChatAction({ type: "message" });
    setActiveTab("chat");
    setInput(""); // Clear the input
  };

  const handleOpenChatHistory = () => {
    // Set action to show history, then open chat tab
    setPendingChatAction({ type: "history" });
    setActiveTab("chat");
  };

  const handleNewChatFromHome = () => {
    // Set action to create new chat, then open chat tab
    setPendingChatAction({ type: "new-chat" });
    setActiveTab("chat");
  };

  const handleTabChange = (tabName) => {
    // Map @ command names to tab IDs
    const tabMap = {
      blog: "blog",
      feed: "feed",
      chat: "chat",
      voice: "voice",
      files: "files",
      clip: "clip",
      terminal: "terminal",
      system: "system",
      notes: "notes",
      tasks: "todo",
    };

    const tabId = tabMap[tabName] || tabName;
    setActiveTab(activeTab === tabId ? null : tabId);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (!error) setPosts(posts.filter((p) => p.id !== id));
  };

  if (!ready) {
    return null;
  }

  return (
    <section className="relative w-full flex justify-center z-10 min-h-screen bg-white dark:bg-black">
      {/* Background Effect - Exact match to PageLayout.astro */}
      <div
        className="absolute inset-x-0 top-0 h-[100px] sm:h-[120px] w-full overflow-hidden z-0 pointer-events-none"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      >
        <FlickeringGrid
          squareSize={2}
          gridGap={6}
          maxOpacity={0.3}
          flickerChance={0.2}
          className="w-full h-full"
        />
      </div>

      <div
        className={`relative w-full px-4 pb-16 ${activeTab ? "max-w-6xl pt-20 sm:pt-24" : "max-w-4xl pt-28 sm:pt-32"
          } mx-auto flex flex-col z-10`}
      >
        {/* Home View (Visible when no tab is selected) */}
        <div
          className={`flex flex-col gap-8 transition-all duration-700 ease-in-out ${activeTab
            ? "opacity-0 invisible h-0 -mb-8 scale-95 overflow-hidden"
            : "opacity-100 visible h-auto"
            }`}
        >
          <div className="flex flex-col items-center justify-center pt-12 sm:pt-16 -mb-4">
            <div className="relative w-full flex justify-center">
              <SegmentClockDisplay />
            </div>
            <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-neutral-500 font-product-sans mt-4 text-center st ">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <SpotifyWidget spotifyState={systemData.spotify} />

          {systemData.reminders && systemData.reminders.length > 0 && (
            <div className="flex flex-col items-center gap-2 mt-2 animate-in fade-in duration-500">
              <p className="text-[10px] font-bold text-gray-600 dark:text-neutral-500 font-product-sans st ">
                upcoming reminders
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {systemData.reminders.map((rem) => (
                  <div
                    key={rem.timer}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50/60 dark:bg-neutral-900/30 border border-gray-100 dark:border-neutral-900/80 rounded-full text-xs font-product-sans"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                    <span className="text-gray-900 dark:text-gray-100 font-bold lowercase">{rem.message}</span>
                    <span className="text-gray-600 dark:text-neutral-500 font-bold">in {Math.ceil(rem.remaining / 60)}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={activeTab ? "h-0" : "h-8"}></div>

        {/* Main Navigation - Hidden (now using @ commands) */}
        <div className="hidden">
          <div
            className={`flex items-center justify-center gap-1 bg-gray-100/80 dark:bg-neutral-900/80 backdrop-blur-md border border-gray-200 dark:border-neutral-800 rounded-full p-1 mx-auto w-fit transition-all duration-500`}
          >
            {[
              { id: "blog", icon: "hgi-note-01", label: "blog" },
              { id: "feed", icon: "hgi-github", label: "feed" },
              { id: "chat", icon: "hgi-ai-chat-02", label: "ai" },
              { id: "voice", icon: "hgi-mic-01", label: "voice" },
              { id: "files", icon: "hgi-folder-02", label: "files" },
              { id: "clip", icon: "hgi-copy-01", label: "clip" },
              {
                id: "terminal",
                icon: "hgi-computer-terminal-01",
                label: "term",
              },
              { id: "system", icon: "hgi-dashboard-square-01", label: "sys" },
              { id: "notes", icon: "hgi-note", label: "notes" },
              { id: "todo", icon: "hgi-task-01", label: "tasks" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(activeTab === tab.id ? null : tab.id)
                }
                className={`cursor-pointer flex items-center justify-center gap-2 rounded-full text-[11px] font-product-sans font-bold transition-all duration-300 outline-none ring-0 ${activeTab === tab.id
                  ? "px-5 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-700"
                  : "w-10 h-10 text-gray-700 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                {tab.id === "terminal" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    color="currentColor"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 7L8.22654 8.05719C8.74218 8.50163 9 8.72386 9 9C9 9.27614 8.74218 9.49836 8.22654 9.94281L7 11" />
                    <path d="M11 11H14" />
                    <path d="M12 21C15.7497 21 17.6246 21 18.9389 20.0451C19.3634 19.7367 19.7367 19.3634 20.0451 18.9389C21 17.6246 21 15.7497 21 12C21 8.25027 21 6.3754 20.0451 5.06107C19.7367 4.6366 19.3634 4.26331 18.9389 3.95491C17.6246 3 15.7497 3 12 3C8.25027 3 6.3754 3 5.06107 3.95491C4.6366 4.26331 4.26331 4.6366 3.95491 5.06107C3 6.3754 3 8.25027 3 12C3 15.7497 3 17.6246 3.95491 18.9389C4.26331 19.3634 4.6366 19.7367 5.06107 20.0451C6.3754 21 8.25027 21 12 21Z" />
                  </svg>
                ) : (
                  <i className={`hgi hgi-stroke ${tab.icon} text-lg`}></i>
                )}
                {activeTab === tab.id && (
                  <span className="lowercase">{tab.label}</span>
                )}
              </button>
            ))}

            {activeTab && (
              <button
                onClick={() => setActiveTab(null)}
                className="cursor-pointer flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-red-500 transition-colors ml-1 border-l border-gray-200 dark:border-neutral-800"
              >
                <i className="hgi hgi-stroke hgi-cancel-01 text-lg"></i>
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full h-full pb-20">
          <div className={activeTab === "blog" ? "block" : "hidden"}>
            <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-600 dark:text-neutral-600 font-product-sans">
                  personal blog
                </h3>
                <a
                  href="/dashboard/new"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-1.5 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 hover:text-accent hover:bg-accent/10 rounded-full transition-all duration-300 border border-gray-200 dark:border-neutral-800 hover:border-accent/30"
                >
                  <i className="hgi-stroke hgi-plus text-sm"></i>
                  <span>new post</span>
                </a>
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900"
                    >
                      <div className="w-10 h-10 rounded-full skeleton shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 skeleton"></div>
                        <div className="h-3 w-1/4 skeleton opacity-50"></div>
                      </div>
                      <div className="h-4 w-12 skeleton"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="group flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900 transition-all duration-300"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-neutral-900/50 flex items-center justify-center text-gray-600 shrink-0">
                        <i className="hgi-stroke hgi-note-01 text-lg"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans truncate text-sm">
                            {post.title}
                          </h3>
                          <span
                            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-product-sans font-bold ${post.is_published
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-500 border border-gray-200 dark:border-neutral-700"
                              }`}
                          >
                            {post.is_published ? "live" : "draft"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-neutral-500 font-product-sans truncate">
                          {post.slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-700 font-product-sans ">
                          {new Date(post.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <a
                            href={`/dashboard/edit?id=${post.id}`}
                            className="p-2 text-gray-600 hover:text-accent transition-colors"
                          >
                            <i className="hgi-stroke hgi-pencil-edit-01"></i>
                          </a>
                          <button
                            onClick={() => handleDelete(post.id, post.title)}
                            className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <i className="hgi-stroke hgi-delete-02"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {posts.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-neutral-900 rounded-[32px]">
                      <p className="text-sm text-gray-600 font-product-sans">
                        no posts found.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={activeTab === "feed" ? "block" : "hidden"}>
            <GithubFeed />
          </div>

          <div className={activeTab === "notes" ? "block" : "hidden"}>
            <PersonalVault
              initialSection="notes"
              hideNav={true}
              isActive={activeTab === "notes"}
            />
          </div>

          <div className={activeTab === "todo" ? "block" : "hidden"}>
            <PersonalVault
              initialSection="todos"
              hideNav={true}
              isActive={activeTab === "todo"}
            />
          </div>

          <div className={activeTab === "chat" ? "block text-left" : "hidden"}>
            <AiChatbot
              isActive={activeTab === "chat"}
              pendingMessage={pendingMessage}
              pendingAction={pendingChatAction}
              onActionProcessed={() => {
                setPendingMessage(null);
                setPendingChatAction(null);
              }}
            />
          </div>

          <div className={activeTab === "voice" ? "block text-left" : "hidden"}>
            <AiVoiceAssistant isActive={activeTab === "voice"} />
          </div>

          <div className={activeTab === "files" ? "block text-left" : "hidden"}>
            <FileExplorer isActive={activeTab === "files"} />
          </div>

          <div className={activeTab === "clip" ? "block text-left" : "hidden"}>
            <ClipboardManager
              isActive={activeTab === "clip"}
              clipboardData={systemData.clipboard}
            />
          </div>

          <div
            className={activeTab === "system" ? "block text-left" : "hidden"}
          >
            <SystemApps
              isActive={activeTab === "system"}
              togglesState={systemData.toggles}
              batteryState={systemData.battery}
              themeState={systemData.theme}
              powerProfileState={systemData.powerProfile}
              remindersState={systemData.reminders}
            />
          </div>

          <div
            className={activeTab === "terminal" ? "block text-left" : "hidden"}
          >
            <Terminal isActive={activeTab === "terminal"} />
          </div>

          <div
            className={activeTab === "links" ? "block text-left" : "hidden"}
          >
            <LinkVault isActive={activeTab === "links"} />
          </div>
        </div>
      </div>

      {/* Dashboard ChatInput - only visible on home view */}
      {!activeTab && (
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleChatFromHome}
          loading={false}
          isActive={true}
          view="chat"
          scripts={scripts}
          models={[
            {
              id: "gpt-5.4",
              name: "GPT-5.4",
              icon: "hgi-brain",
              color: "text-accent",
            },
            {
              id: "gpt-5.3-chat",
              name: "GPT-5.3",
              icon: "hgi-ai-chat-01",
              color: "text-blue-500",
            },
            {
              id: "o3-mini",
              name: "O3 Mini",
              icon: "hgi-ai-network",
              color: "text-emerald-500",
            },
            {
              id: "gpt-4o-mini",
              name: "GPT-4o Mini",
              icon: "hgi-zap",
              color: "text-orange-500",
            },
            {
              id: "claude-3-5-sonnet",
              name: "Claude 3.5",
              icon: "hgi-star",
              color: "text-fuchsia-500",
            },
          ]}
          stats={stats}
          onViewChange={handleOpenChatHistory}
          onTabChange={handleTabChange}
          onNewChat={handleNewChatFromHome}
          onLoadPuter={() => { }}
        />
      )}
    </section>
  );
}
