import React from "react";
import {
  analyzeExpenseUpload,
  createExpense,
  EXPENSE_CATEGORIES,
  type ExpenseRecord,
  type ExpenseCategory,
  type ExpenseSource,
  uploadExpenseSourceDocument,
} from "../../api/expensesApi";
import { useUnitsForProperty } from "../../hooks/useUnitsForProperty";
import { useToast } from "../ui/ToastProvider";

type PropertyOption = { id: string; name: string };
type ExpensePayload = {
  propertyId: string;
  unitId: string | null;
  category: ExpenseCategory;
  vendorName: string;
  amountCents: number;
  incurredAtMs: number;
  notes: string;
  source: ExpenseSource;
  linkedWorkOrderId?: string | null;
  sourceDocumentUrl?: string | null;
  sourceDocumentName?: string | null;
  sourceDocumentMimeType?: string | null;
  aiSummary?: string | null;
  aiExtractedFields?: Record<string, any> | null;
  aiProcessedAtMs?: number | null;
};

type Props = {
  open: boolean;
  properties: PropertyOption[];
  defaultPropertyId?: string | null;
  defaultUnitId?: string | null;
  defaultSource?: ExpenseSource;
  defaultCategory?: ExpenseCategory | "";
  defaultVendorName?: string;
  defaultNotes?: string;
  defaultLinkedWorkOrderId?: string | null;
  onClose: () => void;
  onSaved?: (expense: ExpenseRecord) => void | Promise<void>;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xls", ".xlsx", ".doc", ".docx", ".pdf"];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

function centsFromAmountInput(raw: string): number {
  const normalized = String(raw || "").trim();
  if (!normalized) return 0;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToMs(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return 0;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function normalizeCategorySuggestion(input: string | undefined): ExpenseCategory | "" {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  const match = EXPENSE_CATEGORIES.find((cat) => cat.toLowerCase() === raw);
  return match || "Other";
}

export function AddExpenseModal({
  open,
  properties,
  defaultPropertyId,
  defaultUnitId,
  defaultSource,
  defaultCategory,
  defaultVendorName,
  defaultNotes,
  defaultLinkedWorkOrderId,
  onClose,
  onSaved,
}: Props) {
  const { showToast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [propertyId, setPropertyId] = React.useState<string>("");
  const [unitId, setUnitId] = React.useState<string>("");
  const [source, setSource] = React.useState<ExpenseSource>("manual");
  const [category, setCategory] = React.useState<ExpenseCategory | "">("");
  const [vendorName, setVendorName] = React.useState("");
  const [amountInput, setAmountInput] = React.useState("");
  const [dateInput, setDateInput] = React.useState(toDateInputValue(Date.now()));
  const [notes, setNotes] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [analyzingFile, setAnalyzingFile] = React.useState(false);
  const [sourceDocumentUrl, setSourceDocumentUrl] = React.useState<string | null>(null);
  const [sourceDocumentName, setSourceDocumentName] = React.useState<string | null>(null);
  const [sourceDocumentMimeType, setSourceDocumentMimeType] = React.useState<string | null>(null);
  const [aiSummary, setAiSummary] = React.useState<string | null>(null);
  const [aiExtracted, setAiExtracted] = React.useState<Record<string, any> | null>(null);
  const [aiLowConfidence, setAiLowConfidence] = React.useState(false);
  const [aiCandidateAmounts, setAiCandidateAmounts] = React.useState<number[]>([]);
  const [aiRawCandidates, setAiRawCandidates] = React.useState<
    Array<{ amountCents: number; raw: string; context: string; confidenceTag: string }>
  >([]);

  const { units, loading: unitsLoading, error: unitsError, refetch: refetchUnits } = useUnitsForProperty(
    propertyId,
    open && Boolean(propertyId)
  );

  React.useEffect(() => {
    if (!open) return;
    const initialProperty = defaultPropertyId || properties[0]?.id || "";
    const initialSource: ExpenseSource = defaultSource || "manual";
    setPropertyId(initialProperty);
    setUnitId(defaultUnitId || "");
    setSource(initialSource);
    setCategory(defaultCategory || (initialSource === "work_order" ? "Repairs" : ""));
    setVendorName(defaultVendorName || "");
    setAmountInput("");
    setDateInput(toDateInputValue(Date.now()));
    setNotes(defaultNotes || "");
    setSelectedFile(null);
    setUploadingFile(false);
    setAnalyzingFile(false);
    setSourceDocumentUrl(null);
    setSourceDocumentName(null);
    setSourceDocumentMimeType(null);
    setAiSummary(null);
    setAiExtracted(null);
    setAiLowConfidence(false);
    setAiCandidateAmounts([]);
    setAiRawCandidates([]);
    setSaving(false);
    setError(null);
  }, [
    open,
    defaultPropertyId,
    defaultUnitId,
    defaultSource,
    defaultCategory,
    defaultVendorName,
    defaultNotes,
    properties,
  ]);

  if (!open) return null;

  const analyzeUpload = async (nextUploadSessionId: string, metadata?: { name?: string; mimeType?: string; url?: string }) => {
    try {
      setAnalyzingFile(true);
      const analyzed = await analyzeExpenseUpload({
        uploadSessionId: nextUploadSessionId,
        sourceDocumentName: metadata?.name,
        sourceDocumentMimeType: metadata?.mimeType,
        sourceDocumentUrl: metadata?.url,
      });
      setAiSummary(String(analyzed.summary || "").trim() || null);
      setAiExtracted(analyzed.extractedFields || null);
      setAiLowConfidence(Boolean(analyzed.lowConfidence));
      setAiCandidateAmounts(Array.isArray(analyzed.candidateAmounts) ? analyzed.candidateAmounts : []);
      setAiRawCandidates(Array.isArray(analyzed.rawCandidates) ? analyzed.rawCandidates : []);
    } catch (err: any) {
      setAiSummary(null);
      setAiExtracted(null);
      setAiLowConfidence(false);
      setAiCandidateAmounts([]);
      setAiRawCandidates([]);
      showToast({
        message: "AI analysis unavailable",
        description: String(err?.message || "You can still save this expense."),
        variant: "error",
      });
    } finally {
      setAnalyzingFile(false);
    }
  };

  const handleFileSelected = async (file: File | null) => {
    setSelectedFile(file);
    setSourceDocumentUrl(null);
    setSourceDocumentName(null);
    setSourceDocumentMimeType(null);
    setAiSummary(null);
    setAiExtracted(null);
    setAiLowConfidence(false);
    setAiCandidateAmounts([]);
    setAiRawCandidates([]);

    if (!file) return;
    if (!propertyId) {
      setError("Select a property before uploading a document.");
      return;
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError("Unsupported file type. Use csv, xls/xlsx, doc/docx, or pdf.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File is too large. Max 10MB.");
      return;
    }

    try {
      setError(null);
      setUploadingFile(true);
      const uploaded = await uploadExpenseSourceDocument({
        propertyId,
        file,
      });
      setSourceDocumentUrl(uploaded.sourceDocumentUrl);
      setSourceDocumentName(uploaded.sourceDocumentName);
      setSourceDocumentMimeType(uploaded.sourceDocumentMimeType);
      await analyzeUpload(uploaded.uploadSessionId, {
        name: uploaded.sourceDocumentName,
        mimeType: uploaded.sourceDocumentMimeType,
        url: uploaded.sourceDocumentUrl,
      });
    } catch (err: any) {
      const msg = String(err?.message || "Upload failed");
      setError(msg);
      showToast({ message: "Upload failed", description: msg, variant: "error" });
    } finally {
      setUploadingFile(false);
    }
  };

  const applySuggestedValues = () => {
    if (!aiExtracted) return;

    const updates: Array<string> = [];
    const wouldOverwrite: Array<string> = [];

    if (aiExtracted.vendorName) {
      if (vendorName && vendorName.trim().toLowerCase() !== String(aiExtracted.vendorName).trim().toLowerCase()) {
        wouldOverwrite.push("Vendor / Payee");
      }
      updates.push("vendorName");
    }
    if (aiExtracted.amountCents != null) {
      const currentCents = centsFromAmountInput(amountInput);
      if (currentCents > 0 && currentCents !== Number(aiExtracted.amountCents)) {
        wouldOverwrite.push("Amount");
      }
      updates.push("amount");
    }
    if (aiExtracted.incurredAtMs != null) {
      const currentDateMs = dateInputToMs(dateInput);
      if (currentDateMs > 0 && currentDateMs !== Number(aiExtracted.incurredAtMs)) {
        wouldOverwrite.push("Date");
      }
      updates.push("date");
    }
    if (aiExtracted.category) {
      const suggested = normalizeCategorySuggestion(String(aiExtracted.category));
      if (category && suggested && category !== suggested) {
        wouldOverwrite.push("Category");
      }
      updates.push("category");
    }

    if (updates.length === 0) return;
    if (wouldOverwrite.length > 0) {
      const confirmed = window.confirm(
        `Apply suggested values and overwrite: ${wouldOverwrite.join(", ")}?`
      );
      if (!confirmed) return;
    }

    if (aiExtracted.vendorName) setVendorName(String(aiExtracted.vendorName).slice(0, 180));
    if (aiExtracted.amountCents != null) {
      const dollars = Number(aiExtracted.amountCents) / 100;
      if (Number.isFinite(dollars) && dollars > 0) setAmountInput(String(dollars.toFixed(2)));
    }
    if (aiExtracted.incurredAtMs != null) {
      setDateInput(toDateInputValue(Number(aiExtracted.incurredAtMs)));
    }
    if (aiExtracted.category) {
      const nextCategory = normalizeCategorySuggestion(String(aiExtracted.category));
      if (nextCategory) setCategory(nextCategory);
    }
  };

  const handleSave = async () => {
    const amountCents = centsFromAmountInput(amountInput);
    const incurredAtMs = dateInputToMs(dateInput);
    if (!propertyId) {
      setError("Property is required.");
      return;
    }
    if (!category) {
      setError("Category is required.");
      return;
    }
    if (amountCents <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!incurredAtMs) {
      setError("Date is required.");
      return;
    }

    const payload: ExpensePayload = {
      propertyId,
      unitId: unitId || null,
      category,
      vendorName: vendorName.trim(),
      amountCents,
      incurredAtMs,
      notes: notes.trim(),
      source,
      linkedWorkOrderId: defaultLinkedWorkOrderId || null,
      sourceDocumentUrl,
      sourceDocumentName,
      sourceDocumentMimeType,
      aiSummary,
      aiExtractedFields: aiExtracted,
      aiProcessedAtMs: aiSummary || aiExtracted ? Date.now() : null,
    };

    setSaving(true);
    setError(null);
    try {
      const created = await createExpense(payload);
      showToast({ message: "Expense recorded", variant: "success" });
      await onSaved?.(created);
      onClose();
    } catch (err: any) {
      const message = String(err?.message || "Unable to record expense.");
      setError(message);
      showToast({ message: "Failed to record expense", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1300,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 22px 60px rgba(15,23,42,0.28)",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Add Expense</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add expense"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              color: "#475569",
            }}
          >
            x
          </button>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Property
          <select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setUnitId("");
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontSize: "0.9rem",
            }}
          >
            <option value="">Select property</option>
            {properties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Unit (optional)
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontSize: "0.9rem",
            }}
            disabled={!propertyId || unitsLoading}
          >
            <option value="">{unitsLoading ? "Loading units..." : "Whole property / unspecified"}</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {unitsError ? (
            <span style={{ fontSize: "0.8rem", color: "#b91c1c", display: "flex", gap: 8 }}>
              {unitsError}
              <button
                type="button"
                onClick={refetchUnits}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
              >
                Retry
              </button>
            </span>
          ) : null}
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory | "")}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontSize: "0.9rem",
              }}
            >
              <option value="">Select category</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Vendor / Payee
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor name"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Date
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: "0.9rem",
              resize: "vertical",
              minHeight: 80,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Upload invoice, bill, spreadsheet, or document
          <input
            type="file"
            accept={ACCEPT_ATTR}
            onChange={(e) => {
              const next = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
              void handleFileSelected(next);
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: "0.9rem",
              background: "#fff",
            }}
          />
          {selectedFile ? (
            <span style={{ fontSize: "0.82rem", color: "#475569" }}>
              Selected: {selectedFile.name}
            </span>
          ) : null}
          {uploadingFile ? (
            <span style={{ fontSize: "0.82rem", color: "#475569" }}>Uploading document...</span>
          ) : null}
          {analyzingFile ? (
            <span style={{ fontSize: "0.82rem", color: "#475569" }}>Analyzing uploaded document...</span>
          ) : null}
        </label>

        {(aiSummary || aiExtracted) && !analyzingFile ? (
          <div
            style={{
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              borderRadius: 8,
              padding: "10px 12px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: "#1e3a8a" }}>AI Summary</div>
            {aiSummary ? <div style={{ color: "#1f2937", fontSize: "0.9rem" }}>{aiSummary}</div> : null}
            {aiExtracted ? (
              <div style={{ fontSize: "0.85rem", color: "#334155", display: "grid", gap: 4 }}>
                {aiExtracted.vendorName ? <div>Vendor: {String(aiExtracted.vendorName)}</div> : null}
                {aiExtracted.amountCents != null ? (
                  <div>Amount: ${(Number(aiExtracted.amountCents) / 100).toFixed(2)}</div>
                ) : null}
                {aiExtracted.incurredAtMs != null ? (
                  <div>Date: {toDateInputValue(Number(aiExtracted.incurredAtMs))}</div>
                ) : null}
                {aiExtracted.category ? <div>Category: {String(aiExtracted.category)}</div> : null}
              </div>
            ) : null}
            {aiCandidateAmounts.length > 1 ? (
              <div style={{ fontSize: "0.82rem", color: "#475569" }}>
                Candidate amounts:{" "}
                {aiCandidateAmounts
                  .map((c) => `$${(Number(c || 0) / 100).toFixed(2)}`)
                  .join(", ")}
              </div>
            ) : null}
            {aiRawCandidates.length > 0 ? (
              <div style={{ fontSize: "0.78rem", color: "#64748b", display: "grid", gap: 3 }}>
                {aiRawCandidates.slice(0, 3).map((c, idx) => (
                  <div key={`${c.raw}-${idx}`}>
                    {c.confidenceTag}: ${(c.amountCents / 100).toFixed(2)} ({c.context})
                  </div>
                ))}
              </div>
            ) : null}
            {aiLowConfidence ? (
              <div style={{ color: "#b45309", fontSize: "0.84rem", fontWeight: 600 }}>
                AI extracted values may be inaccurate. Please verify before saving.
              </div>
            ) : null}
            <div>
              <button
                type="button"
                onClick={applySuggestedValues}
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: aiLowConfidence ? "1px solid #cbd5e1" : "1px solid #93c5fd",
                  background: aiLowConfidence ? "#f8fafc" : "#fff",
                  color: aiLowConfidence ? "#475569" : "#1d4ed8",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Apply suggested values
              </button>
            </div>
          </div>
        ) : null}

        {defaultLinkedWorkOrderId ? (
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
            Linked work order: {defaultLinkedWorkOrderId}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "0.88rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || uploadingFile}
            onClick={handleSave}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
