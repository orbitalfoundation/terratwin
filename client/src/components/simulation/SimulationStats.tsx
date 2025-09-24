interface SimulationStatsProps {
  stats: {
    avgBambooHeight: number;
    avgCoffeeHeight: number;
    cumulativeHarvest: number;
    cumulativeValue: number;
    cumulativeCO2: number;
    culmCount: number;
    coffeePlantCount: number;
  };
}

export default function SimulationStats({ stats }: SimulationStatsProps) {
  return (
    <div className="p-4 bg-card border-border rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-primary">Live Statistics</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bamboo Height:</span>
          <span className="font-medium" data-testid="text-bamboo-height">
            {stats.avgBambooHeight.toFixed(1)}m
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coffee Height:</span>
          <span className="font-medium" data-testid="text-coffee-height">
            {stats.avgCoffeeHeight.toFixed(1)}m
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bamboo Culms:</span>
          <span className="font-medium" data-testid="text-culm-count">
            {stats.culmCount}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coffee Plants:</span>
          <span className="font-medium" data-testid="text-coffee-count">
            {stats.coffeePlantCount}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Harvested:</span>
          <span className="font-medium" data-testid="text-harvested">
            {stats.cumulativeHarvest.toFixed(0)}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Value:</span>
          <span className="font-medium text-green-600" data-testid="text-value">
            ${stats.cumulativeValue.toFixed(0)}
          </span>
        </div>
        
        <div className="flex justify-between col-span-2">
          <span className="text-muted-foreground">CO2 Sequestered:</span>
          <span className="font-medium text-green-600" data-testid="text-co2">
            {stats.cumulativeCO2.toFixed(0)} kg
          </span>
        </div>
      </div>
    </div>
  );
}