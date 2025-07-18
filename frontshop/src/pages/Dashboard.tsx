
import { useEffect, useState } from "react";
import { fetchDashboardData } from "@/lib/fetchDashboardData";

// TEMP: Replace this with the actual `analyticsFileId` from upload or file selector
const STATIC_ANALYTICS_FILE_ID = "file_12345678";

const Dashboard = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData(STATIC_ANALYTICS_FILE_ID)
      .then(setAnalyticsData)
      .catch((err) => console.error("Dashboard error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center py-10">Loading dashboard...</p>;
  if (!analyticsData) return <p className="text-red-500">No data available.</p>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">📊 Dashboard Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {analyticsData.kpis?.map((kpi: any, i: number) => (
          <div key={i} className="p-4 bg-white border shadow rounded">
            <div className="text-sm text-gray-500">{kpi.title}</div>
            <div className="text-2xl font-semibold">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">🧠 Recommendations</h2>
        <ul className="list-disc ml-6 text-gray-700">
          {analyticsData.recommendations?.map((rec: string, i: number) => (
            <li key={i}>{rec}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">📈 Raw Chart Data</h2>
        <pre className="bg-gray-100 text-xs p-4 rounded overflow-x-auto">
          {JSON.stringify(analyticsData.charts, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default Dashboard;
