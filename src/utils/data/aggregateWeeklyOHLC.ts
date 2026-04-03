import { ProcessedOHLCData } from "../../types/index";

export function aggregateWeeklyOHLC(dailyData: ProcessedOHLCData[]): ProcessedOHLCData[] {
  if (dailyData.length === 0) return [];

  const weeklyData: ProcessedOHLCData[] = [];
  let currentWeek: ProcessedOHLCData[] = [];
  let currentWeekStart: Date | null = null;

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
    return new Date(d.setDate(diff));
  };

  for (const day of dailyData) {
    const weekStart = getWeekStart(day.date);

    if (currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime()) {
      if (currentWeek.length > 0) {
        // Aggregate previous week
        const high = Math.max(...currentWeek.map(d => d.high));
        const low = Math.min(...currentWeek.map(d => d.low));
        const open = currentWeek[0].open;
        const close = currentWeek[currentWeek.length - 1].close;
        
        // Find the dates when high and low occurred
        const highDate = currentWeek.find(d => d.high === high)?.date;
        const lowDate = currentWeek.find(d => d.low === low)?.date;
        
        weeklyData.push({
          date: currentWeekStart!,
          open,
          high,
          low,
          close,
          highDate,
          lowDate,
        });
      }
      currentWeek = [day];
      currentWeekStart = weekStart;
    } else {
      currentWeek.push(day);
    }
  }

  // Handle the last week
  if (currentWeek.length > 0) {
    const high = Math.max(...currentWeek.map(d => d.high));
    const low = Math.min(...currentWeek.map(d => d.low));
    const open = currentWeek[0].open;
    const close = currentWeek[currentWeek.length - 1].close;
    
    // Find the dates when high and low occurred
    const highDate = currentWeek.find(d => d.high === high)?.date;
    const lowDate = currentWeek.find(d => d.low === low)?.date;
    
    weeklyData.push({
      date: currentWeekStart!,
      open,
      high,
      low,
      close,
      highDate,
      lowDate,
    });
  }

  return weeklyData;
}

export function aggregateMonthlyOHLC(dailyData: ProcessedOHLCData[]): ProcessedOHLCData[] {
  if (dailyData.length === 0) return [];

  const monthlyData: ProcessedOHLCData[] = [];
  let currentMonth: ProcessedOHLCData[] = [];
  let currentMonthStart: Date | null = null;

  const getMonthStart = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  for (const day of dailyData) {
    const monthStart = getMonthStart(day.date);

    if (currentMonthStart === null || monthStart.getTime() !== currentMonthStart.getTime()) {
      if (currentMonth.length > 0) {
        // Aggregate previous month
        const high = Math.max(...currentMonth.map(d => d.high));
        const low = Math.min(...currentMonth.map(d => d.low));
        const open = currentMonth[0].open;
        const close = currentMonth[currentMonth.length - 1].close;

        // Find the dates when high and low occurred
        const highDate = currentMonth.find(d => d.high === high)?.date;
        const lowDate = currentMonth.find(d => d.low === low)?.date;

        monthlyData.push({
          date: currentMonthStart!,
          open,
          high,
          low,
          close,
          highDate,
          lowDate,
        });
      }
      currentMonth = [day];
      currentMonthStart = monthStart;
    } else {
      currentMonth.push(day);
    }
  }

  // Handle the last month
  if (currentMonth.length > 0) {
    const high = Math.max(...currentMonth.map(d => d.high));
    const low = Math.min(...currentMonth.map(d => d.low));
    const open = currentMonth[0].open;
    const close = currentMonth[currentMonth.length - 1].close;

    // Find the dates when high and low occurred
    const highDate = currentMonth.find(d => d.high === high)?.date;
    const lowDate = currentMonth.find(d => d.low === low)?.date;

    monthlyData.push({
      date: currentMonthStart!,
      open,
      high,
      low,
      close,
      highDate,
      lowDate,
    });
  }

  return monthlyData;
}