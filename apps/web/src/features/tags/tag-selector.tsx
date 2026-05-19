import { Tag } from "../../lib/api/tags";

type TagSelectorProps = {
  disabled?: boolean;
  label?: string;
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  selectedIds: string[];
  tags: Tag[];
};

export function TagSelector({
  disabled = false,
  label = "Tags",
  onChange,
  placeholder = "No tags available",
  selectedIds,
  tags
}: TagSelectorProps): React.ReactElement {
  if (tags.length === 0) {
    return (
      <label className="field">
        <span>{label}</span>
        <select disabled value="">
          <option value="">{placeholder}</option>
        </select>
      </label>
    );
  }

  function toggleTag(tagId: string): void {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== tagId));
      return;
    }

    onChange([...selectedIds, tagId]);
  }

  return (
    <fieldset className="tag-selector" disabled={disabled}>
      <legend>{label}</legend>
      <div className="selector-chip-list">
        {tags.map((tag) => {
          const isSelected = selectedIds.includes(tag.id);

          return (
            <button
              className={isSelected ? "selector-chip selector-chip-active" : "selector-chip"}
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              type="button"
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
