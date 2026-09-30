export type EconomyAlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'BLOCK';

export interface DailyEconomyStatsDto {
  date: string;
  issuedPoints: number;
  rewardedPoints: number;
  rewardBudget: number;
  remainingBudget: number;
  reservePoints: number;
  utilizationPercent: number;
  reservedPoints: number;
  alertLevel: EconomyAlertLevel;
}

export interface UserEconomyDailyDto {
  date: string;
  remainingBudget: number;
  dailyProgress: number;
  utilizationPercent: number;
  alertLevel: EconomyAlertLevel;
}
