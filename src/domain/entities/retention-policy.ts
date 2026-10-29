export interface RetentionPolicy {
  hostDays: number;
  containersDays: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  hostDays: 30,
  containersDays: 7,
};
