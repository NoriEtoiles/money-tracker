import { Category, CategoryKind } from "../../lib/api/categories";

type CategorySelectorProps = {
  categories: Category[];
  disabled?: boolean;
  kind?: CategoryKind;
  label?: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  value: string;
};

export function CategorySelector({
  categories,
  disabled = false,
  kind,
  label = "Category",
  onChange,
  placeholder = "Select category",
  value
}: CategorySelectorProps): React.ReactElement {
  const options = categories.filter((category) => kind === undefined || category.kind === kind);

  return (
    <label className="field">
      <span>{label}</span>
      <select
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </label>
  );
}
