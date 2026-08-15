import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  deleteTenantIdentityDocument,
  getTenantIdentityDocumentAccess,
  getTenantIdentityRequirement,
  listTenantIdentityDocuments,
  recordTenantIdentityConsent,
  uploadTenantIdentityDocument,
  type TenantIdentityDocument,
  type TenantIdentityDocumentSide,
  type TenantIdentityDocumentType,
  type TenantIdentityRequirementStatus,
} from "../../api/tenantIdentityDocumentsApi";
import { TenantErrorState, TenantLoadingState, TenantSurfaceShell, formatDate } from "./TenantWorkspaceShared";
import {
  TENANT_IDENTITY_DOCUMENT_TYPES,
  activeTenantIdentityDocuments,
  sidesForDocumentType,
  tenantIdentityErrorMessage,
  tenantIdentityStatusLabel,
  validateIdentityImage,
} from "./tenantIdentityWorkflow";
import "./TenantIdentityPage.css";

const verificationLabel = (status: TenantIdentityDocument["verificationStatus"]) =>
  status === "not_started" ? "Verification not started" : `Verification ${status.replace(/_/g, " ")}`;

export default function TenantIdentityPage() {
  const [requirement, setRequirement] = useState<TenantIdentityRequirementStatus | null>(null);
  const [documents, setDocuments] = useState<TenantIdentityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [documentType, setDocumentType] = useState<TenantIdentityDocumentType>("drivers_license");
  const [side, setSide] = useState<TenantIdentityDocumentSide>("front");
  const [issuingCountry, setIssuingCountry] = useState("CA");
  const [issuingRegion, setIssuingRegion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [accessByDocument, setAccessByDocument] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [replaceDocumentId, setReplaceDocumentId] = useState<string | undefined>();
  const uploadHeadingRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const [nextRequirement, nextDocuments] = await Promise.all([
      getTenantIdentityRequirement(),
      listTenantIdentityDocuments(),
    ]);
    setRequirement(nextRequirement);
    setDocuments(nextDocuments);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [nextRequirement, nextDocuments] = await Promise.all([
          getTenantIdentityRequirement(),
          listTenantIdentityDocuments(),
        ]);
        if (!cancelled) {
          setRequirement(nextRequirement);
          setDocuments(nextDocuments);
        }
      } catch (cause) {
        if (!cancelled) setError(tenantIdentityErrorMessage(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const sides = useMemo(() => sidesForDocumentType(documentType), [documentType]);
  const activeDocuments = useMemo(() => activeTenantIdentityDocuments(documents), [documents]);

  const selectFile = (selected?: File) => {
    setMessage(null);
    if (!selected) return;
    const validationError = validateIdentityImage(selected);
    if (validationError) {
      setFile(null);
      setMessage(validationError);
      return;
    }
    setFile(selected);
  };

  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!consented) return setMessage("Review and accept the collection consent before upload.");
    if (!file) return setMessage("Choose or take a government ID image before upload.");
    setBusy(true);
    try {
      await recordTenantIdentityConsent(navigator.language || "en-CA");
      await uploadTenantIdentityDocument({
        file,
        documentType,
        side,
        issuingCountry: issuingCountry.trim().toUpperCase(),
        issuingRegion: issuingRegion.trim() || undefined,
        replaceDocumentId,
      });
      await refresh();
      setFile(null);
      setConsented(false);
      setReplaceDocumentId(undefined);
      setMessage("Government ID received. Verification has not started.");
    } catch (cause) {
      setMessage(tenantIdentityErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const openSanitizedPreview = async (document: TenantIdentityDocument) => {
    setMessage(null);
    try {
      const access = await getTenantIdentityDocumentAccess(document.documentId);
      setAccessByDocument((current) => ({ ...current, [document.documentId]: access.accessReference }));
    } catch (cause) {
      setMessage(tenantIdentityErrorMessage(cause));
    }
  };

  const removeDocument = async (document: TenantIdentityDocument) => {
    if (!window.confirm("Delete this government ID image? You will need to upload another image to satisfy the requirement.")) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteTenantIdentityDocument(document.documentId);
      setAccessByDocument((current) => {
        const next = { ...current };
        delete next[document.documentId];
        return next;
      });
      await refresh();
      setMessage("Government ID image deleted. A new upload is required.");
    } catch (cause) {
      setMessage(tenantIdentityErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const beginReplacement = (document: TenantIdentityDocument) => {
    setReplaceDocumentId(document.documentId);
    setDocumentType(document.documentType);
    const nextSides = sidesForDocumentType(document.documentType);
    setSide(nextSides.some((option) => option.value === document.side) ? document.side : nextSides[0].value);
    setMessage("Choose a replacement image. The current image remains available until replacement succeeds.");
    requestAnimationFrame(() => uploadHeadingRef.current?.focus());
  };

  if (loading) return <TenantSurfaceShell title="Government ID"><TenantLoadingState label="Loading government ID requirement..." /></TenantSurfaceShell>;
  if (error || !requirement) return <TenantSurfaceShell title="Government ID"><TenantErrorState message={error || "Unable to load government ID requirement."} /></TenantSurfaceShell>;

  return (
    <TenantSurfaceShell
      title="Government ID"
      subtitle="Upload one approved government-issued photo ID. Your private image is available only through time-limited, sanitized access."
    >
      <section className="tenant-identity-summary" aria-labelledby="identity-requirement-heading">
        <div>
          <p className="tenant-identity-eyebrow">Mandatory requirement</p>
          <h2 id="identity-requirement-heading">{tenantIdentityStatusLabel(documents)}</h2>
          <p>{requirement.collectionStatus === "received" ? "Your government ID image has been received." : "Upload a government ID image to complete this requirement."}</p>
          {requirement.applicationContinuity ? <p className="tenant-identity-continuity">This requirement follows your canonical application record into your tenant workspace; no duplicate upload is needed when an accepted image already exists.</p> : null}
          <p className="tenant-identity-continuity">This is a display-only readiness status. It does not block lease signing or move-in and does not mean identity verification or face matching is complete.</p>
        </div>
        <div className="tenant-identity-statuses">
          <span>{requirement.requirementStatus === "satisfied" ? "Requirement satisfied" : "Action required"}</span>
          <span>{verificationLabel(requirement.verificationStatus)}</span>
        </div>
      </section>

      <section className="tenant-identity-panel" aria-labelledby="existing-id-heading">
        <h2 id="existing-id-heading">Your government ID images</h2>
        {activeDocuments.length === 0 ? <p>No government ID image has been uploaded.</p> : (
          <div className="tenant-identity-document-grid">
            {activeDocuments.map((document) => (
              <article className="tenant-identity-document" key={document.documentId}>
                {accessByDocument[document.documentId] ? (
                  <img src={accessByDocument[document.documentId]} alt={`Sanitized ${document.documentType.replace(/_/g, " ")} preview`} />
                ) : <div className="tenant-identity-placeholder">Private image preview</div>}
                <div className="tenant-identity-document-copy">
                  <strong>{TENANT_IDENTITY_DOCUMENT_TYPES.find((option) => option.value === document.documentType)?.label}</strong>
                  <span>{document.side.replace(/_/g, " ")} · {formatDate(document.uploadedAt)}</span>
                  <span>Government ID received · {verificationLabel(document.verificationStatus)}</span>
                </div>
                <div className="tenant-identity-actions">
                  <button type="button" onClick={() => void openSanitizedPreview(document)} disabled={busy || !document.sanitizedAccessAvailable}>View private preview</button>
                  <button type="button" onClick={() => beginReplacement(document)} disabled={busy}>Replace</button>
                  <button className="danger" type="button" onClick={() => void removeDocument(document)} disabled={busy}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="tenant-identity-panel" aria-labelledby="upload-id-heading">
        <h2 id="upload-id-heading" ref={uploadHeadingRef} tabIndex={-1}>{replaceDocumentId ? "Replace government ID image" : "Upload government ID image"}</h2>
        <p>Accepted ID types: driver’s licence, passport, provincial identification, or another approved government-issued photo ID. Accepted files: JPEG, PNG, or WebP, up to 10 MB. PDF is not supported. No facial recognition, biometric matching, OCR, or provider verification is performed.</p>
        <form className="tenant-identity-form" onSubmit={submit}>
          <label>Document type
            <select value={documentType} onChange={(event) => {
              const next = event.target.value as TenantIdentityDocumentType;
              setDocumentType(next);
              setSide(sidesForDocumentType(next)[0].value);
            }}>
              {TENANT_IDENTITY_DOCUMENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Image side
            <select value={side} onChange={(event) => setSide(event.target.value as TenantIdentityDocumentSide)}>
              {sides.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Issuing country
            <input value={issuingCountry} maxLength={2} onChange={(event) => setIssuingCountry(event.target.value)} required />
          </label>
          <label>Province / region <span>(optional)</span>
            <input value={issuingRegion} onChange={(event) => setIssuingRegion(event.target.value)} />
          </label>
          <div className="tenant-identity-file-fields">
            <label className="tenant-identity-file-button">Choose an existing image
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} />
            </label>
            <label className="tenant-identity-file-button">Take a photo
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => selectFile(event.target.files?.[0])} />
            </label>
          </div>
          {filePreview ? <img className="tenant-identity-local-preview" src={filePreview} alt="Selected government ID image preview" /> : null}
          {file ? (
            <div className="tenant-identity-selected-file">
              <p><strong>Selected:</strong> {file.name} · {(file.size / 1024).toFixed(1)} KB · {file.type} · {documentType.replace(/_/g, " ")} · {side.replace(/_/g, " ")}</p>
              <button type="button" onClick={() => setFile(null)} disabled={busy}>Remove selected image</button>
            </div>
          ) : null}
          <label className="tenant-identity-consent">
            <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
            <span>I consent to RentChain collecting and privately storing this government ID image for the identity-document requirement under policy {requirement.consent.requirementPolicyVersion}, privacy notice {requirement.consent.privacyNoticeVersion}, and retention policy {requirement.consent.retentionPolicyVersion}.</span>
          </label>
          {message ? <div className="tenant-identity-message" role="status" ref={messageRef} tabIndex={-1}>{message}</div> : null}
          {busy ? <div className="tenant-identity-progress" role="progressbar" aria-label="Government ID operation in progress" aria-valuetext="In progress" /> : null}
          <div className="tenant-identity-submit-row">
            {replaceDocumentId ? <button type="button" onClick={() => { setReplaceDocumentId(undefined); setFile(null); }} disabled={busy}>Cancel replacement</button> : null}
            <button className="primary" type="submit" disabled={busy}>{busy ? "Uploading..." : replaceDocumentId ? "Upload replacement" : "Upload government ID"}</button>
          </div>
        </form>
      </section>
    </TenantSurfaceShell>
  );
}
