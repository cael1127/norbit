import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  conversationId: string;
}

export default function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    // Load messages
    loadMessages();

    // Connect to socket
    if (token) {
      const socket = io('http://localhost:3001', {
        auth: { token },
      });

      socket.emit('conversation:join', conversationId);

      socket.on('message:new', (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });

      socket.on('message:stream', (data: { chunk: string; fullResponse: string }) => {
        setStreamingMessage(data.fullResponse);
      });

      socket.on('message:complete', () => {
        if (streamingMessage) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: streamingMessage,
              createdAt: new Date().toISOString(),
            },
          ]);
          setStreamingMessage('');
        }
        setIsLoading(false);
      });

      socket.on('message:error', (data: { error: string }) => {
        toast.error(data.error);
        setIsLoading(false);
      });

      socketRef.current = socket;

      return () => {
        socket.emit('conversation:leave', conversationId);
        socket.disconnect();
      };
    }
  }, [conversationId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const loadMessages = async () => {
    try {
      const response = await apiClient.get(`/conversations/${conversationId}/messages`);
      setMessages(response.data.data.messages);
    } catch (error: any) {
      toast.error('Failed to load messages');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      await apiClient.post(`/conversations/${conversationId}/messages`, {
        content: userMessage,
        role: 'user',
      });
    } catch (error: any) {
      toast.error('Failed to send message');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 text-gray-900">
              <p className="text-sm">{streamingMessage}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
