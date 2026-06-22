export interface Program {
  _id: string;
  title: string;
  slug?: string;
  shortDescription?: string;
  detailedDescription?: string;
  basePrice?: number;
  discountedPrice?: number;
  ageGroups?: string[];
  skillLevels?: string[];
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
