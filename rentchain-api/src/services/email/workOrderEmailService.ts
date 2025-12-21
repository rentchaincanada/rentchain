import { PropertyActionRequest } from "../../types/models";

export async function sendWorkOrderEmail(params: {
  to: string;
  actionRequest: PropertyActionRequest;
  propertyAddressLine: string;
  unitLabel?: string;
  links: { acknowledgeUrl: string; resolveUrl: string };
}): Promise<void> {
  const { to, actionRequest, propertyAddressLine, unitLabel, links } = params;

  const subject = `[Work Order] ${actionRequest.issueType} (${actionRequest.severity}) at ${propertyAddressLine}${
    unitLabel ? ` ${unitLabel}` : ""
  }`;

  const bodyLines = [
    `Issue Type: ${actionRequest.issueType}`,
    `Severity: ${actionRequest.severity}`,
    `Location: ${actionRequest.location}`,
    `Property: ${propertyAddressLine}`,
    unitLabel ? `Unit: ${unitLabel}` : null,
    `Description: ${actionRequest.description}`,
    `Reported At: ${actionRequest.reportedAt}`,
    "",
    `Acknowledge: ${links.acknowledgeUrl}`,
    `Resolve: ${links.resolveUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Stub for v1: log instead of sending real email
  console.log("[work-order-email] sending", {
    to,
    subject,
    body: bodyLines,
  });
}
