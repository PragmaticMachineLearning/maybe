import React from "react";
import type { DistributionViewType } from "../../utils/distribution/distributionUtils";
import styles from "./CellRenderer.module.css";

const ChevronDownIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 14,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M6 9L12 15L18 9"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DistributionIcon: React.FC = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 18C6 14 8.5 9 12 9C15.5 9 16.5 14 20 6"
      stroke="var(--resize-handle-active)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="4"
      y1="18"
      x2="20"
      y2="18"
      stroke="var(--border-color)"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  </svg>
);

interface DistributionViewDropdownProps {
  availableViews: DistributionViewType[];
  viewType: DistributionViewType;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onSelectView: (type: DistributionViewType) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

const distributionOptions: Array<{
  type: DistributionViewType;
  label: string;
}> = [
  { type: "normal", label: "Normal Distribution" },
  { type: "lognormal", label: "Log-Normal Distribution" },
  { type: "uniform", label: "Uniform Distribution" },
];

export const DistributionViewDropdown: React.FC<
  DistributionViewDropdownProps
> = ({
  availableViews,
  viewType,
  showDropdown,
  onToggleDropdown,
  onSelectView,
  dropdownRef,
}) => {
  return (
    <div
      className={styles.dropdownWrapper}
      ref={dropdownRef as React.RefObject<HTMLDivElement>}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDropdown();
        }}
        className={[styles.dropdownBtn, showDropdown && styles.dropdownBtnOpen]
          .filter(Boolean)
          .join(" ")}
        title="Change view"
      >
        <ChevronDownIcon size={14} />
      </button>
      {showDropdown && (
        <div className={styles.dropdownPanel}>
          <div className={styles.dropdownInner}>
            <div className={styles.dropdownHeader}>View as:</div>
            {distributionOptions
              .filter((option) => availableViews.includes(option.type))
              .map((option) => (
                <button
                  key={option.type}
                  onClick={() => onSelectView(option.type)}
                  className={[
                    styles.dropdownOption,
                    viewType === option.type && styles.dropdownOptionActive,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <DistributionIcon />
                  {option.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
