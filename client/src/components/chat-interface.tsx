import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Minimize2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ChatInterface({ isExpanded, onToggle }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chat', { message });
      return response.json();
    },
    onSuccess: (response) => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error: any) => {
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      // Use structured error message from improved apiRequest
      if (error.body?.message) {
        errorMessage = error.body.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
        },
      ]);
      console.error('Chat error:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(input.trim());
    setInput('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="text-muted-foreground hover:text-primary"
        data-testid="button-expand-chat"
      >
        <MessageCircle className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="fixed top-16 right-4 w-80 bg-card border border-border rounded-lg shadow-lg z-50" data-testid="chat-interface">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-card-foreground">AI Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-minimize-chat"
        >
          <Minimize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-3 space-y-3" data-testid="chat-messages">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm">
            Ask me anything about your bamboo plots!
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid={`message-${message.role}-${index}`}
            >
              <div>{message.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your plots..."
            className="flex-1 text-sm"
            disabled={chatMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || chatMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}