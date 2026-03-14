import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { CHART_STYLES } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';

import type { StockSeries } from './StockPriceChart';

interface StockPriceNormalizedChartProps {
  data?: Array<{ date: Date; nav: number }>;
  ticker?: string;
  series?: StockSeries[];
  colors?: string[];
}

/**
 * Normalize data so start date price = 100.
 * normalizedValue = (price / priceAtStart) * 100
 */
function normalizeToBase100(data: Array<{ date: Date; nav: number }>): Array<[number, number]> {
  if (data.length === 0) return [];
  const baseValue = data[0].nav;
  if (baseValue === 0) return [];
  return data.map(item => [
    item.date.getTime(),
    Math.round((item.nav / baseValue) * 10000) / 100,
  ]);
}

const DEFAULT_COLORS = ['#007bff', '#28a745', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

export const StockPriceNormalizedChart: React.FC<StockPriceNormalizedChartProps> = ({
  data,
  ticker,
  series: seriesProp,
  colors = DEFAULT_COLORS,
}) => {
  const isMulti = seriesProp && seriesProp.length > 0;
  const chartSeries = isMulti
    ? seriesProp!.map((s, i) => ({
        name: s.ticker,
        data: normalizeToBase100(s.data),
        type: 'line' as const,
        color: colors[i % colors.length],
        showInNavigator: true,
      }))
    : data
      ? [{
          name: ticker!,
          data: normalizeToBase100(data),
          type: 'line' as const,
          color: '#28a745',
          showInNavigator: true,
        }]
      : [];

  const chartOptions = {
    title: { text: isMulti ? 'Portfolio - Normalized (Base = 100)' : `${ticker} - Normalized (Base = 100)` },
    credits: { enabled: false },
    chart: {
      backgroundColor: CHART_STYLES.colors.background,
      borderRadius: 8,
      spacing: [20, 20, 20, 20],
      height: 400,
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
        text: 'Index (Base = 100)',
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle,
      },
      labels: { style: CHART_STYLES.axisLabels },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line,
      plotLines: [{ value: 100, color: '#6b7280', dashStyle: 'Dash', width: 1, zIndex: 5 }],
    },
    rangeSelector: { enabled: false },
    navigator: STOCK_CHART_NAVIGATOR,
    scrollbar: STOCK_CHART_SCROLLBAR,
    tooltip: {
      shared: isMulti,
      crosshairs: true,
      useHTML: true,
      backgroundColor: CHART_STYLES.colors.tooltipBackground,
      borderColor: CHART_STYLES.colors.tooltipBackground,
      borderRadius: 6,
      style: CHART_STYLES.tooltip,
      formatter: isMulti
        ? function (this: { x: number; points?: Array<{ y: number; series: { name: string; color: string } }> }) {
            const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
            let html = `<div style="font-size: 12px; color: #ffffff;"><strong>${dateStr}</strong><br/>`;
            const pts = (this.points || []).slice().sort((a: any, b: any) => (b.y as number) - (a.y as number));
            pts.forEach((p: any) => {
              html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>${(p.y as number).toFixed(2)}</strong><br/>`;
            });
            return html + '</div>';
          }
        : function (this: { x: number; y: number }) {
            const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
            return `<div style="font-size: 12px; color: #ffffff;">
              <strong>${dateStr}</strong><br/>
              <span style="color:#28a745">●</span> <strong>Index:</strong> ${(this.y as number).toFixed(2)}
            </div>`;
          },
    },
    plotOptions: {
      series: {
        animation: false,
        marker: {
          enabled: false,
          states: { hover: { enabled: true, radius: 5 } },
        },
      },
    },
    series: chartSeries,
    legend: {
      enabled: isMulti && chartSeries.length > 1,
      itemStyle: CHART_STYLES.legend,
      itemHoverStyle: { color: '#1f2937' },
    },
  };

  return (
    <Block marginTop="1.5rem">
      <HighchartsReact
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptions}
        immutable
      />
    </Block>
  );
};
