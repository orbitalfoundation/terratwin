import { useEffect, useRef } from "react";

interface SimulationChartsViewProps {
  stats: any;
  currentDay: number;
  className?: string;
}

export default function SimulationChartsView({ stats, currentDay, className = "" }: SimulationChartsViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !stats) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!stats.days || stats.days.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet - start the simulation', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Calculate yearly data
    const yearlyData = calculateYearlyData(stats);

    // Chart dimensions
    const chartTop = 40;
    const chartBottom = canvas.height - 80;
    const chartHeight = chartBottom - chartTop;
    const chartLeft = 80;
    const chartRight = canvas.width - 40;
    const chartWidth = chartRight - chartLeft;

    // Draw background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(chartLeft, chartTop, chartWidth, chartHeight);

    // Draw grid
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let i = 0; i <= 5; i++) {
      const y = chartTop + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }

    // Vertical lines (years)
    for (let i = 0; i <= 20; i++) {
      const x = chartLeft + (i / 20) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();
    }

    // Define metrics to plot
    const metrics = [
      { data: yearlyData.bambooHeight, color: '#22c55e', label: 'Bamboo Height (m)', scale: 1 },
      { data: yearlyData.coffeeHeight, color: '#a855f7', label: 'Coffee Height (m)', scale: 10 },
      { data: yearlyData.bambooHarvested, color: '#f59e0b', label: 'Bamboo Harvested/yr', scale: 0.1 },
      { data: yearlyData.coffeeHarvested, color: '#ec4899', label: 'Coffee kg/yr', scale: 0.1 },
      { data: yearlyData.netIncome, color: '#3b82f6', label: 'Net Income ($)', scale: 0.001 },
    ];

    // Find max value for scaling
    let maxValue = 0;
    metrics.forEach(metric => {
      metric.data.forEach((value: number) => {
        maxValue = Math.max(maxValue, Math.abs(value * metric.scale));
      });
    });

    if (maxValue === 0) maxValue = 100;

    // Draw metrics
    metrics.forEach(metric => {
      ctx.strokeStyle = metric.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < metric.data.length; i++) {
        const x = chartLeft + (i / 20) * chartWidth;
        const scaledValue = metric.data[i] * metric.scale;
        const y = chartTop + chartHeight - (scaledValue / maxValue) * chartHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // Draw axes labels
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue * (5 - i) / 5);
      const y = chartTop + (i / 5) * chartHeight;
      ctx.fillText(value.toFixed(0), chartLeft - 10, y + 4);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 20; i += 5) {
      const x = chartLeft + (i / 20) * chartWidth;
      ctx.fillText(i.toString(), x, chartBottom + 20);
    }

    // Current year indicator
    if (currentDay > 0) {
      const currentYear = currentDay / 365;
      const x = chartLeft + (currentYear / 20) * chartWidth;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };

  }, [stats, currentDay]);

  const calculateYearlyData = (stats: any) => {
    const yearlyData = {
      years: [] as number[],
      bambooHeight: [] as number[],
      coffeeHeight: [] as number[],
      bambooHarvested: [] as number[],
      coffeeHarvested: [] as number[],
      netIncome: [] as number[],
    };

    if (!stats.days || stats.days.length === 0) return yearlyData;

    let currentYear = 0;
    let lastHarvest = 0;
    let lastValue = 0;
    let lastCost = 0;
    let lastCoffeeKg = 0;

    for (let i = 0; i < stats.days.length; i++) {
      const day = stats.days[i];
      const year = Math.floor(day / 365);

      if (year > currentYear || i === stats.days.length - 1) {
        const yearEndIndex = (i === stats.days.length - 1) ? i : i - 1;

        if (yearEndIndex >= 0) {
          const yearHarvest = (stats.totalHarvest?.[yearEndIndex] || 0) - lastHarvest;
          const yearValue = (stats.economicYield?.[yearEndIndex] || 0) - lastValue;
          const yearCost = ((stats.energyCostJoules?.[yearEndIndex] || 0) - lastCost) / 1000000 * 0.0278;
          const yearCoffeeKg = ((stats.coffeeHarvested?.[yearEndIndex] || 0) - lastCoffeeKg);

          yearlyData.years.push(currentYear);
          yearlyData.bambooHeight.push(stats.totalGrowth?.[yearEndIndex] || 0);
          yearlyData.coffeeHeight.push(stats.coffeeHeight?.[yearEndIndex] || 0);
          yearlyData.bambooHarvested.push(yearHarvest);
          yearlyData.coffeeHarvested.push(yearCoffeeKg);
          yearlyData.netIncome.push(yearValue - yearCost);

          lastHarvest = stats.totalHarvest?.[yearEndIndex] || 0;
          lastValue = stats.economicYield?.[yearEndIndex] || 0;
          lastCost = stats.energyCostJoules?.[yearEndIndex] || 0;
          lastCoffeeKg = stats.coffeeHarvested?.[yearEndIndex] || 0;
        }

        currentYear = year;
      }
    }

    return yearlyData;
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full bg-gray-900 rounded"
        style={{ height: '400px' }}
        data-testid="simulation-charts-canvas"
      />
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
          <span>Bamboo Height</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
          <span>Coffee Height (×10)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
          <span>Bamboo Harvest (÷10)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-pink-500 rounded mr-2"></div>
          <span>Coffee kg (÷10)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
          <span>Net Income (÷1000)</span>
        </div>
      </div>
    </div>
  );
}