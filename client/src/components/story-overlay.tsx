import { useEffect, useState } from "react";
import { useStory } from "@/hooks/use-story";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX } from "lucide-react";

export function StoryOverlay() {
  const { 
    isActive, 
    currentCaption, 
    progress, 
    stopStory,
    isSpeaking,
    toggleSpeech 
  } = useStory();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[100] transition-all duration-300",
        isActive ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
    >
      <div className="bg-background/95 backdrop-blur-sm border-t border-border shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-lg leading-relaxed text-foreground">
                {currentCaption}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Step {progress.current} of {progress.total}
                </div>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSpeech}
                className="h-8 w-8"
              >
                {isSpeaking ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={stopStory}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
