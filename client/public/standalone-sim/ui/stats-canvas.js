export class StatsCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    
    update(stats, currentDay) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        console.log('StatsCanvas update called with:', { 
            statsLength: stats.days?.length || 0, 
            currentDay,
            width,
            height 
        });
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        if (!stats.days || stats.days.length === 0) {
            console.log('No stats data available yet');
            return;
        }
        
        // Calculate yearly data from daily stats
        const yearlyData = this.calculateYearlyData(stats);
        console.log('Yearly data calculated:', yearlyData);
        
        // Draw main chart area
        const chartTop = 40;
        const chartBottom = height - 40; // Less space needed since legend is in HTML
        const chartHeight = chartBottom - chartTop;
        const chartLeft = 60;
        const chartRight = width - 40;
        const chartWidth = chartRight - chartLeft;
        
        // Draw grid and axes
        this.drawGrid(chartLeft, chartTop, chartWidth, chartHeight);
        
        // Define metrics to plot
        const metrics = [
            { data: yearlyData.bambooHeight, color: '#22c55e', label: 'Bamboo Height (m)', scale: 1 },
            { data: yearlyData.coffeeHeight, color: '#a855f7', label: 'Coffee Height (m)', scale: 10 }, // Scale up for visibility
            { data: yearlyData.bambooHarvested, color: '#f59e0b', label: 'Bamboo Harvested/yr', scale: 0.1 },
            { data: yearlyData.coffeeHarvested, color: '#ec4899', label: 'Coffee kg/yr', scale: 0.1 },
            { data: yearlyData.netIncome, color: '#3b82f6', label: 'Net Income ($)', scale: 0.001 },
            { data: yearlyData.totalIncome, color: '#10b981', label: 'Total Income ($)', scale: 0.001 },
            { data: yearlyData.totalCost, color: '#ef4444', label: 'Total Cost ($)', scale: 0.001 },
            { data: yearlyData.co2, color: '#6366f1', label: 'CO2 Sequestered (kg)', scale: 0.0001 }
        ];
        
        // Find max value for scaling
        let maxValue = 0;
        metrics.forEach(metric => {
            metric.data.forEach(value => {
                maxValue = Math.max(maxValue, Math.abs(value * metric.scale));
            });
        });
        
        // Ensure minimum scale
        if (maxValue === 0) maxValue = 100;
        
        // Draw all metrics
        metrics.forEach(metric => {
            this.drawMetric(
                metric.data, 
                chartLeft, 
                chartTop, 
                chartWidth, 
                chartHeight, 
                metric.color, 
                metric.scale,
                maxValue
            );
        });
        
        // Draw axes labels
        this.drawAxes(chartLeft, chartTop, chartWidth, chartHeight, yearlyData.years, maxValue);
        
        // Update HTML legend/table
        this.updateHTMLLegend(metrics, yearlyData);
        
        // Draw current year indicator
        if (currentDay > 0) {
            const currentYear = currentDay / 365;
            const x = chartLeft + (currentYear / 20) * chartWidth; // Assuming 20 year simulation
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, chartTop);
            ctx.lineTo(x, chartBottom);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    calculateYearlyData(stats) {
        const yearlyData = {
            years: [],
            bambooHeight: [],
            coffeeHeight: [],
            bambooHarvested: [],
            coffeeHarvested: [],
            totalIncome: [],
            totalCost: [],
            netIncome: [],
            co2: []
        };
        
        if (!stats.days || stats.days.length === 0) return yearlyData;
        
        let currentYear = 0;
        let yearStartIndex = 0;
        let lastHarvest = 0;
        let lastCO2 = 0;
        let lastValue = 0;
        let lastCost = 0;
        let lastCoffeeKg = 0;
        
        // Process daily data into yearly summaries
        for (let i = 0; i < stats.days.length; i++) {
            const day = stats.days[i];
            const year = Math.floor(day / 365);
            
            // Check if we've moved to a new year or reached the end
            if (year > currentYear || i === stats.days.length - 1) {
                // Find the last day of the completed year (or current day if last iteration)
                const yearEndIndex = (i === stats.days.length - 1) ? i : i - 1;
                
                // Only add data if we have at least some days in this year
                if (yearEndIndex >= yearStartIndex) {
                    // Calculate yearly values
                    const yearHarvest = stats.totalHarvest[yearEndIndex] - lastHarvest;
                    const yearCO2 = stats.co2Sequestered[yearEndIndex] - lastCO2;
                    const yearValue = stats.economicYield[yearEndIndex] - lastValue;
                    const yearCost = (stats.energyCostJoules[yearEndIndex] - lastCost) / 1000000 * 0.0278; // Convert to $
                    const yearCoffeeKg = (stats.coffeeHarvested && stats.coffeeHarvested[yearEndIndex] !== undefined) 
                        ? stats.coffeeHarvested[yearEndIndex] - lastCoffeeKg 
                        : 0;
                    
                    yearlyData.years.push(currentYear);
                    yearlyData.bambooHeight.push(stats.totalGrowth[yearEndIndex] || 0);
                    yearlyData.coffeeHeight.push((stats.coffeeHeight && stats.coffeeHeight[yearEndIndex]) || 0);
                    yearlyData.bambooHarvested.push(yearHarvest);
                    yearlyData.coffeeHarvested.push(yearCoffeeKg);
                    yearlyData.totalIncome.push(stats.economicYield[yearEndIndex] || 0);
                    yearlyData.totalCost.push((stats.energyCostJoules[yearEndIndex] || 0) / 1000000 * 0.0278);
                    yearlyData.netIncome.push((stats.economicYield[yearEndIndex] || 0) - ((stats.energyCostJoules[yearEndIndex] || 0) / 1000000 * 0.0278));
                    yearlyData.co2.push(stats.co2Sequestered[yearEndIndex] || 0);
                    
                    // Update last values for next year's calculations
                    lastHarvest = stats.totalHarvest[yearEndIndex] || 0;
                    lastCO2 = stats.co2Sequestered[yearEndIndex] || 0;
                    lastValue = stats.economicYield[yearEndIndex] || 0;
                    lastCost = stats.energyCostJoules[yearEndIndex] || 0;
                    lastCoffeeKg = (stats.coffeeHarvested && stats.coffeeHarvested[yearEndIndex]) || 0;
                }
                
                currentYear = year;
                yearStartIndex = i;
            }
        }
        
        return yearlyData;
    }
    
    drawMetric(data, x, y, width, height, color, scale, maxValue) {
        const ctx = this.ctx;
        
        if (!data || data.length === 0) return;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < data.length; i++) {
            // Scale x position based on 20 year span
            const px = x + (i / 20) * width;
            const scaledValue = data[i] * scale;
            const py = y + height - (scaledValue / maxValue) * height;
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        
        ctx.stroke();
    }
    
    drawGrid(x, y, width, height) {
        const ctx = this.ctx;
        
        // Background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, y, width, height);
        
        // Grid lines
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1;
        
        // Horizontal lines
        for (let i = 0; i <= 5; i++) {
            const py = y + (i / 5) * height;
            ctx.beginPath();
            ctx.moveTo(x, py);
            ctx.lineTo(x + width, py);
            ctx.stroke();
        }
        
        // Vertical lines (years)
        for (let i = 0; i <= 20; i++) {
            const px = x + (i / 20) * width;
            ctx.beginPath();
            ctx.moveTo(px, y);
            ctx.lineTo(px, y + height);
            ctx.stroke();
        }
    }
    
    drawAxes(x, y, width, height, years, maxValue) {
        const ctx = this.ctx;
        
        ctx.fillStyle = '#888';
        ctx.font = '12px sans-serif';
        
        // Y-axis labels
        for (let i = 0; i <= 5; i++) {
            const value = (maxValue * (5 - i) / 5);
            const py = y + (i / 5) * height;
            ctx.fillText(value.toFixed(0), x - 40, py + 4);
        }
        
        // X-axis labels (years)
        for (let i = 0; i <= 20; i += 5) {
            const px = x + (i / 20) * width;
            ctx.fillText(i.toString(), px - 10, y + height + 20);
        }
        
        // Axis labels
        ctx.font = '14px sans-serif';
        ctx.fillText('Years', x + width / 2 - 20, y + height + 40);
        
        // Rotated Y-axis label
        ctx.save();
        ctx.translate(x - 50, y + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Normalized Scale', -40, 0);
        ctx.restore();
    }
    
    updateHTMLLegend(metrics, yearlyData) {
        // Get or create the stats table container
        let container = document.getElementById('statsTable');
        if (!container) {
            const statsContent = document.querySelector('[data-content="stats"]');
            container = document.createElement('div');
            container.id = 'statsTable';
            container.className = 'mt-4 bg-gray-800 rounded p-4';
            statsContent.appendChild(container);
        }
        
        // Get current values (last year or interpolated current)
        const lastIndex = yearlyData.years.length - 1;
        const hasData = lastIndex >= 0;
        
        // Build the table HTML
        let html = '<table class="w-full text-sm">';
        html += '<thead><tr class="border-b border-gray-700">';
        html += '<th class="text-left pb-2">Metric</th>';
        html += '<th class="text-right pb-2">Current Value</th>';
        html += '<th class="text-right pb-2">Per Year</th>';
        html += '</tr></thead><tbody>';
        
        if (hasData) {
            // Calculate per-year values
            const currentYear = yearlyData.years[lastIndex];
            const yearlyBambooHarvest = lastIndex > 0 ? 
                yearlyData.bambooHarvested[lastIndex] : 
                yearlyData.bambooHarvested[0];
            const yearlyCoffeeHarvest = lastIndex > 0 ? 
                yearlyData.coffeeHarvested[lastIndex] : 
                yearlyData.coffeeHarvested[0];
            
            // Create rows for each metric
            const rows = [
                {
                    color: metrics[0].color,
                    label: 'Bamboo Height',
                    value: yearlyData.bambooHeight[lastIndex].toFixed(2) + 'm',
                    perYear: '-'
                },
                {
                    color: metrics[1].color,
                    label: 'Coffee Height',
                    value: yearlyData.coffeeHeight[lastIndex].toFixed(2) + 'm',
                    perYear: '-'
                },
                {
                    color: metrics[2].color,
                    label: 'Bamboo Harvested',
                    value: yearlyData.bambooHarvested.reduce((a, b) => a + b, 0).toFixed(0),
                    perYear: yearlyBambooHarvest.toFixed(0) + ' culms'
                },
                {
                    color: metrics[3].color,
                    label: 'Coffee Harvested',
                    value: yearlyData.coffeeHarvested.reduce((a, b) => a + b, 0).toFixed(1) + 'kg',
                    perYear: yearlyCoffeeHarvest.toFixed(1) + 'kg'
                },
                {
                    color: metrics[5].color,
                    label: 'Total Income',
                    value: '$' + yearlyData.totalIncome[lastIndex].toFixed(0),
                    perYear: '$' + (lastIndex > 0 ? 
                        (yearlyData.totalIncome[lastIndex] - yearlyData.totalIncome[lastIndex-1]).toFixed(0) : 
                        yearlyData.totalIncome[0].toFixed(0))
                },
                {
                    color: metrics[6].color,
                    label: 'Total Cost',
                    value: '$' + yearlyData.totalCost[lastIndex].toFixed(0),
                    perYear: '$' + (lastIndex > 0 ? 
                        (yearlyData.totalCost[lastIndex] - yearlyData.totalCost[lastIndex-1]).toFixed(0) : 
                        yearlyData.totalCost[0].toFixed(0))
                },
                {
                    color: metrics[4].color,
                    label: 'Net Income',
                    value: '$' + yearlyData.netIncome[lastIndex].toFixed(0),
                    perYear: '$' + (lastIndex > 0 ? 
                        (yearlyData.netIncome[lastIndex] - yearlyData.netIncome[lastIndex-1]).toFixed(0) : 
                        yearlyData.netIncome[0].toFixed(0))
                },
                {
                    color: metrics[7].color,
                    label: 'CO2 Sequestered',
                    value: yearlyData.co2[lastIndex].toFixed(0) + 'kg',
                    perYear: (lastIndex > 0 ? 
                        (yearlyData.co2[lastIndex] - yearlyData.co2[lastIndex-1]).toFixed(0) : 
                        yearlyData.co2[0].toFixed(0)) + 'kg'
                }
            ];
            
            rows.forEach(row => {
                html += '<tr class="border-b border-gray-700">';
                html += `<td class="py-2"><span style="display:inline-block;width:12px;height:12px;background:${row.color};margin-right:8px;"></span>${row.label}</td>`;
                html += `<td class="text-right py-2">${row.value}</td>`;
                html += `<td class="text-right py-2 text-gray-400">${row.perYear}</td>`;
                html += '</tr>';
            });
            
            // Add summary row
            html += '<tr class="border-t-2 border-gray-600">';
            html += '<td class="pt-3 font-semibold" colspan="3">Year ' + currentYear + ' Summary</td>';
            html += '</tr>';
            
            // Calculate some additional stats
            const totalClumps = Math.floor(100 * 100 / 64); // Assuming 8m spacing
            const totalCoffeePlants = Math.floor(totalClumps * 0.75 * 10); // Assuming 10 plants per row, 75% coverage
            const netProfit = yearlyData.netIncome[lastIndex];
            const profitPerHectare = netProfit / (100 * 100 / 10000);
            
            html += '<tr>';
            html += '<td class="text-gray-400" colspan="3">Total bamboo clumps: ' + totalClumps + '</td>';
            html += '</tr>';
            html += '<tr>';
            html += '<td class="text-gray-400" colspan="3">Total coffee plants: ' + totalCoffeePlants + '</td>';
            html += '</tr>';
            html += '<tr>';
            html += '<td class="text-gray-400" colspan="3">Profit per hectare: $' + profitPerHectare.toFixed(0) + '</td>';
            html += '</tr>';
        } else {
            html += '<tr><td colspan="3" class="text-center py-4 text-gray-400">No data yet - start the simulation</td></tr>';
        }
        
        html += '</tbody></table>';
        
        container.innerHTML = html;
    }
}
