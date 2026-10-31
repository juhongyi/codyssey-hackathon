import { type Category, categories } from "../lib/types";
export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className={`category-chip ${category}`}>{categories[category]}</span>
  );
}
