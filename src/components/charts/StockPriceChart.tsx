import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { CHART_STYLES } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';

export interface StockSeries {
  ticker: string;
  data: Array<{ date: Date; nav: number }>;
}

interface StockPriceChartProps {
  data?: Array<{ date: Date; nav: number }>;
  ticker?: string;
  series?: StockSeries[];
  colors?: string[];
  /** Single-series only: overrides chart title (default `${ticker} - Price`) */
  chartTitle?: string;
  /** Single-series only: y-axis title (default `Price`) */
  valueAxisTitle?: string;
  /** Single-series only: tooltip label (default `Price`) */
  tooltipValueLabel?: string;
  /** Multi-series: chart title (default `Portfolio - Price`) */
  multiChartTitle?: string;
  /** Multi-series: y-axis title (default `Price`) */
  multiValueAxisTitle?: string;
}

const formatPrice = (value: number): string => {
  if (value >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
};

const DEFAULT_COLORS = ['#007bff', '#28a745', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

export const StockPriceChart: React.FC<StockPriceChartProps> = ({
  data,
  ticker,
  series: seriesProp,
  colors = DEFAULT_COLORS,
  chartTitle,
  valueAxisTitle,
  tooltipValueLabel,
  multiChartTitle,
  multiValueAxisTitle,
}) => {
  const isMulti = seriesProp && seriesProp.length > 0;
  const chartSeries = isMulti
    ? seriesProp!.map((s, i) => ({
        name: s.ticker,
        data: s.data.map(item => [item.date.getTime(), item.nav]),
        type: 'line' as const,
        color: colors[i % colors.length],
        showInNavigator: true,
      }))
    : data
      ? [{
          name: ticker!,
          data: data.map(item => [item.date.getTime(), item.nav]),
          type: 'line' as const,
          color: '#007bff',
          showInNavigator: true,
        }]
      : [];

  const singleTitle = chartTitle ?? `${ticker} - Price`;
  const singleYTitle = valueAxisTitle ?? 'Price';
  const singleTooltipLabel = tooltipValueLabel ?? 'Price';
  const multiTitle = multiChartTitle ?? 'Portfolio - Price';
  const multiYTitle = multiValueAxisTitle ?? 'Price';

  const chartOptions = {
    title: { text: isMulti ? multiTitle : singleTitle },
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
      tickColor: CHART_STYLES.colors.tick
    },
    yAxis: {
      opposite: false,
      title: {
        text: isMulti ? multiYTitle : singleYTitle,
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle
      },
      labels: {
        formatter: function (this: { value: number }) {
          return formatPrice(this.value);
        },
        style: CHART_STYLES.axisLabels
      },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line
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
              html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>${formatPrice(p.y)}</strong><br/>`;
            });
            return html + '</div>';
          }
        : function (this: { x: number; y: number }) {
            const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
            const priceStr = formatPrice(this.y);
            return `<div style="font-size: 12px; color: #ffffff;">
              <strong>${dateStr}</strong><br/>
              <span style="color:#007bff">●</span> <strong>${singleTooltipLabel}:</strong> ${priceStr}
            </div>`;
          },
    },
    plotOptions: {
      series: {
        animation: false,
        marker: {
          enabled: false,
          states: { hover: { enabled: true, radius: 5 } }
        },
      }
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
