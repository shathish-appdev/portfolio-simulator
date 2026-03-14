import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Block } from 'baseui/block';
import { CHART_STYLES } from '../../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../../utils/stockChartConfig';

interface StockPriceChartProps {
  data: Array<{ date: Date; nav: number }>;
  ticker: string;
}

const formatPrice = (value: number): string => {
  if (value >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
};

export const StockPriceChart: React.FC<StockPriceChartProps> = ({ data, ticker }) => {
  const seriesData = data.map(item => [item.date.getTime(), item.nav]);

  const chartOptions = {
    title: { text: `${ticker} - Price` },
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
        text: 'Price',
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
      shared: false,
      crosshairs: true,
      useHTML: true,
      backgroundColor: CHART_STYLES.colors.tooltipBackground,
      borderColor: CHART_STYLES.colors.tooltipBackground,
      borderRadius: 6,
      style: CHART_STYLES.tooltip,
      formatter: function (this: { x: number; y: number }) {
        const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
        const priceStr = formatPrice(this.y);
        return `<div style="font-size: 12px; color: #ffffff;">
          <strong>${dateStr}</strong><br/>
          <span style="color:#007bff">●</span> <strong>Price:</strong> ${priceStr}
        </div>`;
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
    series: [{
      name: ticker,
      data: seriesData,
      type: 'line',
      color: '#007bff',
      showInNavigator: true,
    }],
    legend: { enabled: false }
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
