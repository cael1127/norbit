import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/dashboard');
      return response.data.data;
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const metrics = data?.metrics || {};

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Leads</h3>
          <p className="text-3xl font-bold mt-2">{metrics.totalLeads || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">New Leads</h3>
          <p className="text-3xl font-bold mt-2">{metrics.newLeads || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Qualified Leads</h3>
          <p className="text-3xl font-bold mt-2">{metrics.qualifiedLeads || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Conversion Rate</h3>
          <p className="text-3xl font-bold mt-2">{metrics.conversionRate || 0}%</p>
        </div>
      </div>
    </div>
  );
}
