import type { ReactNode } from "react";

type MaintenanceEvidencePhotoProps = {
  src?: string | null;
  filename: string;
  altText?: string;
  fallback?: ReactNode;
  onError?: () => void;
};

export default function MaintenanceEvidencePhoto({
  src,
  filename,
  altText,
  fallback = "Unavailable",
  onError,
}: MaintenanceEvidencePhotoProps) {
  return (
    <div
      className="maintenance-evidence-photo-frame"
      data-testid="maintenance-evidence-photo-frame"
      style={{
        aspectRatio: "4 / 3",
        width: "100%",
        overflow: "hidden",
        borderRadius: 8,
        background: "#eef2f7",
        border: "1px solid #d6dbe5",
        display: "grid",
        placeItems: "center",
      }}
    >
      {src ? (
        <img
          className="maintenance-evidence-photo-image"
          src={src}
          alt={altText || `Maintenance photo: ${filename}`}
          loading="lazy"
          onError={onError}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
        />
      ) : (
        <div style={{ padding: 12, textAlign: "center" }}>{fallback}</div>
      )}
    </div>
  );
}
