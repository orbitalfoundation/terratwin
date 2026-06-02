// @refresh reset
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import type { Plot } from "@shared/schema";
import { isLocalMode } from "@/lib/config";

interface StoryStep {
  id: number;
  caption: string;
  duration: number; // in milliseconds
  action?: () => void | Promise<void>;
}

interface StoryContextType {
  isActive: boolean;
  currentCaption: string;
  progress: { current: number; total: number };
  startStory: () => void;
  stopStory: () => void;
  isSpeaking: boolean;
  toggleSpeech: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export function StoryProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<Map<string, string>>(new Map());
  const isActiveRef = useRef(false);

  const storySteps: StoryStep[] = [
    {
      id: 1,
      caption: "Welcome to our demo of TerraTwin. We are building a civic coordination tool that can be used by real people to help solve real problems.",
      duration: 8000,
      action: () => {
        setLocation("/");
      }
    },
    {
      id: 2,
      caption: "In this example, Bamboo Farmers in Mindanao, Philippines are growing Dendrocalamus asper, also known as giant bamboo or dragon bamboo, a giant tropical clumping species native to Southeast Asia.",
      duration: 10000,
    },
    {
      id: 3,
      caption: "Growing giant bamboo provides substantial economic benefits, including faster income due to rapid growth, job creation in rural areas, and access to high-value markets for construction, bioenergy, and crafts.",
      duration: 10000,
    },
    {
      id: 4,
      caption: "Our model allows regional bamboo farmers to test interventions in a user-friendly way and communicate with stakeholders. Communication is key for getting funding and buy-in, especially for smaller farming operations.",
      duration: 10000,
    },
    {
      id: 5,
      caption: "On the farmer dashboard we can see their registered plots, with a birds-eye view of the farming region. The data sets are presented using the NASA Tile Renderer with data from Cesium.",
      duration: 8000,
      action: () => {
        setLocation("/");
        // Scroll to map if needed
        setTimeout(() => {
          document.querySelector('[data-testid="dashboard-map-component"]')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
    },
    {
      id: 6,
      caption: "We can also edit the plot properties. We determine many properties automatically from bioregional satellite data, but farmers can also set specific soil conditions, pests and interventions.",
      duration: 10000,
      action: async () => {
        // Navigate to first plot detail
        const plots = queryClient.getQueryData<Plot[]>(["/api/plots"]);
        if (plots && plots.length > 0) {
          setLocation(`/plots/${plots[0].id}`);
        }
      }
    },
    {
      id: 7,
      caption: "We can simulate plot growth over 20 years, modeling costs, economic rewards, CO2 capture and other factors. The simulation is an agent-based model running at one step per day, with data from Terrarium, ArcGIS, Sentinel-2 and USGS.",
      duration: 12000,
      action: () => {
        // Scroll to simulation section
        setTimeout(() => {
          const simElement = document.querySelector('.bamboo-sim-wrapper-component');
          if (simElement) {
            simElement.scrollIntoView({ behavior: 'smooth' });
          }
        }, 1000);
      }
    },
    {
      id: 8,
      caption: "In later versions, we will support overall health maps of the bioregion, as well as on-the-ground measurements, reporting and verification logging of bamboo and ecosystem health.",
      duration: 8000,
    },
    {
      id: 9,
      caption: "Thank you for your time and we look forward to your support.",
      duration: 5000,
      action: () => {
        setLocation("/");
      }
    }
  ];

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!isSpeaking) return;

    if (isLocalMode) {
      // Web Speech API — no server required
      return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }

    // Server mode: OpenAI TTS via /api/tts
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    try {
      const cachedUrl = audioUrlsRef.current.get(text);
      let audioUrl: string;

      if (cachedUrl) {
        audioUrl = cachedUrl;
      } else {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          console.error("TTS API error:", response.statusText);
          return;
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        audioUrlsRef.current.set(text, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      return new Promise((resolve) => {
        audio.addEventListener('ended', () => resolve());
        audio.addEventListener('error', () => {
          console.error('Audio playback error');
          resolve();
        });
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          resolve();
        });
      });
    } catch (error) {
      console.error("Error in TTS:", error);
    }
  }, [isSpeaking]);

  const stopSpeech = useCallback(() => {
    if (isLocalMode) {
      window.speechSynthesis.cancel();
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  const runStep = useCallback(async (stepIndex: number) => {
    if (stepIndex >= storySteps.length) {
      stopStory();
      return;
    }

    const step = storySteps[stepIndex];
    setCurrentStep(stepIndex);
    setCurrentCaption(step.caption);
    
    // Execute the action if any
    if (step.action) {
      await step.action();
    }

    // Speak the caption and wait for completion if speaking
    if (isSpeaking) {
      await speak(step.caption);
      // Add a small delay after speech completes
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      // If not speaking, use the original duration
      await new Promise(resolve => {
        timeoutRef.current = setTimeout(resolve, step.duration);
      });
    }

    // Move to next step only if story is still active
    if (isActiveRef.current) {
      runStep(stepIndex + 1);
    }
  }, [speak, storySteps, isSpeaking]);

  const startStory = useCallback(() => {
    setIsActive(true);
    isActiveRef.current = true;
    setCurrentStep(0);
    runStep(0);
  }, [runStep]);

  const stopStory = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    setCurrentCaption("");
    setCurrentStep(0);
    stopSpeech();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, [stopSpeech]);

  const toggleSpeech = useCallback(() => {
    setIsSpeaking(prev => {
      if (prev) {
        stopSpeech();
      } else if (currentCaption) {
        // Re-speak current caption
        speak(currentCaption);
      }
      return !prev;
    });
  }, [currentCaption, speak, stopSpeech]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopSpeech();
      // Clean up cached audio URLs
      audioUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      audioUrlsRef.current.clear();
    };
  }, [stopSpeech]);

  const value: StoryContextType = {
    isActive,
    currentCaption,
    progress: { current: currentStep + 1, total: storySteps.length },
    startStory,
    stopStory,
    isSpeaking,
    toggleSpeech,
  };

  return (
    <StoryContext.Provider value={value}>
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error("useStory must be used within a StoryProvider");
  }
  return context;
}
