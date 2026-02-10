import csv
import sys
from pathlib import Path

try:
    from docx import Document
except Exception:
    Document = None  # type: ignore

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
except Exception:
    canvas = None  # type: ignore
    letter = None  # type: ignore


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "rentchain-frontend" / "public" / "templates"

PDF_VERSION = "Version v1.0"


def ensure_deps():
    if Document is None or canvas is None:
        print("Missing dependencies. Install: python-docx reportlab", file=sys.stderr)
        sys.exit(1)


def write_docx(path: Path, title: str, paragraphs: list[str], table: list[list[str]] | None = None):
    doc = Document()
    doc.add_heading(title, level=1)
    for p in paragraphs:
        doc.add_paragraph(p)
    if table:
        t = doc.add_table(rows=1, cols=len(table[0]))
        hdr = t.rows[0].cells
        for idx, cell in enumerate(hdr):
            cell.text = table[0][idx]
        for row in table[1:]:
            row_cells = t.add_row().cells
            for idx, cell in enumerate(row_cells):
                cell.text = row[idx]
    doc.save(path)


def draw_pdf_header(c, title: str):
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, 760, "RENTCHAIN")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, 735, title)
    c.setFont("Helvetica", 10)
    c.drawString(40, 718, PDF_VERSION)


def write_pdf(path: Path, title: str, body_lines: list[str]):
    c = canvas.Canvas(str(path), pagesize=letter)
    draw_pdf_header(c, title)
    c.setFont("Helvetica", 10)
    y = 690
    for line in body_lines:
        c.drawString(40, y, line)
        y -= 14
        if y < 60:
            c.showPage()
            draw_pdf_header(c, title)
            c.setFont("Helvetica", 10)
            y = 690
    c.save()


def write_csv(path: Path, headers: list[str]):
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)


def main():
    ensure_deps()
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

    # Notice of Entry
    write_docx(
        TEMPLATES_DIR / "Notice_of_Entry_Template.docx",
        "Notice of Entry",
        [
            "Tenant Name: {{TENANT_NAME}}",
            "Property Address: {{PROPERTY_ADDRESS}}",
            "Unit: {{UNIT_NUMBER}}",
            "Date of Notice: {{NOTICE_DATE}}",
            "Planned Entry Date/Time: {{ENTRY_DATE_TIME}}",
            "Reason for Entry: {{REASON_FOR_ENTRY}}",
            "Landlord/Manager: {{LANDLORD_NAME}}",
        ],
    )
    write_pdf(
        TEMPLATES_DIR / "Notice_of_Entry_Template.pdf",
        "NOTICE OF ENTRY",
        [
            "Tenant Name: ____________________________",
            "Property Address: ________________________",
            "Unit: ____________",
            "Date of Notice: __________________________",
            "Planned Entry Date/Time: __________________",
            "Reason for Entry: _________________________",
            "Landlord/Manager: _________________________",
        ],
    )

    # Move In/Out Inspection Checklist
    write_docx(
        TEMPLATES_DIR / "Move_In_Out_Inspection_Checklist_Template.docx",
        "Move-In/Move-Out Inspection Checklist",
        [
            "Tenant Name: {{TENANT_NAME}}",
            "Property Address: {{PROPERTY_ADDRESS}}",
            "Unit: {{UNIT_NUMBER}}",
            "Inspection Type: {{MOVE_IN_OR_OUT}}",
            "Inspection Date: {{INSPECTION_DATE}}",
        ],
        table=[
            ["Area", "Condition", "Notes"],
            ["Entry / Hallway", "{{CONDITION}}", "{{NOTES}}"],
            ["Living Room", "{{CONDITION}}", "{{NOTES}}"],
            ["Kitchen", "{{CONDITION}}", "{{NOTES}}"],
            ["Bathroom", "{{CONDITION}}", "{{NOTES}}"],
            ["Bedroom", "{{CONDITION}}", "{{NOTES}}"],
        ],
    )
    write_pdf(
        TEMPLATES_DIR / "Move_In_Out_Inspection_Checklist_Template.pdf",
        "MOVE-IN / MOVE-OUT INSPECTION",
        [
            "Tenant Name: ____________________________",
            "Property Address: ________________________",
            "Unit: ____________",
            "Inspection Type: _________________________",
            "Inspection Date: _________________________",
            "",
            "Areas: Entry / Hallway, Living Room, Kitchen, Bathroom, Bedroom",
            "Condition Notes: _________________________",
        ],
    )

    # Rent Ledger Summary
    write_csv(
        TEMPLATES_DIR / "Rent_Ledger_Summary_Template.csv",
        ["Date", "Tenant", "Unit", "Charge Type", "Amount", "Balance"],
    )
    write_docx(
        TEMPLATES_DIR / "Rent_Ledger_Summary_Template.docx",
        "Rent Ledger Summary",
        [
            "Property: {{PROPERTY_NAME}}",
            "Period: {{PERIOD_START}} to {{PERIOD_END}}",
        ],
        table=[
            ["Date", "Tenant", "Unit", "Charge Type", "Amount", "Balance"],
            ["{{DATE}}", "{{TENANT}}", "{{UNIT}}", "{{CHARGE_TYPE}}", "{{AMOUNT}}", "{{BALANCE}}"],
        ],
    )
    write_pdf(
        TEMPLATES_DIR / "Rent_Ledger_Summary_Template.pdf",
        "RENT LEDGER SUMMARY",
        [
            "Property: ________________________________",
            "Period: _________________________________",
            "",
            "Columns: Date | Tenant | Unit | Charge Type | Amount | Balance",
        ],
    )

    # Dispute Documentation Guide
    write_docx(
        TEMPLATES_DIR / "Dispute_Documentation_Guide_Template.docx",
        "Dispute Documentation Guide",
        [
            "Tenant: {{TENANT_NAME}}",
            "Property: {{PROPERTY_ADDRESS}}",
            "Issue Summary: {{ISSUE_SUMMARY}}",
            "Timeline:",
            "- {{DATE}}: {{EVENT}}",
            "- {{DATE}}: {{EVENT}}",
            "Supporting Evidence:",
            "- {{EVIDENCE_ITEM}}",
        ],
    )
    write_pdf(
        TEMPLATES_DIR / "Dispute_Documentation_Guide_Template.pdf",
        "DISPUTE DOCUMENTATION GUIDE",
        [
            "Tenant: _________________________________",
            "Property: _______________________________",
            "Issue Summary: __________________________",
            "Timeline and supporting evidence notes.",
        ],
    )

    # Rental Application Checklist (Tenant)
    write_docx(
        TEMPLATES_DIR / "Rental_Application_Checklist_Tenant.docx",
        "Rental Application Checklist (Tenant)",
        [
            "Applicant: {{APPLICANT_NAME}}",
            "Email: {{APPLICANT_EMAIL}}",
            "",
            "Checklist:",
            "- Government ID",
            "- Proof of income",
            "- References",
            "- Consent to screening",
        ],
    )
    write_pdf(
        TEMPLATES_DIR / "Rental_Application_Checklist_Tenant.pdf",
        "RENTAL APPLICATION CHECKLIST",
        [
            "Applicant: _____________________________",
            "Email: _________________________________",
            "",
            "Checklist: ID, proof of income, references, screening consent.",
        ],
    )

    # Tenant Notice Templates (PDF only)
    write_pdf(
        TEMPLATES_DIR / "Tenant_Notice_Templates.pdf",
        "TENANT NOTICE TEMPLATES",
        [
            "Notice types included:",
            "- Notice of Entry",
            "- Late Rent Notice",
            "- Lease Violation Notice",
            "",
            "Use the corresponding DOCX template to edit details.",
        ],
    )

    # Tenant Rights Overview (PDF only)
    write_pdf(
        TEMPLATES_DIR / "Tenant_Rights_Overview.pdf",
        "TENANT RIGHTS OVERVIEW",
        [
            "This document provides a high-level overview of tenant rights.",
            "Always refer to your local jurisdiction for the latest rules.",
        ],
    )

    # Lease Event Log (PDF only fix)
    write_pdf(
        TEMPLATES_DIR / "Lease_Event_Log_Template.pdf",
        "LEASE EVENT LOG",
        [
            "Property: ________________________________",
            "Unit: ____________________________________",
            "Tenant: __________________________________",
            "",
            "Event log entries:",
            "Date | Event | Notes",
        ],
    )

    print("Templates generated in:", TEMPLATES_DIR)


if __name__ == "__main__":
    main()
