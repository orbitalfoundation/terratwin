import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Minimize2, Mic, MicOff } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  isExpanded: boolean;
  onToggle: () => void;
}

interface AgenticChatResponse {
  type: 'conversation' | 'action';
  message: string;
  action?: {
    type: 'goto_plot' | 'start_simulation' | 'pause_simulation' | 'reset_simulation';
    data?: any;
  };
}

export default function ChatInterface({ isExpanded, onToggle }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showInitialAnimation, setShowInitialAnimation] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [location, setLocation] = useLocation();


  // Get current plot ID from location if on plot detail page
  const currentPlotId = location.startsWith('/plots/') && location !== '/plots/new' 
    ? location.split('/')[2] 
    : undefined;

  // Get all plots for context
  const { data: plots = [] } = useQuery<any[]>({
    queryKey: ["/api/plots"],
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setSpeechSupported(true);
      
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // Don't show error for user cancellation
        if (event.error !== 'aborted' && event.error !== 'not-allowed') {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'Sorry, I had trouble hearing you. Please try again or type your message.',
              timestamp: new Date(),
            },
          ]);
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Handle initial animation
  useEffect(() => {
    // Ensure animation starts fresh on mount
    setShowInitialAnimation(true);
    console.log('🎬 ChatInterface: Starting pulse animation');
    
    // Stop the animation after 5 seconds (3 pulses × 1.5s each + buffer)
    const timer = setTimeout(() => {
      setShowInitialAnimation(false);
      console.log('⏹️ ChatInterface: Stopping pulse animation');
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Simulation control reference (will be passed in from parent)
  const simulationRef = useRef<any>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      // Determine current page context
      let currentPage = 'dashboard';
      if (location === '/plots/new') currentPage = 'add-plot';
      else if (location.startsWith('/plots/')) currentPage = 'plot-detail';

      // Prepare context for the LLM
      const context = {
        currentPage,
        currentPlotId,
        availablePlots: plots.map((plot: any) => ({
          id: plot.id,
          name: plot.name,
          status: plot.status
        }))
      };

      const response = await apiRequest('POST', '/api/chat', { 
        message, 
        context 
      });
      return response.json();
    },
    onSuccess: (response: AgenticChatResponse) => {
      // Add the assistant's message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        },
      ]);

      // Handle actions if present
      if (response.type === 'action' && response.action) {
        handleAction(response.action);
      }
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

  // Action handler for LLM actions
  const handleAction = (action: AgenticChatResponse['action']) => {
    if (!action) return;

    switch (action.type) {
      case 'goto_plot':
        if (action.data?.plotId) {
          setLocation(`/plots/${action.data.plotId}`);
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `✅ Navigated to ${action.data.plotName || 'plot'}.`,
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case 'start_simulation':
        // Find the simulation component via DOM query or global reference
        // This is a bit hacky but works for the current setup
        const startButton = document.querySelector('[data-testid="button-start-simulation"]') as HTMLButtonElement;
        if (startButton) {
          startButton.click();
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: '🎬 Simulation started!',
              timestamp: new Date(),
            },
          ]);
        } else {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'Unable to start simulation. Make sure you are on a plot detail page.',
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case 'pause_simulation':
        const pauseButton = document.querySelector('[data-testid="button-pause-simulation"]') as HTMLButtonElement;
        if (pauseButton) {
          pauseButton.click();
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: '⏸️ Simulation paused.',
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case 'reset_simulation':
        const resetButton = document.querySelector('[data-testid="button-reset-simulation"]') as HTMLButtonElement;
        if (resetButton) {
          resetButton.click();
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: '🔄 Simulation reset.',
              timestamp: new Date(),
            },
          ]);
        }
        break;

      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  const handleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Voice input is not supported in this browser. Please type your message instead.',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Unable to start voice input. Please check your microphone permissions.',
            timestamp: new Date(),
          },
        ]);
      }
    }
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
        className={`text-muted-foreground hover:text-primary ${showInitialAnimation ? 'chat-pulse' : ''}`}
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
            placeholder={isListening ? "Listening..." : "Ask about your plots..."}
            className="flex-1 text-sm"
            disabled={chatMutation.isPending || isListening}
            data-testid="input-chat-message"
          />
          {speechSupported && (
            <Button
              type="button"
              size="sm"
              variant={isListening ? "default" : "outline"}
              onClick={handleVoiceInput}
              disabled={chatMutation.isPending}
              className={isListening ? "animate-pulse" : ""}
              data-testid="button-voice-input"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || chatMutation.isPending || isListening}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}