import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export default function Workflows() {
  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const response = await apiClient.get('/workflows');
      return response.data.data.workflows;
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Workflows</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.map((workflow: any) => (
          <div key={workflow.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{workflow.name}</h3>
              <span
                className={`px-2 py-1 text-xs rounded ${
                  workflow.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {workflow.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {workflow.description && (
              <p className="text-sm text-gray-600 mb-4">{workflow.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {workflow._count?.runs || 0} executions
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
