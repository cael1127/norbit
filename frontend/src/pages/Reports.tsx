import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function Reports() {
  const { data: leadReport } = useQuery({
    queryKey: ['lead-report'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/leads');
      return response.data.data;
    },
  });

  const { data: workflowReport } = useQuery({
    queryKey: ['workflow-report'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/workflows');
      return response.data.data;
    },
  });

  const statusData =
    leadReport?.statusBreakdown?.map((item: any) => ({
      status: item.status,
      count: item._count,
    })) || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Lead Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Workflow Performance</h2>
          {workflowReport && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Runs</p>
                <p className="text-2xl font-bold">{workflowReport.totalRuns}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">{workflowReport.successRate}%</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
