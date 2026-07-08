export interface WeeklyBatch {
  _id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  groundAddress: string;
  ageGroups: string[];
  skillLevels: string[];
  label?: string;
  isActive?: boolean;
}

export interface Program {
  _id: string;
  title: string;
  slug?: string;
  shortDescription?: string;
  detailedDescription?: string;
  basePrice?: number;
  discountedPrice?: number;
  maxCapacity?: number;
  ageGroups?: string[];
  skillLevels?: string[];
  batchType?: 'REGULAR_WITH_MONTH' | 'REGULAR_WITHOUT_MONTH' | 'WEEKLY' | 'FIXED_DAYS' | 'SPECIAL_CAMP';
  weeklyBatches?: WeeklyBatch[];
  isActive?: boolean;
  createdAt?: string;
  category?: {
    _id?: string;
    title?: string;
  };
  location?: {
    _id?: string;
    title?: string;
  };
}
