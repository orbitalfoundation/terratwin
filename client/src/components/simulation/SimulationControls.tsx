import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipForward, RotateCcw, Calendar } from "lucide-react";

interface SimulationControlsProps {
  isRunning: boolean;
  currentDay: number;
  speed: number;
  onStart: () => void;
  onPause: () => void;
  onStep: (days: number) => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

export default function SimulationControls({
  isRunning,
  currentDay,
  speed,
  onStart,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
}: SimulationControlsProps) {
  const currentYear = Math.floor(currentDay / 365);
  const dayInYear = currentDay % 365;

  return (
    <div className="p-4 bg-card border-border rounded-lg space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-primary">Simulation Controls</h3>
        
        {/* Time Display */}
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Day:</span>
            <span className="font-medium" data-testid="text-current-day">{currentDay}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Year:</span>
            <span className="font-medium" data-testid="text-current-year">{currentYear}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Day in Year:</span>
            <span className="font-medium">{dayInYear + 1}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button 
            onClick={isRunning ? onPause : onStart}
            className={isRunning ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}
            data-testid={isRunning ? "button-pause" : "button-start"}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start
              </>
            )}
          </Button>
          
          <Button 
            onClick={onReset}
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            data-testid="button-reset"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          
          <Button 
            onClick={() => onStep(1)}
            variant="outline"
            disabled={isRunning}
            data-testid="button-step-day"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Step Day
          </Button>
          
          <Button 
            onClick={() => onStep(365)}
            variant="outline"
            disabled={isRunning}
            data-testid="button-step-year"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Step Year
          </Button>
        </div>

        {/* Speed Control */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Simulation Speed</span>
            <span className="text-sm font-medium" data-testid="text-speed-value">{speed}x</span>
          </div>
          <Slider
            value={[speed]}
            onValueChange={(value) => onSpeedChange(value[0])}
            max={10}
            min={1}
            step={1}
            className="w-full"
            data-testid="slider-speed"
          />
        </div>
      </div>
    </div>
  );
}