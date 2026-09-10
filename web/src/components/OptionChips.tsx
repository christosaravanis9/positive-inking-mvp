export interface Option {
  value: string;
  label: string;
  description?: string;
  noBackground?: boolean;
}

/** Purely presentational — whether selecting one clears the others is the caller's business (single vs multi-select), driven by how `selected` and `onSelect` are wired. */
export function OptionChips({
  options,
  selected,
  onSelect,
}: {
  options: Option[];
  selected: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="option-grid">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`option-chip${option.description ? " option-chip-card" : ""}${selected.includes(option.value) ? " selected" : ""}${option.noBackground ? " no-background" : ""}`}
          onClick={() => onSelect(option.value)}
        >
          {option.description ? (
            <>
              <span className="option-chip-title">{option.label}</span>
              <span className="option-chip-description">{option.description}</span>
            </>
          ) : (
            option.label
          )}
        </button>
      ))}
    </div>
  );
}
