import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { CHART_STYLES } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';

export interface PortfolioValueSeries {
  name: string;
  data: Array<{ date: Date; value: number }>;
}

interface StockPortfolioValueChartProps {
  data?: Array<{ date: Date; value: number }>;
  series?: PortfolioValueSeries[];
  title?: string;
  yAxisTitle?: string;
}

const formatPrice = (value: number): string => {
  if (value >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
};

const PORTFOLIO_COLORS = ['#6366f1', '#ec4899'];

export function StockPortfolioValueChart({
  data,
  series: seriesProp,
  title: titleProp,
  yAxisTitle: yAxisTitleProp,
}: StockPortfolioValueChartProps): React.ReactElement {
  const isMulti = seriesProp && seriesProp.length > 0;
  const chartSeries = isMulti
    ? seriesProp!.map((s, i) => ({
        name: s.name,
        data: s.data.map((item) => [item.date.getTime(), item.value]),
        type: 'line' as const,
        color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length],
        showInNavigator: true,
      }))
    : data
      ? [{
          name: 'Portfolio',
          data: data.map((item) => [item.date.getTime(), item.value]),
          type: 'line' as const,
          color: PORTFOLIO_COLORS[0],
          showInNavigator: true,
        }]
      : [];

  const defaultTitle = isMulti ? 'Portfolio Value (Compare)' : 'Portfolio Value';
  const defaultYAxisTitle = 'Value ($)';
  const chartOptions = {
    title: { text: titleProp ?? defaultTitle },
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
        text: yAxisTitleProp ?? defaultYAxisTitle,
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
              html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>$${formatPrice(p.y)}</strong><br/>`;
            });
            return html + '</div>';
          }
        : function (this: { x: number; y: number }) {
            const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
            return `<div style="font-size: 12px; color: #ffffff;">
              <strong>${dateStr}</strong><br/>
              <span style="color:#6366f1">●</span> <strong>Portfolio:</strong> $${formatPrice(this.y)}
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
      />
    </Block>
  );
};
