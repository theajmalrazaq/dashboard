import { useState, useEffect } from "react";

export default function GithubFeed() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const username = "theajmalrazaq";

  useEffect(() => {
    const fetchGithubFeed = async () => {
      try {
        const response = await fetch("/api/github-feed");
        if (response.ok) {
          const data = await response.json();
          setEntries(data);
        }
      } catch (error) {
        console.error("Error fetching GitHub feed:", error);
      } finally {
        setTimeout(() => setLoading(false), 1500);
      }
    };

    fetchGithubFeed();
  }, []);

  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    if (seconds < 172800) return "yesterday";
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-24 skeleton"></div>
          <div className="h-8 w-20 skeleton rounded-full"></div>
        </div>

        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900"
            >
              <div className="w-10 h-10 rounded-full skeleton shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 skeleton"></div>
                <div className="h-3 w-20 skeleton"></div>
              </div>
              <div className="h-4 w-12 skeleton"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-600 dark:text-neutral-600 font-product-sans">
          github network
        </h3>
        <div className="flex items-center gap-2">
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-1.5 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 hover:text-accent hover:bg-accent/10 rounded-full transition-all duration-300 border border-gray-200 dark:border-neutral-800 hover:border-accent/30"
          >
            <span>profile</span>
            <i className="hgi-stroke hgi-arrow-right-01 text-sm"></i>
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div
            key={entry.id || Math.random()}
            className="group flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900 transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-neutral-900/50 flex items-center justify-center text-gray-600 shrink-0 border border-gray-100 dark:border-neutral-800 group-hover:border-accent transition-colors">
              {entry.thumbnail ? (
                <img
                  src={entry.thumbnail}
                  className="w-full h-full rounded-full object-cover"
                  alt=""
                />
              ) : (
                <i className="hgi-stroke hgi-github-01 text-lg"></i>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-product-sans text-gray-700 dark:text-gray-300 leading-snug truncate [&>a]:font-bold [&>a]:text-gray-900 [&>a]:dark:text-white [&>a]:hover:text-accent [&>a]:transition-colors"
                dangerouslySetInnerHTML={{ __html: entry.title }}
              />
              <a
                href={entry.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-accent/80 hover:text-accent transition-colors mt-1"
              >
                <i className="hgi-stroke hgi-link-01 text-[10px]"></i>
                view details
              </a>
            </div>

            <div className="flex items-center shrink-0">
              <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-700 font-product-sans ">
                {timeAgo(entry.published)}
              </span>
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-neutral-900 rounded-[32px]">
            <p className="text-sm text-gray-600 font-product-sans">
              feed unavailable or empty
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
