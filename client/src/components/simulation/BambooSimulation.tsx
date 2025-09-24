import { useState, useCallback, useRef, useEffect, Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import SimulationControls from "./SimulationControls";
import SimulationStats from "./SimulationStats";
import SimulationChartsView from "./SimulationChartsView";

// Lazy import 3D view to avoid loading Three.js unless needed
const Simulation3DView = lazy(() => import("./Simulation3DView"));

interface BambooSimulationProps {
  plotId?: string;
  className?: string;
}

interface SimulationState {
  isRunning: boolean;
  currentDay: number;
  speed: number;
  plot: any;
  stats: {
    avgBambooHeight: number;
    avgCoffeeHeight: number;
    cumulativeHarvest: number;
    cumulativeValue: number;
    cumulativeCO2: number;
    culmCount: number;
    coffeePlantCount: number;
    // Time series data
    days: number[];
    totalGrowth: number[];
    totalHarvest: number[];
    economicYield: number[];
    co2Sequestered: number[];
    energyCostJoules: number[];
    coffeeHeight: number[];
    coffeeHarvested: number[];
  };
}

export default function BambooSimulation({ plotId, className = "" }: BambooSimulationProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    currentDay: 0,
    speed: 1,
    plot: null,
    stats: {
      avgBambooHeight: 0,
      avgCoffeeHeight: 0,
      cumulativeHarvest: 0,
      cumulativeValue: 0,
      cumulativeCO2: 0,
      culmCount: 0,
      coffeePlantCount: 0,
      days: [],
      totalGrowth: [],
      totalHarvest: [],
      economicYield: [],
      co2Sequestered: [],
      energyCostJoules: [],
      coffeeHeight: [],
      coffeeHarvested: [],
    },
  });

  const simulationIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const simulationEngineRef = useRef<any>();

  // Initialize simulation engine
  useEffect(() => {
    const initializeSimulation = async () => {
      try {
        // Import the simulation modules dynamically
        // Note: This is a simplified version - in reality we'd need to adapt
        // the standalone simulation code to work with React state
        console.log('Initializing bamboo simulation...');
        
        // TODO: Integrate with the actual standalone simulation logic
        // For now, we'll create a basic simulation state
        const mockPlot = {
          id: plotId || 'default',
          field: { width: 100, depth: 100 },
          children: [],
          stats: state.stats,
        };

        setState(prev => ({
          ...prev,
          plot: mockPlot,
        }));

      } catch (error) {
        console.error('Failed to initialize simulation:', error);
      }
    };

    initializeSimulation();

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [plotId]);

  const handleStart = useCallback(() => {
    if (state.isRunning) return;

    setState(prev => ({ ...prev, isRunning: true }));
    
    // Start simulation loop
    const startLoop = () => {
      simulationIntervalRef.current = setInterval(() => {
        setState(prev => {
          const newDay = prev.currentDay + 1;
          
          // Cap arrays at 7300 entries (20 years * 365 days) to prevent memory bloat
          const maxEntries = 7300;
          const capArray = (arr: any[]) => arr.length >= maxEntries ? arr.slice(-maxEntries + 1) : arr;
          
          // Mock simulation updates - in reality this would call the simulation engine
          const newStats = {
            ...prev.stats,
            avgBambooHeight: prev.stats.avgBambooHeight + 0.01,
            avgCoffeeHeight: prev.stats.avgCoffeeHeight + 0.005,
            cumulativeHarvest: prev.stats.cumulativeHarvest + (newDay % 365 === 0 ? 10 : 0),
            cumulativeValue: prev.stats.cumulativeValue + (newDay % 365 === 0 ? 100 : 1),
            cumulativeCO2: prev.stats.cumulativeCO2 + 0.5,
            culmCount: prev.stats.culmCount + (newDay % 30 === 0 ? 1 : 0),
            coffeePlantCount: prev.stats.coffeePlantCount + (newDay % 60 === 0 ? 1 : 0),
            days: capArray([...prev.stats.days, newDay]),
            totalGrowth: capArray([...prev.stats.totalGrowth, prev.stats.avgBambooHeight + 0.01]),
            totalHarvest: capArray([...prev.stats.totalHarvest, prev.stats.cumulativeHarvest]),
            economicYield: capArray([...prev.stats.economicYield, prev.stats.cumulativeValue]),
            co2Sequestered: capArray([...prev.stats.co2Sequestered, prev.stats.cumulativeCO2]),
            energyCostJoules: capArray([...prev.stats.energyCostJoules, newDay * 1000]),
            coffeeHeight: capArray([...prev.stats.coffeeHeight, prev.stats.avgCoffeeHeight + 0.005]),
            coffeeHarvested: capArray([...prev.stats.coffeeHarvested, Math.floor(newDay / 365) * 50]),
          };

          return {
            ...prev,
            currentDay: newDay,
            stats: newStats,
          };
        });
      }, Math.max(100, 1000 / state.speed));
    };

    startLoop();
  }, [state.isRunning, state.speed]);

  const handlePause = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: false }));
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
  }, []);

  const handleStep = useCallback((days: number) => {
    setState(prev => {
      const newDay = prev.currentDay + days;
      
      // Mock simulation step
      const newStats = {
        ...prev.stats,
        avgBambooHeight: prev.stats.avgBambooHeight + (days * 0.01),
        avgCoffeeHeight: prev.stats.avgCoffeeHeight + (days * 0.005),
        cumulativeHarvest: prev.stats.cumulativeHarvest + Math.floor(days / 365) * 10,
        cumulativeValue: prev.stats.cumulativeValue + (days * 1),
        cumulativeCO2: prev.stats.cumulativeCO2 + (days * 0.5),
        culmCount: prev.stats.culmCount + Math.floor(days / 30),
        coffeePlantCount: prev.stats.coffeePlantCount + Math.floor(days / 60),
      };

      return {
        ...prev,
        currentDay: newDay,
        stats: newStats,
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    
    setState({
      isRunning: false,
      currentDay: 0,
      speed: 1,
      plot: state.plot, // Keep the plot configuration
      stats: {
        avgBambooHeight: 0,
        avgCoffeeHeight: 0,
        cumulativeHarvest: 0,
        cumulativeValue: 0,
        cumulativeCO2: 0,
        culmCount: 0,
        coffeePlantCount: 0,
        days: [],
        totalGrowth: [],
        totalHarvest: [],
        economicYield: [],
        co2Sequestered: [],
        energyCostJoules: [],
        coffeeHeight: [],
        coffeeHarvested: [],
      },
    });
  }, [state.plot]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setState(prev => ({ ...prev, speed: newSpeed }));
    
    // Restart interval with new speed if running
    if (state.isRunning && simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      // Start new interval with updated speed
      simulationIntervalRef.current = setInterval(() => {
        setState(prev => {
          const newDay = prev.currentDay + 1;
          
          // Cap arrays at 7300 entries (20 years * 365 days) to prevent memory bloat
          const maxEntries = 7300;
          const capArray = (arr: any[]) => arr.length >= maxEntries ? arr.slice(-maxEntries + 1) : arr;
          
          const newStats = {
            ...prev.stats,
            avgBambooHeight: prev.stats.avgBambooHeight + 0.01,
            avgCoffeeHeight: prev.stats.avgCoffeeHeight + 0.005,
            cumulativeHarvest: prev.stats.cumulativeHarvest + (newDay % 365 === 0 ? 10 : 0),
            cumulativeValue: prev.stats.cumulativeValue + (newDay % 365 === 0 ? 100 : 1),
            cumulativeCO2: prev.stats.cumulativeCO2 + 0.5,
            culmCount: prev.stats.culmCount + (newDay % 30 === 0 ? 1 : 0),
            coffeePlantCount: prev.stats.coffeePlantCount + (newDay % 60 === 0 ? 1 : 0),
            days: capArray([...prev.stats.days, newDay]),
            totalGrowth: capArray([...prev.stats.totalGrowth, prev.stats.avgBambooHeight + 0.01]),
            totalHarvest: capArray([...prev.stats.totalHarvest, prev.stats.cumulativeHarvest]),
            economicYield: capArray([...prev.stats.economicYield, prev.stats.cumulativeValue]),
            co2Sequestered: capArray([...prev.stats.co2Sequestered, prev.stats.cumulativeCO2]),
            energyCostJoules: capArray([...prev.stats.energyCostJoules, newDay * 1000]),
            coffeeHeight: capArray([...prev.stats.coffeeHeight, prev.stats.avgCoffeeHeight + 0.005]),
            coffeeHarvested: capArray([...prev.stats.coffeeHarvested, Math.floor(newDay / 365) * 50]),
          };

          return {
            ...prev,
            currentDay: newDay,
            stats: newStats,
          };
        });
      }, Math.max(100, 1000 / newSpeed));
    }
  }, [state.isRunning]);

  return (
    <div className={`w-full h-full ${className}`}>
      <Tabs 
        defaultValue="overview" 
        className="w-full h-full flex flex-col"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-trigger-overview">Overview</TabsTrigger>
          <TabsTrigger value="3d" data-testid="tab-trigger-3d">3D View</TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-trigger-charts">Charts</TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-trigger-controls">Controls</TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-4">
          <TabsContent value="overview" className="h-full" data-testid="tab-content-overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Controls */}
              <div className="lg:col-span-1">
                <SimulationControls
                  isRunning={state.isRunning}
                  currentDay={state.currentDay}
                  speed={state.speed}
                  onStart={handleStart}
                  onPause={handlePause}
                  onStep={handleStep}
                  onReset={handleReset}
                  onSpeedChange={handleSpeedChange}
                />
                
                <div className="mt-6">
                  <SimulationStats stats={state.stats} />
                </div>
              </div>

              {/* 3D View Preview */}
              <div className="lg:col-span-2">
                <Card className="h-full">
                  <CardContent className="p-6 h-full">
                    <h3 className="text-lg font-medium mb-4 text-primary">3D Simulation View</h3>
                    <div className="h-[500px]">
                      {(activeTab === "overview" || activeTab === "3d") && (
                        <Suspense 
                          fallback={
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                                <p className="text-sm text-muted-foreground">Loading 3D View...</p>
                              </div>
                            </div>
                          }
                        >
                          <Simulation3DView 
                            plotData={state.plot}
                            className="h-full"
                          />
                        </Suspense>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="3d" className="h-full" data-testid="tab-content-3d">
            <Card className="h-full">
              <CardContent className="p-6 h-full">
                <h3 className="text-lg font-medium mb-4 text-primary">3D Simulation View</h3>
                <div className="h-[600px]">
                  {activeTab === "3d" && (
                    <Suspense 
                      fallback={
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Loading 3D View...</p>
                          </div>
                        </div>
                      }
                    >
                      <Simulation3DView 
                        plotData={state.plot}
                        className="h-full"
                      />
                    </Suspense>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="h-full" data-testid="tab-content-charts">
            <Card className="h-full">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-4 text-primary">Growth & Economic Charts</h3>
                <SimulationChartsView 
                  stats={state.stats}
                  currentDay={state.currentDay}
                  className="h-full"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="controls" className="h-full" data-testid="tab-content-controls">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SimulationControls
                isRunning={state.isRunning}
                currentDay={state.currentDay}
                speed={state.speed}
                onStart={handleStart}
                onPause={handlePause}
                onStep={handleStep}
                onReset={handleReset}
                onSpeedChange={handleSpeedChange}
              />
              
              <SimulationStats stats={state.stats} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}