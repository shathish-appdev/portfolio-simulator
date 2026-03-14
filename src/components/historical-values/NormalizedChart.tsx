import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { Asset } from '../../types/asset';
import { CHART_STYLES } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';

interface NormalizedChartProps {
  navDatas: Record<string, Array<{ date: Date; nav: number }>>;
  assets: Asset[];
  colors: string[];
}

/**
 * Normalize data so each series starts at 100 for easy trend comparison.
 * normalizedValue = (value / valueAtStartDate) * 100
 */
function normalizeToBase100(data: Array<{ date: Date; nav: number }>): Array<[number, number]> {
  if (data.length === 0) return [];
  const baseValue = data[0].nav;
  if (baseValue === 0) return [];
  return data.map(item => [
    item.date.getTime(),
    Math.round((item.nav / baseValue) * 10000) / 100
  ]);
}

export const NormalizedChart: React.FC<NormalizedChartProps> = ({
  navDatas,
  assets,
  colors
}) => {
  const series = assets
    .map((asset, idx) => {
      const navData = navDatas[idx.toString()];
      if (!navData || navData.length === 0) return null;
      return {
        name: asset.name,
        data: normalizeToBase100(navData),
        type: 'line',
        color: colors[idx % colors.length],
        marker: { enabled: false },
        showInNavigator: true,
      };
  }).filter(Boolean) as { name: string; data: [number, number][]; type: string; color: string; marker: { enabled: boolean }; showInNavigator: boolean }[];

  const chartOptions = {
    title: { text: 'Normalized to 100 (Base)' },
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
      tickColor: CHART_STYLES.colors.tick
    },
    yAxis: {
      opposite: false,
      title: {
        text: 'Index (Base = 100)',
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle
      },
      labels: {
        style: CHART_STYLES.axisLabels
      },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line,
      plotLines: [{ value: 100, color: '#6b7280', dashStyle: 'Dash', width: 1, zIndex: 5 }]
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
      formatter: function (this: any) {
        let tooltipHTML = `<div style="font-size: 12px; color: #ffffff;"><strong>${Highcharts.dateFormat('%e %b %Y', this.x)}</strong><br/>`;
        const sortedPoints = this.points ?
          [...this.points].sort((a: any, b: any) => (b.y as number) - (a.y as number)) : [];
        sortedPoints.forEach((point: any) => {
          const color = point.series.color;
          tooltipHTML += `<span style="color:${color}">●</span> ${point.series.name}: <strong>${(point.y as number).toFixed(2)}</strong><br/>`;
        });
        return tooltipHTML + '</div>';
      }
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
    series: series,
    legend: {
      enabled: series.length > 1,
      itemStyle: CHART_STYLES.legend,
      itemHoverStyle: { color: '#1f2937' }
    }
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
