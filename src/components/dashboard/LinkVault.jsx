import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import DashboardModal from "./DashboardModal";

export default function LinkVault({ isActive = true }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null); // null for new link
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: null, message: "" });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user && isActive) {
      fetchLinks();
    }
  }, [user, isActive]);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);
    if (!user) setLoading(false);
  };

  const fetchLinks = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setLinks(data || []);
    } else {
      console.error("Failed to fetch links:", error);
    }
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingLink(null);
    setTitle("");
    setUrl("");
    setNotes("");
    setModalOpen(true);
  };

  const handleOpenEdit = (link) => {
    setEditingLink(link);
    setTitle(link.title);
    setUrl(link.url);
    setNotes(link.notes || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setSubmitting(true);
    setStatus({ type: "info", message: "saving..." });

    try {
      if (editingLink) {
        // Update
        const { error } = await supabase
          .from("links")
          .update({ title: title.trim(), url: formattedUrl, notes: notes.trim() })
          .eq("id", editingLink.id);

        if (error) throw error;
        setStatus({ type: "success", message: "link updated successfully!" });
      } else {
        // Insert
        const { error } = await supabase
          .from("links")
          .insert({
            title: title.trim(),
            url: formattedUrl,
            notes: notes.trim(),
            user_id: user.id,
          });

        if (error) throw error;
        setStatus({ type: "success", message: "link saved successfully!" });
      }

      // Refresh list
      await fetchLinks();

      // Close modal
      setTimeout(() => {
        setModalOpen(false);
        setStatus({ type: null, message: "" });
      }, 1000);
    } catch (err) {
      console.error("Error saving link:", err);
      setStatus({ type: "error", message: err.message || "failed to save link." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this link?")) return;
    try {
      const { error } = await supabase.from("links").delete().eq("id", id);
      if (error) throw error;
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error("Error deleting link:", err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const filteredLinks = links.filter((link) => {
    const query = search.toLowerCase();
    return (
      link.title.toLowerCase().includes(query) ||
      link.url.toLowerCase().includes(query) ||
      (link.notes && link.notes.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 font-product-sans lowercase">
            link vault
          </h3>
          <p className="text-[10px] text-gray-600 dark:text-neutral-400 font-product-sans lowercase">
            your secure, private vault of references and links
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Flat search input */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-900 rounded-full px-4 py-1.5 w-full sm:w-64">
            <i className="hgi hgi-stroke hgi-search-01 text-gray-400 text-xs shrink-0"></i>
            <input
              type="text"
              placeholder="search links..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none font-product-sans text-xs text-gray-900 dark:text-white placeholder:text-gray-500 w-full"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-accent text-white rounded-full text-xs font-product-sans font-bold hover:bg-accent/90 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 lowercase"
          >
            <i className="hgi hgi-stroke hgi-plus-sign text-[11px]"></i>
            add link
          </button>
        </div>
      </div>

      {/* Grid of Link Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredLinks.length > 0 ? (
        <div className="flex flex-col gap-0 px-2">
          {filteredLinks.map((link) => (
            <div
              key={link.id}
              className="group relative flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900 transition-all duration-300 hover:bg-gray-50/30 dark:hover:bg-white/[0.01]"
            >
              {/* Left Icon */}
              <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-neutral-900/50 flex items-center justify-center text-gray-600 dark:text-neutral-400 shrink-0">
                <i className="hgi hgi-stroke hgi-link-02 text-lg"></i>
              </div>

              {/* Middle Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans truncate text-sm lowercase">
                    {link.title}
                  </h3>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-product-sans text-accent hover:underline lowercase truncate max-w-[250px]"
                  >
                    {link.url.replace(/^https?:\/\/(www\.)?/i, "")}
                  </a>
                </div>
                <p className="text-xs text-gray-700 dark:text-neutral-500 font-product-sans truncate lowercase">
                  {link.notes || <span className="text-[10px] text-gray-600 dark:text-neutral-600 italic">no notes</span>}
                </p>
              </div>

              {/* Right Action/Date area */}
              <div className="flex items-center gap-4 shrink-0 pr-2">
                <span className="text-[10px] font-bold text-gray-600 dark:text-neutral-700 font-product-sans transition-opacity duration-300 group-hover:opacity-0 group-hover:pointer-events-none">
                  {new Date(link.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                
                <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={() => handleOpenEdit(link)}
                    className="p-2 text-gray-600 dark:text-neutral-400 hover:text-accent transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <i className="hgi hgi-stroke hgi-pencil-01 text-base"></i>
                  </button>
                  <button
                    onClick={() => copyToClipboard(link.url)}
                    className="p-2 text-gray-600 dark:text-neutral-400 hover:text-accent transition-colors cursor-pointer"
                    title="Copy URL"
                  >
                    <i className="hgi hgi-stroke hgi-copy-01 text-base"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="p-2 text-gray-600 dark:text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <i className="hgi hgi-stroke hgi-delete-02 text-base"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="col-span-full py-20 bg-gray-50/50 dark:bg-neutral-950/20 border border-dashed border-gray-100 dark:border-neutral-900 rounded-[32px] flex flex-col items-center justify-center text-gray-600 dark:text-neutral-500 px-4">
          <i className="hgi hgi-stroke hgi-link-02 text-3xl mb-2 opacity-50"></i>
          <p className="text-sm font-product-sans lowercase">no links stored in vault yet.</p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-1.5 bg-accent text-white rounded-full text-xs font-product-sans font-bold hover:bg-accent/90 transition-all cursor-pointer lowercase"
          >
            add your first link
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      <DashboardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLink ? "edit link" : "add new link"}
        subtitle="secure reference to external web vault resources"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-gray-600 dark:text-neutral-400 font-product-sans px-1 lowercase">
              title
            </label>
            <input
              type="text"
              placeholder="e.g. documentation, tools, design"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="px-4 py-2.5 bg-gray-50 dark:bg-neutral-950/50 border border-gray-100 dark:border-neutral-900 rounded-2xl text-xs font-product-sans text-gray-900 dark:text-white outline-none focus:border-accent/50 transition-colors lowercase"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-gray-600 dark:text-neutral-400 font-product-sans px-1 lowercase">
              url
            </label>
            <input
              type="text"
              placeholder="e.g. supabase.com, github.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="px-4 py-2.5 bg-gray-50 dark:bg-neutral-950/50 border border-gray-100 dark:border-neutral-900 rounded-2xl text-xs font-product-sans text-gray-900 dark:text-white outline-none focus:border-accent/50 transition-colors lowercase"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-gray-600 dark:text-neutral-400 font-product-sans px-1 lowercase">
              notes
            </label>
            <textarea
              placeholder="e.g. login credentials format, reference keys, tags..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="px-4 py-2.5 bg-gray-50 dark:bg-neutral-950/50 border border-gray-100 dark:border-neutral-900 rounded-2xl text-xs font-product-sans text-gray-900 dark:text-white outline-none focus:border-accent/50 transition-colors lowercase resize-none"
            />
          </div>

          {status.message && (
            <div
              className={`p-3 rounded-xl border text-[10px] font-product-sans font-bold flex items-center gap-2 ${status.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : status.type === "error"
                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                  : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                }`}
            >
              {status.type === "info" && (
                <div className="w-3 h-3 border border-t-transparent border-accent rounded-full animate-spin shrink-0"></div>
              )}
              {status.message}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-neutral-800 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all  cursor-pointer"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-xs font-product-sans font-bold text-white bg-accent border border-accent rounded-full hover:bg-accent/90 transition-all  cursor-pointer"
            >
              {editingLink ? "update" : "save"}
            </button>
          </div>
        </form>
      </DashboardModal>
    </div>
  );
}
