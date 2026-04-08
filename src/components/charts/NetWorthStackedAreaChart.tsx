import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { CHART_STYLES, COLORS } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';
import type { StockSeries } from './StockPriceChart';

const formatPrice = (value: number): string => {
  if (value >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
};

interface NetWorthStackedAreaChartProps {
  series: StockSeries[];
  colors?: string[];
}

/** Stacked areas: each series is one holding’s market value; stacks show composition over time. */
export function NetWorthStackedAreaChart({
  series,
  colors = COLORS,
}: NetWorthStackedAreaChartProps): React.ReactElement {
  const chartSeries = series.map((s, i) => ({
    type: 'area' as const,
    name: s.ticker,
    data: s.data.map((d) => [d.date.getTime(), d.nav]),
    color: colors[i % colors.length],
    showInNavigator: i === 0,
    lineWidth: 1,
    fillOpacity: 0.88,
  }));

  const chartOptions = {
    title: { text: 'Portfolio composition (stacked value)' },
    credits: { enabled: false },
    chart: {
      backgroundColor: CHART_STYLES.colors.background,
      borderRadius: 8,
      spacing: [20, 20, 20, 20],
      height: 500,
      zooming: { mouseWheel: false },
    },
    xAxis: {
      type: 'datetime',
      title: { text: 'Date', style: CHART_STYLES.axisTitle },
      labels: { style: CHART_STYLES.axisLabels },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line,
      tickColor: CHART_STYLES.colors.tick,
    },
    yAxis: {
      opposite: false,
      title: {
        text: 'Value (USD)',
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle,
      },
      labels: {
        formatter: function (this: { value: number }) {
          return formatPrice(this.value);
        },
        style: CHART_STYLES.axisLabels,
      },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line,
    },
    rangeSelector: { enabled: false },
    navigator: STOCK_CHART_NAVIGATOR,
    scrollbar: STOCK_CHART_SCROLLBAR,
    tooltip: {
      shared: true,
      crosshairs: true,
      useHTML: true,
      backgroundColor: CHART_STYLES.colors.tooltipBackground,
      borderColor: CHART_STYLES.colors.tooltipBackground,
      borderRadius: 6,
      style: CHART_STYLES.tooltip,
      formatter: function (this: { x: number; points?: Array<{ y: number; series: { name: string; color: string } }> }) {
        const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
        let html = `<div style="font-size: 12px; color: #ffffff;"><strong>${dateStr}</strong><br/>`;
        const pts = (this.points || []).slice().sort((a: any, b: any) => (b.y as number) - (a.y as number));
        let sum = 0;
        pts.forEach((p: any) => {
          sum += p.y as number;
          html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>${formatPrice(p.y)}</strong><br/>`;
        });
        html += `<span style="opacity:0.9">Total: <strong>${formatPrice(sum)}</strong></span>`;
        return html + '</div>';
      },
    },
    plotOptions: {
      area: {
        stacking: 'normal',
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4 } } },
      },
      series: {
        animation: false,
      },
    },
    series: chartSeries,
    legend: {
      enabled: chartSeries.length > 1,
      itemStyle: CHART_STYLES.legend,
      itemHoverStyle: { color: '#1f2937' },
    },
  };

  return (
    <Block marginTop="1.5rem">
      <HighchartsReact highcharts={Highcharts} constructorType="stockChart" options={chartOptions} immutable />
    </Block>
  );
}
