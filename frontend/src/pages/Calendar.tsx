import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format } from 'date-fns';

export default function Calendar() {
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const response = await apiClient.get('/calendar/events');
      return response.data.data.events;
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Calendar</h1>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
        </div>
        <div className="divide-y">
          {data?.map((event: any) => (
            <div key={event.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{event.title}</h3>
                  {event.lead && (
                    <p className="text-sm text-gray-500 mt-1">
                      {event.lead.firstName} {event.lead.lastName} - {event.lead.company}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {format(new Date(event.startTime), 'PPp')}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs rounded bg-gray-100">
                  {event.status}
                </span>
              </div>
              {event.meetingLink && (
                <a
                  href={event.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:underline mt-2 inline-block"
                >
                  Join Meeting
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
