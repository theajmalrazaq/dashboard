import type { APIRoute } from "astro";
import {
  createDashboardDisabledResponse,
  dashboardEnabled,
} from "../../lib/dashboardMode";

const GITHUB_API = "https://api.github.com";

function getToken() {
  return (
    import.meta.env.PUBLIC_GITHUB_TOKEN ||
    import.meta.env.PUBLIC_GITHUB_FEED_TOKEN
  );
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export const GET: APIRoute = async ({ url }) => {
  if (!dashboardEnabled) return createDashboardDisabledResponse();

  const token = getToken();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "GitHub token not configured" }),
      { status: 500 },
    );
  }

  const action = url.searchParams.get("action");

  try {
    if (action === "user") {
      const res = await fetch(`${GITHUB_API}/user`, {
        headers: ghHeaders(token),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "repos") {
      const page = url.searchParams.get("page") || "1";
      const res = await fetch(
        `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=updated`,
        { headers: ghHeaders(token) },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "branches") {
      const repo = url.searchParams.get("repo");
      if (!repo)
        return new Response(JSON.stringify({ error: "repo required" }), {
          status: 400,
        });
      const res = await fetch(
        `${GITHUB_API}/repos/${repo}/branches?per_page=100`,
        { headers: ghHeaders(token) },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "branch-stats") {
      const repo = url.searchParams.get("repo");
      if (!repo)
        return new Response(JSON.stringify({ error: "repo required" }), {
          status: 400,
        });

      const branchRes = await fetch(
        `${GITHUB_API}/repos/${repo}/branches?per_page=100`,
        { headers: ghHeaders(token) },
      );
      const branches = await branchRes.json();

      if (!Array.isArray(branches)) {
        return new Response(JSON.stringify(branches), {
          status: branchRes.status,
        });
      }

      const stats = await Promise.all(
        branches.map(async (branch: { name: string; protected: boolean }) => {
          try {
            const compareRes = await fetch(
              `${GITHUB_API}/repos/${repo}/compare/main...${encodeURIComponent(branch.name)}`,
              { headers: ghHeaders(token) },
            );
            const compareData = await compareRes.json();
            return {
              name: branch.name,
              protected: branch.protected,
              ahead_by: compareData.ahead_by || 0,
              behind_by: compareData.behind_by || 0,
            };
          } catch {
            return {
              name: branch.name,
              protected: branch.protected,
              ahead_by: 0,
              behind_by: 0,
            };
          }
        }),
      );

      return new Response(JSON.stringify(stats), { status: 200 });
    }

    if (action === "pulls") {
      const repo = url.searchParams.get("repo");
      if (!repo)
        return new Response(JSON.stringify({ error: "repo required" }), {
          status: 400,
        });
      const state = url.searchParams.get("state") || "open";
      const res = await fetch(
        `${GITHUB_API}/repos/${repo}/pulls?state=${state}&per_page=30`,
        { headers: ghHeaders(token) },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!dashboardEnabled) return createDashboardDisabledResponse();

  const token = getToken();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "GitHub token not configured" }),
      { status: 500 },
    );
  }

  const action = url.searchParams.get("action");

  try {
    if (action === "delete-branch") {
      const { repo, branch } = await request.json();
      if (!repo || !branch) {
        return new Response(
          JSON.stringify({ error: "repo and branch required" }),
          { status: 400 },
        );
      }
      const res = await fetch(
        `${GITHUB_API}/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
        { method: "DELETE", headers: ghHeaders(token) },
      );
      if (res.status === 204) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "merge") {
      const { repo, base, head, commit_message } = await request.json();
      if (!repo || !base || !head) {
        return new Response(
          JSON.stringify({ error: "repo, base, and head required" }),
          { status: 400 },
        );
      }
      const res = await fetch(`${GITHUB_API}/repos/${repo}/merges`, {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ base, head, commit_message }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "create-branch") {
      const { repo, branch, from_sha } = await request.json();
      if (!repo || !branch || !from_sha) {
        return new Response(
          JSON.stringify({ error: "repo, branch, and from_sha required" }),
          { status: 400 },
        );
      }
      const res = await fetch(`${GITHUB_API}/repos/${repo}/git/refs`, {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: from_sha }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "delete-repo") {
      const { repo } = await request.json();
      if (!repo) {
        return new Response(JSON.stringify({ error: "repo required" }), {
          status: 400,
        });
      }
      const res = await fetch(`${GITHUB_API}/repos/${repo}`, {
        method: "DELETE",
        headers: ghHeaders(token),
      });
      if (res.status === 204) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify(data), { status: res.status });
    }

    if (action === "merge-pr") {
      const { repo, pull_number, merge_method } = await request.json();
      if (!repo || !pull_number) {
        return new Response(
          JSON.stringify({ error: "repo and pull_number required" }),
          { status: 400 },
        );
      }
      const res = await fetch(
        `${GITHUB_API}/repos/${repo}/pulls/${pull_number}/merge`,
        {
          method: "PUT",
          headers: { ...ghHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({ merge_method: merge_method || "merge" }),
        },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
