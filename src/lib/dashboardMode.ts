export const dashboardEnabled =
  import.meta.env.PUBLIC_ENABLE_DASHBOARD === "true";

export function createDashboardDisabledResponse() {
  return new Response(
    JSON.stringify({
      error: "Dashboard is disabled in this build.",
      dashboardEnabled: false,
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
}
