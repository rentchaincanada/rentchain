import React from "react";
import { Link } from "react-router-dom";
import type { LandlordActiveLease } from "@/api/leasesApi";
import {
  countRenewalPipelineBuckets,
  deriveRenewalPipelineItems,
  isRenewalPipelineActionable,
  type RenewalPipelineItem,
} from "@/lib/leases/renewalPipeline";

const MAX_VISIBLE_PIPELINE_ITEMS = 6;

function RenewalPipelineRow({ item }: { item: RenewalPipelineItem }) {
  return (
    <div className="rc-renewal-pipeline-row">
      <div className="rc-renewal-pipeline-main">
        <div className="rc-renewal-pipeline-lease">
          {item.propertyLabel} · Unit {item.unitLabel}
        </div>
        <div className="rc-renewal-pipeline-context">
          {item.tenantLabel} · Ends {item.endDateLabel} · {item.timingLabel}
        </div>
        <div className="rc-renewal-pipeline-detail">{item.detail}</div>
      </div>
      <div className="rc-renewal-pipeline-side">
        <span className="rc-renewal-pipeline-badge">{item.category}</span>
        <span className="rc-renewal-pipeline-status">{item.statusLabel}</span>
        <Link
          className="rc-renewal-pipeline-action"
          to={item.href}
          aria-label={`${item.nextActionLabel} for ${item.propertyLabel} unit ${item.unitLabel}`}
        >
          {item.nextActionLabel}
        </Link>
      </div>
    </div>
  );
}

export default function RenewalPipelinePanel({ leases }: { leases: LandlordActiveLease[] }) {
  const items = React.useMemo(() => deriveRenewalPipelineItems(leases), [leases]);
  const bucketCounts = React.useMemo(() => countRenewalPipelineBuckets(items), [items]);
  const actionableItems = items.filter(isRenewalPipelineActionable);
  const visibleItems = actionableItems.slice(0, MAX_VISIBLE_PIPELINE_ITEMS);
  const hiddenCount = Math.max(0, actionableItems.length - visibleItems.length);

  return (
    <section
      id="renewal-pipeline"
      className="rc-renewal-pipeline"
      aria-labelledby="renewal-pipeline-title"
    >
      <div className="rc-renewal-pipeline-header">
        <div>
          <div id="renewal-pipeline-title" className="rc-renewal-pipeline-title">
            Renewal pipeline
          </div>
          <div className="rc-renewal-pipeline-helper">
            Upcoming lease lifecycle review windows, renewal planning, rent increase review, notice timing review, and move-out preparation.
          </div>
        </div>
        <Link className="rc-renewal-pipeline-summary-link" to="/operations#operations-upcoming-work">
          Open operations view
        </Link>
      </div>

      <div className="rc-renewal-pipeline-buckets" aria-label="Renewal pipeline timing buckets">
        {bucketCounts.map((bucket) => (
          <div key={bucket.key} className="rc-renewal-pipeline-bucket">
            <span>{bucket.label}</span>
            <strong>{bucket.count}</strong>
          </div>
        ))}
      </div>

      {visibleItems.length > 0 ? (
        <div className="rc-renewal-pipeline-list">
          {visibleItems.map((item) => (
            <RenewalPipelineRow key={`${item.leaseId}:${item.category}:${item.timingBucket}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="rc-renewal-pipeline-empty">
          No lease lifecycle items need immediate renewal pipeline action from current lease data.
        </div>
      )}

      {hiddenCount > 0 ? (
        <div className="rc-renewal-pipeline-more">
          {hiddenCount} more renewal pipeline item{hiddenCount === 1 ? "" : "s"} are available in the lease list below.
        </div>
      ) : null}
    </section>
  );
}
