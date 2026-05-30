import { useState, useEffect, useRef } from "react";

export default function GithubManager({ isActive }) {
  const [repos, setRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchLoading, setBranchLoading] = useState(false);
  const [pullsLoading, setPullsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [view, setView] = useState("branches"); // "branches" | "pulls"
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [mergeModal, setMergeModal] = useState(null);
  const [createBranchModal, setCreateBranchModal] = useState(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [deleteRepoModal, setDeleteRepoModal] = useState(null);
  const [deleteRepoConfirm, setDeleteRepoConfirm] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (isActive) {
      loadUser();
      loadRepos();
    }
  }, [isActive]);

  useEffect(() => {
    if (!search) {
      setFilteredRepos(repos);
    } else {
      setFilteredRepos(
        repos.filter(
          (r) =>
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            (r.description || "").toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, repos]);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const loadUser = async () => {
    try {
      const res = await fetch("/api/github-manager?action=user");
      if (res.ok) setUser(await res.json());
    } catch {}
  };

  const loadRepos = async () => {
    setLoading(true);
    try {
      let allRepos = [];
      let page = 1;
      while (true) {
        const res = await fetch(`/api/github-manager?action=repos&page=${page}`);
        if (!res.ok) break;
        const data = await res.json();
        if (!data.length) break;
        allRepos = allRepos.concat(data);
        if (data.length < 100) break;
        page++;
      }
      setRepos(allRepos);
      setFilteredRepos(allRepos);
    } catch {
      showToast("Failed to load repositories", true);
    } finally {
      setLoading(false);
    }
  };

  const selectRepo = async (repo) => {
    setSelectedRepo(repo);
    setBranchLoading(true);
    setPullsLoading(true);
    try {
      const res = await fetch(`/api/github-manager?action=branches&repo=${repo.full_name}`);
      if (res.ok) setBranches(await res.json());
      else setBranches([]);
    } catch {
      setBranches([]);
    } finally {
      setBranchLoading(false);
    }
    try {
      const res = await fetch(`/api/github-manager?action=pulls&repo=${repo.full_name}`);
      if (res.ok) setPulls(await res.json());
      else setPulls([]);
    } catch {
      setPulls([]);
    } finally {
      setPullsLoading(false);
    }
  };

  const deleteBranch = async (branch) => {
    try {
      const res = await fetch("/api/github-manager?action=delete-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: selectedRepo.full_name, branch }),
      });
      if (res.ok) {
        setBranches((prev) => prev.filter((b) => b.name !== branch));
        showToast(`Deleted "${branch}"`);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Failed to delete branch", true);
      }
    } catch {
      showToast("Network error", true);
    }
    setModal(null);
  };

  const mergeBranch = async () => {
    if (!mergeModal || !mergeTarget) return;
    try {
      const res = await fetch("/api/github-manager?action=merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selectedRepo.full_name,
          base: mergeTarget,
          head: mergeModal.name,
          commit_message: `Merge ${mergeModal.name} into ${mergeTarget}`,
        }),
      });
      const data = await res.json();
      if (res.ok && !data.message) {
        showToast(`Merged "${mergeModal.name}" into "${mergeTarget}"`);
        selectRepo(selectedRepo);
      } else {
        showToast(data.message || "Merge failed", true);
      }
    } catch {
      showToast("Network error", true);
    }
    setMergeModal(null);
    setMergeTarget("");
  };

  const createBranch = async () => {
    if (!createBranchModal || !newBranchName.trim()) return;
    try {
      const res = await fetch("/api/github-manager?action=create-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selectedRepo.full_name,
          branch: newBranchName.trim(),
          from_sha: createBranchModal.commit.sha,
        }),
      });
      if (res.ok) {
        showToast(`Created branch "${newBranchName.trim()}"`);
        selectRepo(selectedRepo);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Failed to create branch", true);
      }
    } catch {
      showToast("Network error", true);
    }
    setCreateBranchModal(null);
    setNewBranchName("");
  };

  const mergePR = async (pr, method = "merge") => {
    try {
      const res = await fetch("/api/github-manager?action=merge-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selectedRepo.full_name,
          pull_number: pr.number,
          merge_method: method,
        }),
      });
      const data = await res.json();
      if (res.ok && data.merged) {
        showToast(`PR #${pr.number} merged`);
        setPulls((prev) => prev.filter((p) => p.number !== pr.number));
      } else {
        showToast(data.message || "Merge failed", true);
      }
    } catch {
      showToast("Network error", true);
    }
  };

  const deleteRepo = async () => {
    if (!deleteRepoModal || deleteRepoConfirm !== deleteRepoModal.name) return;
    try {
      const res = await fetch("/api/github-manager?action=delete-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: deleteRepoModal.full_name }),
      });
      if (res.ok) {
        setRepos((prev) => prev.filter((r) => r.id !== deleteRepoModal.id));
        if (selectedRepo?.id === deleteRepoModal.id) {
          setSelectedRepo(null);
          setBranches([]);
          setPulls([]);
        }
        showToast(`Deleted "${deleteRepoModal.name}"`);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || "Failed to delete repo", true);
      }
    } catch {
      showToast("Network error", true);
    }
    setDeleteRepoModal(null);
    setDeleteRepoConfirm("");
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-32 skeleton"></div>
          <div className="h-8 w-24 skeleton rounded-full"></div>
        </div>
        <div className="flex gap-4">
          <div className="w-64 flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 skeleton rounded-xl"></div>
            ))}
          </div>
          <div className="flex-1">
            <div className="h-64 skeleton rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-600 dark:text-neutral-600 font-product-sans">
            github manager
          </h3>
          {user && (
            <div className="flex items-center gap-2">
              <img
                src={user.avatar_url}
                alt=""
                className="w-5 h-5 rounded-full border border-gray-200 dark:border-neutral-800"
              />
              <span className="text-[11px] font-bold text-gray-500 dark:text-neutral-500 font-product-sans">
                {user.login}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => loadRepos()}
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-1.5 text-xs font-product-sans font-bold text-gray-700 dark:text-gray-300 hover:text-accent hover:bg-accent/10 rounded-full transition-all duration-300 border border-gray-200 dark:border-neutral-800 hover:border-accent/30"
        >
          <i className="hgi-stroke hgi-refresh text-sm"></i>
          <span>refresh</span>
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Sidebar - Repo List */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2">
          <div className="relative mb-2">
            <i className="hgi-stroke hgi-search-01 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600 text-xs"></i>
            <input
              type="text"
              placeholder="filter repos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs font-product-sans bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800/80 rounded-xl text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto max-h-[460px] flex flex-col gap-1 pr-1">
            {filteredRepos.map((repo) => (
              <div key={repo.id} className="group/repo relative">
                <button
                  onClick={() => selectRepo(repo)}
                  className={`cursor-pointer w-full text-left p-3 rounded-xl transition-all duration-200 border ${
                    selectedRepo?.id === repo.id
                      ? "bg-accent/5 border-accent/20 dark:bg-accent/5"
                      : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-neutral-900/30 hover:border-gray-100 dark:hover:border-neutral-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <i
                      className={`text-xs ${
                        repo.private
                          ? "hgi-stroke hgi-lock text-yellow-500"
                          : "hgi-stroke hgi-book-02 text-gray-400 dark:text-neutral-600"
                      }`}
                    ></i>
                    <span
                      className={`text-xs font-bold font-product-sans truncate ${
                        selectedRepo?.id === repo.id
                          ? "text-accent"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {repo.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        repo.private
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
                          : "bg-gray-100 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-neutral-700/50"
                      }`}
                    >
                      {repo.private ? "private" : "public"}
                    </span>
                    {repo.language && (
                      <span className="text-[9px] text-gray-400 dark:text-neutral-600 font-product-sans">
                        {repo.language}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteRepoModal(repo);
                  }}
                  className="cursor-pointer absolute top-2 right-2 p-1.5 text-gray-300 dark:text-neutral-700 hover:text-red-500 transition-all opacity-0 group-hover/repo:opacity-100 rounded-lg hover:bg-red-500/5"
                  title="Delete repo"
                >
                  <i className="hgi-stroke hgi-delete-02 text-[10px]"></i>
                </button>
              </div>
            ))}
            {filteredRepos.length === 0 && (
              <div className="text-center py-10 text-xs text-gray-400 dark:text-neutral-600 font-product-sans">
                no repos found
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedRepo ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-neutral-600">
              <i className="hgi-stroke hgi-git-branch text-4xl opacity-30"></i>
              <span className="text-xs font-product-sans">
                select a repository
              </span>
            </div>
          ) : (
            <>
              {/* Repo Header + View Tabs */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-gray-100/60 dark:bg-neutral-900/50 rounded-full p-0.5">
                    <button
                      onClick={() => setView("branches")}
                      className={`cursor-pointer px-3 py-1.5 text-[10px] font-bold font-product-sans rounded-full transition-all ${
                        view === "branches"
                          ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-700"
                          : "text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      <i className="hgi-stroke hgi-git-branch text-xs mr-1"></i>
                      branches
                      {!branchLoading && (
                        <span className="ml-1 text-[9px] opacity-60">
                          {branches.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setView("pulls")}
                      className={`cursor-pointer px-3 py-1.5 text-[10px] font-bold font-product-sans rounded-full transition-all ${
                        view === "pulls"
                          ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-700"
                          : "text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      <i className="hgi-stroke hgi-git-pull-request text-xs mr-1"></i>
                      pull requests
                      {!pullsLoading && (
                        <span className="ml-1 text-[9px] opacity-60">
                          {pulls.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <a
                  href={`https://github.com/${selectedRepo.full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-product-sans font-bold text-gray-500 dark:text-neutral-500 hover:text-accent transition-all"
                >
                  <i className="hgi-stroke hgi-arrow-up-right text-[10px]"></i>
                  open on github
                </a>
              </div>

              {/* Branches View */}
              {view === "branches" && (
                <div className="flex-1 overflow-y-auto max-h-[420px] pr-1">
                  {branchLoading ? (
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 skeleton rounded-xl"></div>
                      ))}
                    </div>
                  ) : branches.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-gray-400 dark:text-neutral-600">
                      <i className="hgi-stroke hgi-git-branch text-3xl opacity-30"></i>
                      <span className="text-xs font-product-sans">
                        no branches
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {branches.map((branch) => {
                        const isDefault =
                          branch.name === selectedRepo.default_branch;
                        return (
                          <div
                            key={branch.name}
                            className="group flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-neutral-900/20 border border-gray-100 dark:border-neutral-800/50 rounded-xl hover:border-gray-200 dark:hover:border-neutral-700/50 transition-all"
                          >
                            <i className="hgi-stroke hgi-git-branch text-sm text-gray-400 dark:text-neutral-600 shrink-0"></i>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-product-sans text-gray-800 dark:text-gray-200 truncate max-w-[250px]">
                                  {branch.name}
                                </span>
                                {isDefault && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    default
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 dark:text-neutral-600 font-mono">
                                {branch.commit.sha.slice(0, 7)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Create branch from this */}
                              <button
                                onClick={() => setCreateBranchModal(branch)}
                                className="cursor-pointer p-1.5 text-gray-400 dark:text-neutral-600 hover:text-accent transition-colors rounded-lg hover:bg-accent/5"
                                title="Create branch from here"
                              >
                                <i className="hgi-stroke hgi-plus text-xs"></i>
                              </button>
                              {/* Merge */}
                              {!isDefault && (
                                <button
                                  onClick={() => setMergeModal(branch)}
                                  className="cursor-pointer p-1.5 text-gray-400 dark:text-neutral-600 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/5"
                                  title="Merge branch"
                                >
                                  <i className="hgi-stroke hgi-git-merge text-xs"></i>
                                </button>
                              )}
                              {/* Delete */}
                              {!isDefault && (
                                <button
                                  onClick={() => setModal(branch.name)}
                                  className="cursor-pointer p-1.5 text-gray-400 dark:text-neutral-600 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/5"
                                  title="Delete branch"
                                >
                                  <i className="hgi-stroke hgi-delete-02 text-xs"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Pull Requests View */}
              {view === "pulls" && (
                <div className="flex-1 overflow-y-auto max-h-[420px] pr-1">
                  {pullsLoading ? (
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 skeleton rounded-xl"></div>
                      ))}
                    </div>
                  ) : pulls.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-gray-400 dark:text-neutral-600">
                      <i className="hgi-stroke hgi-git-pull-request text-3xl opacity-30"></i>
                      <span className="text-xs font-product-sans">
                        no open pull requests
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pulls.map((pr) => (
                        <div
                          key={pr.number}
                          className="group flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-neutral-900/20 border border-gray-100 dark:border-neutral-800/50 rounded-xl hover:border-gray-200 dark:hover:border-neutral-700/50 transition-all"
                        >
                          <i className="hgi-stroke hgi-git-pull-request text-sm text-green-500 shrink-0"></i>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold font-product-sans text-gray-800 dark:text-gray-200 truncate">
                                {pr.title}
                              </span>
                              <span className="text-[9px] text-gray-400 dark:text-neutral-600 font-mono shrink-0">
                                #{pr.number}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400 dark:text-neutral-600 font-product-sans">
                                {pr.head?.ref}
                              </span>
                              <i className="hgi-stroke hgi-arrow-right-01 text-[8px] text-gray-300 dark:text-neutral-700"></i>
                              <span className="text-[10px] text-gray-400 dark:text-neutral-600 font-product-sans">
                                {pr.base?.ref}
                              </span>
                              {pr.user && (
                                <img
                                  src={pr.user.avatar_url}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-full ml-1"
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => mergePR(pr, "merge")}
                              className="cursor-pointer px-2.5 py-1 text-[9px] font-bold font-product-sans text-green-600 dark:text-green-400 bg-green-500/5 hover:bg-green-500/10 border border-green-500/20 rounded-lg transition-all"
                            >
                              merge
                            </button>
                            <a
                              href={pr.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cursor-pointer p-1.5 text-gray-400 dark:text-neutral-600 hover:text-accent transition-colors"
                            >
                              <i className="hgi-stroke hgi-arrow-up-right text-xs"></i>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Branch Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 w-[340px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <i className="hgi-stroke hgi-alert-02 text-red-500"></i>
              <h4 className="text-sm font-bold font-product-sans text-red-500">
                delete branch?
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-neutral-400 font-product-sans leading-relaxed mb-5">
              Permanently delete{" "}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-[11px] font-mono">
                {modal}
              </code>{" "}
              from{" "}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-[11px] font-mono">
                {selectedRepo?.name}
              </code>
              . This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                cancel
              </button>
              <button
                onClick={() => deleteBranch(modal)}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-red-500 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all"
              >
                <i className="hgi-stroke hgi-delete-02 text-xs mr-1"></i>
                delete branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Branch Modal */}
      {mergeModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setMergeModal(null)}
        >
          <div
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 w-[380px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <i className="hgi-stroke hgi-git-merge text-blue-500"></i>
              <h4 className="text-sm font-bold font-product-sans text-gray-900 dark:text-gray-100">
                merge branch
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-neutral-400 font-product-sans leading-relaxed mb-4">
              Merge{" "}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-[11px] font-mono">
                {mergeModal.name}
              </code>{" "}
              into:
            </p>
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="w-full mb-4 px-3 py-2.5 text-xs font-product-sans bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-accent/30 transition-all"
            >
              <option value="">select target branch</option>
              {branches
                .filter((b) => b.name !== mergeModal.name)
                .map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                    {b.name === selectedRepo.default_branch ? " (default)" : ""}
                  </option>
                ))}
            </select>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setMergeModal(null);
                  setMergeTarget("");
                }}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                cancel
              </button>
              <button
                onClick={mergeBranch}
                disabled={!mergeTarget}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-blue-500 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <i className="hgi-stroke hgi-git-merge text-xs mr-1"></i>
                merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Branch Modal */}
      {createBranchModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setCreateBranchModal(null)}
        >
          <div
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 w-[380px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <i className="hgi-stroke hgi-git-branch text-accent"></i>
              <h4 className="text-sm font-bold font-product-sans text-gray-900 dark:text-gray-100">
                create branch
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-neutral-400 font-product-sans leading-relaxed mb-4">
              Create a new branch from{" "}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-[11px] font-mono">
                {createBranchModal.name}
              </code>
            </p>
            <input
              type="text"
              placeholder="new-branch-name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBranch()}
              autoFocus
              className="w-full mb-4 px-3 py-2.5 text-xs font-mono bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-accent/30 transition-all"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCreateBranchModal(null);
                  setNewBranchName("");
                }}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                cancel
              </button>
              <button
                onClick={createBranch}
                disabled={!newBranchName.trim()}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-accent bg-accent/5 hover:bg-accent/10 border border-accent/20 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <i className="hgi-stroke hgi-plus text-xs mr-1"></i>
                create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Repo Modal */}
      {deleteRepoModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setDeleteRepoModal(null);
            setDeleteRepoConfirm("");
          }}
        >
          <div
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 w-[380px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <i className="hgi-stroke hgi-alert-02 text-red-500"></i>
              <h4 className="text-sm font-bold font-product-sans text-red-500">
                delete repository?
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-neutral-400 font-product-sans leading-relaxed mb-4">
              This will permanently delete{" "}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-[11px] font-mono font-bold">
                {deleteRepoModal.full_name}
              </code>{" "}
              including all branches, releases, and settings. This action{" "}
              <span className="text-red-500 font-bold">cannot be undone</span>.
            </p>
            <p className="text-[10px] text-gray-500 dark:text-neutral-500 font-product-sans mb-2">
              Type <span className="font-bold text-gray-700 dark:text-gray-300">{deleteRepoModal.name}</span> to confirm:
            </p>
            <input
              type="text"
              placeholder={deleteRepoModal.name}
              value={deleteRepoConfirm}
              onChange={(e) => setDeleteRepoConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && deleteRepo()}
              autoFocus
              className="w-full mb-4 px-3 py-2.5 text-xs font-mono bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-red-500/30 transition-all"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteRepoModal(null);
                  setDeleteRepoConfirm("");
                }}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                cancel
              </button>
              <button
                onClick={deleteRepo}
                disabled={deleteRepoConfirm !== deleteRepoModal.name}
                className="cursor-pointer px-4 py-2 text-[10px] font-bold font-product-sans text-red-500 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <i className="hgi-stroke hgi-delete-02 text-xs mr-1"></i>
                delete repository
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 rounded-xl text-xs font-bold font-product-sans border animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.isError
              ? "bg-red-50 dark:bg-red-900/20 text-red-500 border-red-200 dark:border-red-800/50"
              : "bg-gray-900 dark:bg-neutral-800 text-white border-gray-800 dark:border-neutral-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
