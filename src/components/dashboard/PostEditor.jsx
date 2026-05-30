import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { marked } from "marked";
import {
  getPostWithOfflineFallback,
  queuePostCreate,
  queuePostUpdate,
} from "../../lib/offline/sync";

export default function PostEditor({ postId = null }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [socialImage, setSocialImage] = useState("");
  const [keywords, setKeywords] = useState("");
  const [readTime, setReadTime] = useState(5);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!postId);
  const [preview, setPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("content"); // "content" | "meta"

  useEffect(() => {
    const fetchPost = async () => {
      setFetching(true);
      const data = await getPostWithOfflineFallback(postId);
      if (data) {
        setTitle(data.title || "");
        setSlug(data.slug || "");
        setDescription(data.description || "");
        setContent(data.content || "");
        setSocialImage(data.social_image || "");
        setKeywords(data.keywords ? data.keywords.join(", ") : "");
        setReadTime(data.read_time || 5);
        setIsPublished(data.is_published || false);
      }
      setFetching(false);
    };
    if (postId) fetchPost();
  }, [postId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const postData = {
      title,
      slug: slug
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, ""),
      description,
      content,
      social_image: socialImage,
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      read_time: parseInt(readTime),
      is_published: isPublished,
      date: new Date().toISOString(),
    };

    const postDataWithMeta = {
      ...postData,
      id: postId || Date.now().toString(),
    };

    if (navigator.onLine) {
      try {
        const result = postId
          ? await supabase.from("posts").update(postData).eq("id", postId)
          : await supabase.from("posts").insert([postData]);

        if (result.error) {
          alert("Error saving: " + result.error.message);
        } else {
          window.location.href = "/dashboard";
        }
      } catch (error) {
        console.error("Save error:", error);
        if (postId) {
          await queuePostUpdate(postDataWithMeta);
        } else {
          await queuePostCreate(postDataWithMeta);
        }
        alert("Saved offline, will sync when online");
      }
    } else {
      if (postId) {
        await queuePostUpdate(postDataWithMeta);
      } else {
        await queuePostCreate(postDataWithMeta);
      }
      alert("Saved offline, will sync when online");
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-125">
        <div className="w-8 h-8 border-4 border-gray-200 dark:border-neutral-600 border-t-accent dark:border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="relative w-full flex justify-center overflow-hidden z-10"
    >
      <div className="relative w-full max-w-4xl mx-auto px-4 sm:px-15 pt-16 sm:pt-24 pb-16 sm:pb-8 flex flex-col gap-8 z-10">
        {/* Header */}
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <h1 className="text-[40px] sm:text-[50px] font-['GeistPixelGrid'] text-gray-900 dark:text-gray-100">
            {postId ? "edit post" : "new post"}
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400 font-product-sans leading-relaxed max-w-3xl mx-auto text-center">
            {postId ? "Update your existing" : "Write a new"}{" "}
            <strong>blog post</strong> below.
          </p>

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-2">
            <a
              href="/dashboard"
              className="cursor-pointer inline-flex items-center gap-2 pr-4 pl-2 py-2 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-full text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-300 font-product-sans font-medium text-sm"
            >
              <i className="hgi-stroke hgi-arrow-left-01 text-base"></i>
              back
            </a>
            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className={`cursor-pointer inline-flex items-center gap-2 pl-4 pr-2 py-2 border rounded-full transition-all duration-300 font-product-sans font-medium text-sm ${
                preview
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-gray-100 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:text-accent hover:bg-accent/10 hover:border-accent/30"
              }`}
            >
              {preview ? "editing" : "preview"}
              <i
                className={`hgi-stroke ${preview ? "hgi-view-off-01" : "hgi-view-02"} text-base`}
              ></i>
            </button>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`cursor-pointer inline-flex items-center gap-2 pl-4 pr-2 py-2 border rounded-full transition-all duration-300 font-product-sans font-medium text-sm ${
                isPublished
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : "bg-gray-100 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-400"
              }`}
            >
              {isPublished ? "published" : "draft"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 hover:text-accent hover:bg-accent/10 rounded-full transition-all duration-300 border border-gray-200 dark:border-neutral-800 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span>saving</span>{" "}
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                </>
              ) : (
                <>
                  <span>{postId ? "update" : "publish"}</span>{" "}
                  <i className="hgi-stroke hgi-arrow-right-01 text-base"></i>
                </>
              )}
            </button>
          </div>

          {/* Tab switcher for metadata */}
          {!preview && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-full p-1 text-xs font-product-sans font-bold">
              {["content", "meta"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`cursor-pointer px-4 py-1.5 rounded-full transition-all duration-300 capitalize ${
                    activeTab === tab
                      ? "bg-white dark:bg-black text-gray-900 dark:text-gray-100"
                      : "text-gray-700 dark:text-gray-400"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Title input — always visible */}
        {!preview && (
          <label htmlFor="post-title" className="flex flex-col w-full">
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              required
              className="w-full text-2xl sm:text-3xl font-bold bg-transparent outline-none border-b border-gray-100 dark:border-neutral-900 pb-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-200 dark:placeholder:text-neutral-800 font-product-sans"
            />
          </label>
        )}

        {/* Content tab */}
        {!preview && activeTab === "content" && (
          <div className="flex flex-col gap-6">
            {/* Inline slug + read time */}
            <div className="flex flex-wrap items-center gap-3 -mt-4">
              <label
                htmlFor="post-slug"
                className="flex items-center gap-2 text-xs text-gray-600 font-product-sans"
              >
                <i className="hgi-stroke hgi-link-01 text-xs"></i>
                <input
                  id="post-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-slug"
                  className="bg-transparent outline-none font-mono text-accent placeholder:text-gray-500 dark:placeholder:text-neutral-700 w-36"
                />
              </label>
              <span className="text-gray-200 dark:text-neutral-800">·</span>
              <div className="flex items-center gap-1 text-xs text-gray-600 font-product-sans">
                <i className="hgi-stroke hgi-clock-01 text-xs"></i>
                <input
                  type="number"
                  value={readTime}
                  onChange={(e) => setReadTime(e.target.value)}
                  className="bg-transparent outline-none w-8 font-mono text-gray-700 dark:text-gray-400"
                />
                <span>min read</span>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content in markdown..."
              required
              className="w-full min-h-125 bg-transparent outline-none border-none text-gray-600 dark:text-gray-400 font-product-sans leading-relaxed resize-none text-base py-2 border-t border-gray-100 dark:border-neutral-900 pt-4"
            />
          </div>
        )}

        {/* Meta tab */}
        {!preview && activeTab === "meta" && (
          <div className="flex flex-col gap-6 border-t border-gray-100 dark:border-neutral-900 pt-6">
            {[
              {
                label: "Description",
                value: description,
                onChange: setDescription,
                placeholder: "A short summary of the post...",
                rows: 3,
              },
            ].map(({ label, value, onChange, placeholder, rows }) => (
              <label key={label} className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-400 font-product-sans">
                  {label}
                </span>
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  rows={rows}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl font-product-sans text-sm text-gray-600 dark:text-gray-400 placeholder:text-gray-500 dark:placeholder:text-neutral-700 outline-none focus:border-accent transition-colors duration-300 resize-none"
                />
              </label>
            ))}

            {[
              {
                label: "Thumbnail URL",
                value: socialImage,
                onChange: setSocialImage,
                placeholder: "https://...",
              },
              {
                label: "Keywords (comma separated)",
                value: keywords,
                onChange: setKeywords,
                placeholder: "react, design, css...",
              },
            ].map(({ label, value, onChange, placeholder }) => (
              <label key={label} className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-400 font-product-sans">
                  {label}
                </span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-full font-product-sans text-sm text-gray-600 dark:text-gray-400 placeholder:text-gray-500 dark:placeholder:text-neutral-700 outline-none focus:border-accent transition-colors duration-300"
                />
              </label>
            ))}

            {socialImage && (
              <div className="aspect-video rounded-2xl overflow-hidden border border-gray-100 dark:border-neutral-900 mt-2">
                <img
                  src={socialImage}
                  className="w-full h-full object-cover"
                  alt="Cover preview"
                />
              </div>
            )}
          </div>
        )}

        {/* Preview mode */}
        {preview && (
          <div className="border-t border-gray-100 dark:border-neutral-900 pt-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-gray-600 font-product-sans">
                Live Preview
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold font-['GeistPixelGrid'] text-gray-900 dark:text-gray-100 mb-8">
              {title || "Untitled"}
            </h2>
            {/* Markdown content is safely parsed by marked library */}
            <div
              suppressHydrationWarning
              className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:font-product-sans prose-p:text-gray-700 dark:prose-p:text-gray-400 prose-headings:font-product-sans"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is safely parsed by marked
              dangerouslySetInnerHTML={{
                __html: marked.parse(content || "_Nothing to preview yet..._"),
              }}
            />
          </div>
        )}
      </div>
    </form>
  );
}
