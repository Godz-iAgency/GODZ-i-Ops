"use client";

import { useId } from "react";

const ORGANIZATION_PRESETS = ["Freelance / Self-employed", "Organization not listed"];

type Props = {
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function OrganizationInput({
  value,
  onChange,
  className,
  placeholder = "Organization or choose a fallback",
  autoFocus,
}: Props) {
  const listId = useId().replace(/:/g, "");

  return (
    <>
      <input
        autoFocus={autoFocus}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <datalist id={listId}>
        {ORGANIZATION_PRESETS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
