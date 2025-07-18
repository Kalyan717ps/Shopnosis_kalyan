export const fetchDashboardData = async (analyticsFileId: string) => {
  const res = await fetch(`http://localhost:8080/api/v1/dashboard/${analyticsFileId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({}) // optional: filters
  });

  if (!res.ok) {
    throw new Error("Failed to fetch analytics");
  }

  return res.json(); // { kpis, charts, recommendations, layout }
}; 