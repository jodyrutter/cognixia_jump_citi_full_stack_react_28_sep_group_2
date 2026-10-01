import { useLayoutEffect, useRef } from "react";
import { localDate } from "../../utils/transactionFilters";

interface Props {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
}

function DateField({ label, value, onChange, invalid }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const textInput = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const parsed = localDate(value, false);
  const pickerValue = parsed ? `${value.slice(6)}-${value.slice(0, 2)}-${value.slice(3, 5)}` : "";

  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      textInput.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    const cursor = input.selectionStart ?? raw.length;
    const inputType = (event.nativeEvent as InputEvent).inputType ?? "";
    const deleting = inputType.startsWith("delete") || raw.length < value.length;
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const formatted = deleting && (
      raw.replace(/\D/g, "") === value.replace(/\D/g, "") ||
      raw.endsWith("/") && (digits.length === 2 || digits.length === 4)
    )
      ? raw
      : [
          digits.slice(0, 2),
          digits.slice(2, 4),
          digits.slice(4),
        ].filter(Boolean).join("/") + (!deleting && (digits.length === 2 || digits.length === 4) ? "/" : "");

    const digitsBeforeCaret = raw.slice(0, cursor).replace(/\D/g, "").length;
    let newCaret = 0;
    let seen = 0;
    while (newCaret < formatted.length && seen < digitsBeforeCaret) {
      if (/\d/.test(formatted[newCaret])) seen++;
      newCaret++;
    }
    if (!deleting && formatted[newCaret] === "/") newCaret++;
    if (deleting && digitsBeforeCaret === digits.length && raw.endsWith("/")) newCaret = formatted.length;
    pendingCaret.current = formatted === value ? null : newCaret;
    onChange(formatted);
  }

  return (
    <span className="date-entry">
      <input
        ref={textInput}
        type="text"
        value={value}
        onChange={handleTextChange}
        placeholder="MM/DD/YYYY"
        maxLength={10}
        aria-label={label}
        aria-invalid={invalid}
      />
      <input
        type="date"
        value={pickerValue}
        onChange={(e) => {
          const [year, month, day] = e.target.value.split("-");
          onChange(e.target.value ? `${month}/${day}/${year}` : "");
        }}
        aria-label={`Choose ${label.toLowerCase()}`}
        title={`Choose ${label.toLowerCase()}`}
      />
    </span>
  );
}

export function DateRangeFilter({ fromDate, toDate, onFromDateChange, onToDateChange }: Props) {
  const from = fromDate ? localDate(fromDate, false) : null;
  const to = toDate ? localDate(toDate, true) : null;
  const invalidFrom = fromDate !== "" && !from;
  const invalidTo = toDate !== "" && !to;
  const reversed = from && to && from > to;

  return (
    <div className="date-range-filter">
      <div className="chip-select">
        <span>Date:</span>
        <DateField label="From date" value={fromDate} onChange={onFromDateChange} invalid={invalidFrom || !!reversed} />
        –
        <DateField label="To date" value={toDate} onChange={onToDateChange} invalid={invalidTo || !!reversed} />
      </div>
      {(invalidFrom || invalidTo || reversed) && (
        <span className="date-filter-error" role="status">
          {reversed ? "From date must be on or before To date." : "Enter a valid date as MM/DD/YYYY."}
        </span>
      )}
    </div>
  );
}
