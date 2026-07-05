import type { CSSProperties } from "react";

export interface GenderSelectProps {
  /** Current selected gender value */
  value: string;
  /** Called with the new gender value when the user makes a selection */
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
  name?: string;
}

// Only the required gender options are exposed in the dropdown.
const GENDER_OPTIONS: string[] = ["Male", "Female"];

function GenderSelect({
  value,
  onChange,
  disabled,
  required,
  className,
  style,
  id,
  name,
}: GenderSelectProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={className}
      style={style}
    >
      <option value="">Choose gender</option>
      {GENDER_OPTIONS.map((gender) => (
        <option key={gender} value={gender}>
          {gender}
        </option>
      ))}
    </select>
  );
}

export default GenderSelect;
