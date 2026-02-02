import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ChatInterface from '../components/ChatInterface';
import toast from 'react-hot-toast';

export default function Conversations() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await apiClient.get('/conversations');
      return response.data.data.conversations;
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/conversations', {});
      return response.data.data.conversation;
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedConversationId(conversation.id);
    },
    onError: () => {
      toast.error('Failed to create conversation');
    },
  });

  return (
    <div className="p-6 h-[calc(100vh-8rem)] flex">
      <div className="w-64 border-r pr-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <button
            onClick={() => createConversationMutation.mutate()}
            className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
          >
            New
          </button>
        </div>
        <div className="space-y-2">
          {conversations?.map((conv: any) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversationId(conv.id)}
              className={`w-full text-left px-3 py-2 rounded ${
                selectedConversationId === conv.id
                  ? 'bg-primary-100 text-primary-900'
                  : 'hover:bg-gray-100'
              }`}
            >
              <p className="text-sm font-medium truncate">
                {conv.title || `Conversation ${conv.id.slice(0, 8)}`}
              </p>
              {conv.messages?.[0] && (
                <p className="text-xs text-gray-500 truncate mt-1">
                  {conv.messages[0].content}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 ml-4">
        {selectedConversationId ? (
          <div className="h-full border rounded-lg">
            <ChatInterface conversationId={selectedConversationId} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a conversation or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
