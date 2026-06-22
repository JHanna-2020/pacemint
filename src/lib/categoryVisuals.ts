import { Category } from './types';

const CATEGORY_COLORS: Record<Category, string> = {
  Groceries: '#67e8f9',
  'Dining Out': '#a7f3d0',
  Subscriptions: '#fda4af',
  Gas: '#fde68a',
  'Personal Necessities': '#c4b5fd',
  Other: '#f0abfc'
};

export function categoryColor(category: Category): string {
  return CATEGORY_COLORS[category];
}
