import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { CHART_STYLES } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';

import type { PortfolioValueSeries } from './StockPortfolioValueChart';

interface StockPortfolioValueNormalizedChartProps {
  data?: Array<{ date: Date; value: number }>;
  series?: PortfolioValueSeries[];
}

/**
 * Normalize so start date value = 100.
 */
function normalizeToBase100(data: Array<{ date: Date; value: number }>): Array<[number, number]> {
  if (data.length === 0) return [];
  const baseValue = data[0].value;
  if (baseValue === 0) return [];
  return data.map((item) => [
    item.date.getTime(),
    Math.round((item.value / baseValue) * 10000) / 100,
  ]);
}

const PORTFOLIO_COLORS = ['#8b5cf6', '#ec4899'];

export const StockPortfolioValueNormalizedChart: React.FC<StockPortfolioValueNormalizedChartProps> = ({
  data,
  series: seriesProp,
}) => {
  const isMulti = seriesProp && seriesProp.length > 0;
  const chartSeries = isMulti
    ? seriesProp!.map((s, i) => ({
        name: s.name,
        data: normalizeToBase100(s.data),
        type: 'line' as const,
        color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length],
        showInNavigator: true,
      }))
    : data
      ? [{
          name: 'Portfolio',
          data: normalizeToBase100(data),
          type: 'line' as const,
          color: PORTFOLIO_COLORS[0],
          showInNavigator: true,
        }]
      : [];

  const chartOptions = {
    title: { text: isMulti ? 'Portfolio - Normalized (Base = 100) - Compare' : 'Portfolio - Normalized (Base = 100)' },
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
              <span style="color:#8b5cf6">●</span> <strong>Index:</strong> ${(this.y as number).toFixed(2)}
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
