import { Link, useLocation } from "wouter";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatInterface from "./chat-interface";
import { useStory } from "@/hooks/use-story";

export default function Navigation() {
  const [location] = useLocation();
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const { startStory, isActive: isStoryActive } = useStory();

  return (
    <>
      <nav className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" data-testid="link-home">
                <div className="text-xl font-semibold tracking-tight text-primary hover:text-accent transition-colors">
                  TerraTwin
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={startStory}
                disabled={isStoryActive}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                title="Tell Our Story"
              >
                <BookOpen className="h-5 w-5" />
              </Button>
              <ChatInterface 
                isExpanded={isChatExpanded}
                onToggle={() => setIsChatExpanded(!isChatExpanded)}
              />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
