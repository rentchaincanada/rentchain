import React from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { spacing } from "@/styles/tokens";
import "./ResponsiveMasterDetail.css";

type Props = {
  title?: string;
  searchSlot?: React.ReactNode;
  masterTitle?: string;
  master: React.ReactNode;
  detail: React.ReactNode;
  hasSelection: boolean;
  onClearSelection: () => void;
  selectedLabel?: string;
  masterDropdown?: React.ReactNode;
};

export function ResponsiveMasterDetail({
  title,
  searchSlot,
  masterTitle,
  master,
  detail,
  hasSelection,
  onClearSelection,
  selectedLabel,
  masterDropdown,
}: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="rc-master-detail rc-master-detail--mobile">
        {title ? <div className="rc-master-detail-title">{title}</div> : null}
        {!hasSelection ? (
          <div className="rc-master-detail-mobile-stack">
            {searchSlot ? (
              <div className="rc-master-detail-search">{searchSlot}</div>
            ) : null}
            {masterTitle ? (
              <div className="rc-master-detail-master-title">{masterTitle}</div>
            ) : null}
            <div className="rc-master-detail-master">{master}</div>
          </div>
        ) : (
          <div className="rc-master-detail-mobile-stack">
            <div className="rc-master-detail-mobile-header">
              <button type="button" className="rc-master-detail-back" onClick={onClearSelection}>
                Back
              </button>
              <div className="rc-master-detail-selected">
                {selectedLabel || "Selected"}
              </div>
              {masterDropdown ? (
                <div className="rc-master-detail-dropdown">{masterDropdown}</div>
              ) : null}
            </div>
            <div className="rc-master-detail-detail rc-master-detail-detail--mobile">{detail}</div>
            <div style={{ height: spacing.sm }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rc-master-detail rc-master-detail--desktop">
      <div className="rc-master-detail-master">
        {searchSlot ? <div className="rc-master-detail-search">{searchSlot}</div> : null}
        {masterTitle ? (
          <div className="rc-master-detail-master-title">{masterTitle}</div>
        ) : null}
        {master}
      </div>
      <div className="rc-master-detail-detail">{detail}</div>
    </div>
  );
}
