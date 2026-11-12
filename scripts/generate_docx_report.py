import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_document():
    doc = docx.Document()

    # Configure Margins (Normal 1 inch)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Styles Setup
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(34, 40, 49) # Charcoal
    normal_style.paragraph_format.line_spacing = 1.25
    normal_style.paragraph_format.space_after = Pt(6)

    # Read markdown content
    md_path = r"C:\Users\akash\OneDrive\Desktop\CSE276\docs\FINAL_PROJECT_REPORT.md"
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_table = False
    table_rows = []
    in_code_block = False
    code_lines = []

    def flush_table():
        nonlocal in_table, table_rows
        if not table_rows:
            in_table = False
            return
        
        # Determine cols
        num_cols = max(len(row) for row in table_rows)
        table = doc.add_table(rows=len(table_rows), cols=num_cols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True

        for i, row in enumerate(table_rows):
            is_header = (i == 0)
            for j in range(num_cols):
                cell = table.cell(i, j)
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                val = row[j] if j < len(row) else ""
                
                # Clean markdown bold or math symbols from value
                clean_val = val.replace("**", "").replace("$", "").strip()
                cell.text = clean_val
                
                # Format cell text
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.line_spacing = 1.15
                if len(p.runs) > 0:
                    run = p.runs[0]
                    run.font.name = 'Calibri'
                    run.font.size = Pt(9.5)
                    if is_header:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)
                    else:
                        run.font.color.rgb = RGBColor(34, 40, 49)

                # Styling
                if is_header:
                    set_cell_background(cell, "1E3A8A") # Navy Blue
                    set_cell_margins(cell, top=140, bottom=140, left=150, right=150)
                else:
                    if i % 2 == 1:
                        set_cell_background(cell, "F8FAFC") # Soft Slate alternating
                    else:
                        set_cell_background(cell, "FFFFFF")
                    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)

        p_after = doc.add_paragraph()
        p_after.paragraph_format.space_after = Pt(6)
        in_table = False
        table_rows = []

    def flush_code():
        nonlocal in_code_block, code_lines
        if not code_lines:
            in_code_block = False
            return
        
        # Add code box
        box_table = doc.add_table(rows=1, cols=1)
        box_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = box_table.cell(0, 0)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
        
        cell.text = "".join(code_lines)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.05
        if len(p.runs) > 0:
            p.runs[0].font.name = 'Consolas'
            p.runs[0].font.size = Pt(9)
            p.runs[0].font.color.rgb = RGBColor(30, 41, 59)

        p_after = doc.add_paragraph()
        p_after.paragraph_format.space_after = Pt(6)
        in_code_block = False
        code_lines = []

    for raw_line in lines:
        line = raw_line.rstrip('\r\n')

        # Code block handling
        if line.startswith("```"):
            if in_code_block:
                flush_code()
            else:
                if in_table:
                    flush_table()
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(raw_line)
            continue

        # Table handling
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if parts and parts[0] == "":
                parts = parts[1:]
            if parts and parts[-1] == "":
                parts = parts[:-1]
            
            # Check if separator row (e.g. |---|---|)
            if all(re.match(r"^:?-+:?$", p) for p in parts if p):
                continue
            
            if not in_table:
                in_table = True
                table_rows = []
            table_rows.append(parts)
            continue
        elif in_table:
            flush_table()

        # Empty line
        if not line.strip():
            continue

        # Horizontal rule
        if line.strip() == "---":
            # Add subtle horizontal divider or spacing
            continue

        # Headings
        if line.startswith("# "):
            h_text = line[2:].strip()
            h = doc.add_heading(level=0)
            run = h.add_run(h_text)
            run.font.name = 'Calibri'
            run.font.size = Pt(22)
            run.font.bold = True
            run.font.color.rgb = RGBColor(30, 58, 138) # Dark Navy
            h.paragraph_format.space_before = Pt(18)
            h.paragraph_format.space_after = Pt(8)
            continue
        elif line.startswith("## "):
            h_text = line[3:].strip()
            h = doc.add_heading(level=1)
            run = h.add_run(h_text)
            run.font.name = 'Calibri'
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = RGBColor(14, 116, 144) # Slate Blue / Teal
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(6)
            continue
        elif line.startswith("### "):
            h_text = line[4:].strip()
            h = doc.add_heading(level=2)
            run = h.add_run(h_text)
            run.font.name = 'Calibri'
            run.font.size = Pt(13)
            run.font.bold = True
            run.font.color.rgb = RGBColor(30, 41, 59)
            h.paragraph_format.space_before = Pt(10)
            h.paragraph_format.space_after = Pt(4)
            continue

        # Bullet points
        if line.startswith("- "):
            b_text = line[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.15
            # Parse bold runs
            add_formatted_runs(p, b_text)
            continue

        # Numbered list
        m_num = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m_num:
            n_text = m_num.group(2)
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.15
            add_formatted_runs(p, n_text)
            continue

        # Standard Paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.25
        add_formatted_runs(p, line)

    if in_table:
        flush_table()
    if in_code_block:
        flush_code()

    output_path = r"C:\Users\akash\OneDrive\Desktop\CSE276\docs\FINAL_PROJECT_REPORT.docx"
    doc.save(output_path)
    print(f"Successfully generated formatted report at: {output_path}")

def add_formatted_runs(paragraph, text):
    # Regex to split on bold segments (**text**) and code (`text`)
    pattern = r"(\*\*.*?\*\*|`.*?`|\$.*?\$)"
    tokens = re.split(pattern, text)
    for token in tokens:
        if not token:
            continue
        if token.startswith("**") and token.endswith("**") and len(token) >= 4:
            run = paragraph.add_run(token[2:-2])
            run.font.bold = True
        elif token.startswith("`") and token.endswith("`") and len(token) >= 2:
            run = paragraph.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(185, 28, 28) # Dark Red for inline code
        elif token.startswith("$") and token.endswith("$") and len(token) >= 2:
            run = paragraph.add_run(token[1:-1])
            run.font.italic = True
        else:
            run = paragraph.add_run(token)

if __name__ == "__main__":
    create_document()

