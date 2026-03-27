"""
Tema compartilhado para PDFs (ReportLab): cores da clínica, tipografia, rodapé paginado.
"""
from __future__ import annotations

import html
import logging
from datetime import datetime
from io import BytesIO
from typing import Any, Callable, Optional

import requests
from reportlab.lib import colors
from reportlab.lib.colors import Color
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)

DEFAULT_PRIMARY = "#2D6A4F"
DEFAULT_SECONDARY = "#F8F9FA"
DEFAULT_NEUTRAL = "#E9ECEF"

MESES_PT = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
]
MESES_PT_CAP = [m.capitalize() for m in MESES_PT]


def parse_hex_color(value: Optional[str], fallback: str) -> Color:
    raw = (value or "").strip()
    if not raw.startswith("#"):
        raw = f"#{raw}" if raw else fallback
    if len(raw) == 4:  # #RGB
        raw = "#" + "".join(c * 2 for c in raw[1:])
    try:
        return colors.HexColor(raw)
    except Exception:
        return colors.HexColor(fallback)


def clinica_theme(clinica_data: dict) -> dict:
    """Cores e metadados visuais a partir do registro da clínica."""
    data = clinica_data or {}
    primary = parse_hex_color(data.get("cores_primaria"), DEFAULT_PRIMARY)
    secondary = parse_hex_color(data.get("cores_secundaria"), DEFAULT_SECONDARY)
    neutral = parse_hex_color(data.get("cores_neutra"), DEFAULT_NEUTRAL)
    return {
        "primary": primary,
        "secondary": secondary,
        "neutral": neutral,
        "grid": colors.HexColor("#DEE2E6"),
        "muted_text": colors.HexColor("#6C757D"),
        "body_text": colors.HexColor("#212529"),
    }


def escape_paragraph_text(text: Any) -> str:
    """Escapa XML/HTML para uso seguro em ReportLab Paragraph."""
    if text is None:
        return ""
    s = str(text)
    return html.escape(s, quote=False)


def plain_text_to_paragraph_xml(text: Any) -> str:
    """Texto multilinha: escapa e converte quebras em <br/>."""
    esc = escape_paragraph_text(text)
    return esc.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br/>")


def format_date_long_pt(date_str: Any) -> str:
    if not date_str:
        return "N/A"
    try:
        if isinstance(date_str, str):
            if "T" in date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        else:
            dt = date_str
        return f"{dt.day} de {MESES_PT[dt.month - 1]} de {dt.year}"
    except Exception:
        return str(date_str)


def format_date_medium_pt(dt: datetime) -> str:
    return f"{dt.day} de {MESES_PT[dt.month - 1]} de {dt.year}"


def format_date_short(date_str: Any) -> str:
    if not date_str:
        return "N/A"
    try:
        if isinstance(date_str, str):
            if "T" in date_str:
                d = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                d = datetime.strptime(date_str[:10], "%Y-%m-%d")
        else:
            d = date_str
        return d.strftime("%d/%m/%Y")
    except Exception:
        return str(date_str)


def fetch_logo_image(logo_url: Optional[str], timeout: float = 3.0) -> Optional[BytesIO]:
    if not logo_url or not str(logo_url).strip():
        return None
    try:
        r = requests.get(
            str(logo_url).strip(),
            timeout=timeout,
            headers={"User-Agent": "clinnext-PDF/1.0"},
        )
        r.raise_for_status()
        buf = BytesIO(r.content)
        buf.seek(0)
        return buf
    except Exception as e:
        logger.debug("Logo não carregada (%s): %s", logo_url, e)
        return None


def build_paragraph_styles(theme: dict) -> object:
    """Retorna StyleSheet enriquecido (getSampleStyleSheet + estilos de marca)."""
    styles = getSampleStyleSheet()
    body = theme["body_text"]
    primary = theme["primary"]
    muted = theme["muted_text"]

    styles.add(
        ParagraphStyle(
            name="CF_TitleDoc",
            parent=styles["Title"],
            fontSize=17,
            leading=22,
            textColor=primary,
            spaceAfter=14,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_Subtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=14,
            textColor=muted,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_HeadingSection",
            parent=styles["Heading2"],
            fontSize=12,
            leading=15,
            textColor=primary,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_HeadingMinor",
            parent=styles["Heading3"],
            fontSize=11,
            leading=14,
            textColor=body,
            spaceBefore=6,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_Body",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=body,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_BodyJustify",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=body,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_Center",
            parent=styles["Normal"],
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_Meta",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=muted,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_TableHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_TableCell",
            parent=styles["Normal"],
            fontSize=9,
            leading=11,
            textColor=body,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CF_ClinicName",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=primary,
            alignment=TA_LEFT,
            spaceAfter=4,
        )
    )
    return styles


class AccentBarFlowable(Flowable):
    """Faixa horizontal na cor primária."""

    def __init__(self, width: float, height_pt: float = 5, color: Optional[Color] = None):
        Flowable.__init__(self)
        self.width = width
        self.height = height_pt
        self.color = color or colors.HexColor(DEFAULT_PRIMARY)

    def wrap(self, availWidth, availHeight):
        w = min(availWidth, self.width) if self.width else availWidth
        self._draw_width = w
        return w, self.height

    def draw(self):
        w = getattr(self, "_draw_width", self.width or 0)
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, w, self.height, fill=1, stroke=0)


def themed_table_style(
    theme: dict,
    header_rows: int = 1,
    num_data_rows: int = 0,
) -> list:
    """Lista de comandos TableStyle para cabeçalho + zebra."""
    primary = theme["primary"]
    secondary = theme["secondary"]
    neutral = theme["neutral"]
    grid = theme["grid"]
    zebra = [colors.white, secondary]

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), primary),
        ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, header_rows - 1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, header_rows - 1), 8),
        ("TOPPADDING", (0, 0), (-1, header_rows - 1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, primary),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.white),
    ]
    if num_data_rows > 0:
        style_cmds.append(
            ("ROWBACKGROUNDS", (0, header_rows), (-1, -1), zebra),
        )
    style_cmds.extend(
        [
            ("FONTSIZE", (0, header_rows), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.25, grid),
        ]
    )
    return style_cmds


class NumberedCanvas(pdfcanvas.Canvas):
    """Canvas que desenha 'Página x de y' após o build (dois passes internos)."""

    def __init__(self, *args, footer_builder: Optional[Callable] = None, **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states: list = []
        self.footer_builder = footer_builder

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self.footer_builder:
                self.footer_builder(self, num_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)


class ClinflowDocTemplate(BaseDocTemplate):
    """Documento com margens padronizadas e rodapé 'Página x de y'."""

    def __init__(
        self,
        buffer,
        *,
        clinica_nome: str = "",
        generated_at: str = "",
        theme: dict,
        pagesize=A4,
        topMargin=2.2 * cm,
        bottomMargin=2.0 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        show_clinica_in_footer: bool = True,
    ):
        BaseDocTemplate.__init__(
            self,
            buffer,
            pagesize=pagesize,
            topMargin=topMargin,
            bottomMargin=bottomMargin,
            leftMargin=leftMargin,
            rightMargin=rightMargin,
        )
        self._clinica_nome_footer = clinica_nome or ""
        self._generated_at_footer = generated_at
        self._theme_footer = theme
        self._show_clinica_footer = show_clinica_in_footer
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates([PageTemplate(id="main", frames=[frame])])

    def _draw_footer(self, canvas, page_count: int) -> None:
        th = self._theme_footer
        muted = th["muted_text"]
        grid = th["grid"]
        canvas.saveState()
        canvas.setStrokeColor(grid)
        canvas.setLineWidth(0.5)
        w = self.pagesize[0]
        y = 1.1 * cm
        left_m = self.leftMargin
        right_m = self.rightMargin
        canvas.line(left_m, y + 0.35 * cm, w - right_m, y + 0.35 * cm)
        canvas.setFillColor(muted)
        canvas.setFont("Helvetica", 8)
        left = left_m
        right = w - right_m
        prefix = (
            f"{self._clinica_nome_footer} · "
            if (self._show_clinica_footer and self._clinica_nome_footer)
            else ""
        )
        canvas.drawString(left, y, f"{prefix}Gerado em {self._generated_at_footer}")
        canvas.drawRightString(right, y, f"Página {canvas.getPageNumber()} de {page_count}")
        canvas.restoreState()

    def build(self, flowables, canvasmaker=pdfcanvas.Canvas, **kw):
        doc_self = self

        def CanvasFactory(*args, **kwargs):
            return NumberedCanvas(
                *args,
                footer_builder=lambda canvas, n: doc_self._draw_footer(canvas, n),
                **kwargs,
            )

        return BaseDocTemplate.build(self, flowables, canvasmaker=CanvasFactory, **kw)


def append_clinic_header_story(
    story: list,
    clinica_data: dict,
    theme: dict,
    styles: object,
    content_width: float,
) -> None:
    """Faixa de cor, logo opcional e dados da clínica."""
    primary = theme["primary"]
    story.append(AccentBarFlowable(content_width, 4, primary))
    story.append(Spacer(1, 0.35 * cm))

    nome = escape_paragraph_text((clinica_data or {}).get("nome_clinica") or "Clínica")
    endereco = escape_paragraph_text((clinica_data or {}).get("endereco") or "")
    tel = escape_paragraph_text((clinica_data or {}).get("telefone") or "")
    email = escape_paragraph_text((clinica_data or {}).get("email") or "")
    info_parts = []
    if tel:
        info_parts.append(f"Tel: {tel}")
    if email:
        info_parts.append(f"E-mail: {email}")
    info_line = " · ".join(info_parts)

    logo_buf = fetch_logo_image((clinica_data or {}).get("logo_url"))
    logo_flow = None
    if logo_buf:
        try:
            logo_flow = Image(logo_buf)
            logo_flow.drawHeight = 1.35 * cm
            logo_flow.drawWidth = logo_flow.drawHeight * (
                logo_flow.imageWidth / float(logo_flow.imageHeight or 1)
            )
            if logo_flow.drawWidth > 3.2 * cm:
                logo_flow.drawWidth = 3.2 * cm
                logo_flow.drawHeight = logo_flow.drawWidth * (
                    float(logo_flow.imageHeight or 1) / float(logo_flow.imageWidth or 1)
                )
        except Exception as e:
            logger.debug("Imagem de logo inválida: %s", e)
            logo_flow = None

    text_block = [
        Paragraph(f"<b>{nome}</b>", styles["CF_ClinicName"]),
    ]
    if endereco:
        text_block.append(Paragraph(endereco, styles["CF_Meta"]))
    if info_line:
        text_block.append(Paragraph(info_line, styles["CF_Meta"]))

    if logo_flow:
        left_w = 3.4 * cm
        t = Table(
            [[logo_flow, text_block]],
            colWidths=[left_w, max(content_width - left_w, 8 * cm)],
        )
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story.append(t)
    else:
        for p in text_block:
            story.append(p)

    story.append(Spacer(1, 0.75 * cm))
