from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import KeepTogether, Paragraph, Spacer, Table, TableStyle

from app.services.pdf_theme import (
    ClinflowDocTemplate,
    MESES_PT_CAP,
    append_clinic_header_story,
    build_paragraph_styles,
    clinica_theme,
    escape_paragraph_text,
    format_date_long_pt,
    format_date_medium_pt,
    format_date_short,
    plain_text_to_paragraph_xml,
    themed_table_style,
)
from database.supabase_client import get_supabase_client


class PdfService:
    def __init__(self):
        self.supabase = get_supabase_client()

    def generate_pdf(self, relatorio_data):
        """Gera PDF do relatório"""
        tipo = relatorio_data.get("tipo_relatorio")

        if tipo == "atestado":
            return self._generate_atestado(relatorio_data)
        if tipo == "laudo":
            return self._generate_laudo(relatorio_data)
        if tipo == "receituario":
            return self._generate_receituario(relatorio_data)
        if tipo == "declaracao":
            return self._generate_declaracao(relatorio_data)
        if tipo == "evolucao":
            return self._generate_evolucao(relatorio_data)
        if tipo == "anamnese":
            return self._generate_anamnese(relatorio_data)
        raise ValueError(f"Tipo de relatório não suportado: {tipo}")

    def _get_clinica_data(self, clinica_id):
        try:
            response = (
                self.supabase.table("clinicas").select("*").eq("id", clinica_id).single().execute()
            )
            return response.data
        except Exception:
            return {
                "nome_clinica": "Clínica",
                "endereco": "",
                "telefone": "",
                "email": "",
            }

    def _get_profissional_data(self, profissional_id):
        try:
            response = (
                self.supabase.table("usuarios")
                .select("nome_completo, registro_profissional, especialidade")
                .eq("id", profissional_id)
                .single()
                .execute()
            )
            return response.data
        except Exception:
            return {
                "nome_completo": "Profissional",
                "registro_profissional": "",
                "especialidade": "",
            }

    def _doc_with_footer(self, buffer, clinica_data: dict):
        theme = clinica_theme(clinica_data)
        styles = build_paragraph_styles(theme)
        gen_at = datetime.now().strftime("%d/%m/%Y %H:%M")
        nome = (clinica_data or {}).get("nome_clinica") or ""
        doc = ClinflowDocTemplate(
            buffer,
            clinica_nome=nome,
            generated_at=gen_at,
            theme=theme,
        )
        return doc, styles, theme

    def _create_footer(self, story, profissional_data, styles):
        story.append(Spacer(1, 2 * cm))
        story.append(Paragraph("_" * 50, styles["CF_Center"]))
        story.append(Spacer(1, 0.3 * cm))
        story.append(
            Paragraph(
                f"<b>{escape_paragraph_text(profissional_data.get('nome_completo', 'Profissional'))}</b>",
                styles["CF_Center"],
            )
        )
        if profissional_data.get("registro_profissional"):
            story.append(
                Paragraph(
                    escape_paragraph_text(profissional_data["registro_profissional"]),
                    styles["CF_Center"],
                )
            )
        if profissional_data.get("especialidade"):
            story.append(
                Paragraph(
                    escape_paragraph_text(profissional_data["especialidade"]),
                    styles["CF_Center"],
                )
            )

    def _generate_atestado(self, relatorio_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(relatorio_data["clinica_id"])
        profissional_data = self._get_profissional_data(relatorio_data["profissional_id"])
        doc, styles, theme = self._doc_with_footer(buffer, clinica_data)
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>ATESTADO MÉDICO</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.8 * cm))

        conteudo = relatorio_data.get("conteudo", {})
        np = escape_paragraph_text(conteudo.get("nome_paciente", ""))
        docp = escape_paragraph_text(conteudo.get("documento_paciente", ""))
        da = escape_paragraph_text(
            conteudo.get("data_atendimento", datetime.now().strftime("%d/%m/%Y"))
        )
        dias = escape_paragraph_text(str(conteudo.get("dias_afastamento", "1")))
        pi = escape_paragraph_text(conteudo.get("periodo_inicio", ""))
        pf = escape_paragraph_text(conteudo.get("periodo_fim", ""))

        texto = f"""Atesto para os devidos fins que o(a) paciente <b>{np}</b>, portador(a) do documento {docp}, esteve sob meus cuidados profissionais em {da}, necessitando de afastamento de suas atividades por <b>{dias} dia(s)</b>, no período de {pi} a {pf}."""

        if conteudo.get("cid"):
            texto += f"<br/><br/>CID: {escape_paragraph_text(conteudo['cid'])}"
        if conteudo.get("observacoes"):
            texto += f"<br/><br/>Observações: {plain_text_to_paragraph_xml(conteudo['observacoes'])}"

        story.append(Paragraph(texto, styles["CF_BodyJustify"]))
        story.append(Spacer(1, 1 * cm))

        data_emissao = relatorio_data.get("data_emissao", datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace("Z", "+00:00"))
        cidade = escape_paragraph_text(conteudo.get("cidade", "São Paulo"))
        story.append(
            Paragraph(
                f"{cidade}, {format_date_medium_pt(data_emissao)}",
                styles["CF_Center"],
            )
        )
        self._create_footer(story, profissional_data, styles)
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _generate_laudo(self, relatorio_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(relatorio_data["clinica_id"])
        profissional_data = self._get_profissional_data(relatorio_data["profissional_id"])
        doc, styles, theme = self._doc_with_footer(buffer, clinica_data)
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>LAUDO MÉDICO</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.8 * cm))
        conteudo = relatorio_data.get("conteudo", {})

        story.append(Paragraph("<b>DADOS DO PACIENTE</b>", styles["CF_HeadingSection"]))
        story.append(
            Paragraph(
                f"Nome: {escape_paragraph_text(conteudo.get('nome_paciente', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(
            Paragraph(
                f"Documento: {escape_paragraph_text(conteudo.get('documento_paciente', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(
            Paragraph(
                f"Data de Nascimento: {escape_paragraph_text(conteudo.get('data_nascimento', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(Spacer(1, 0.4 * cm))

        blocks = [
            ("queixa_principal", "QUEIXA PRINCIPAL"),
            ("historico", "HISTÓRICO"),
            ("exame_fisico", "EXAME FÍSICO"),
            ("hipotese_diagnostica", "HIPÓTESE DIAGNÓSTICA"),
            ("conduta", "CONDUTA"),
        ]
        for key, title in blocks:
            if conteudo.get(key):
                story.append(Paragraph(f"<b>{title}</b>", styles["CF_HeadingSection"]))
                story.append(
                    Paragraph(plain_text_to_paragraph_xml(conteudo[key]), styles["CF_BodyJustify"])
                )
                story.append(Spacer(1, 0.35 * cm))

        data_emissao = relatorio_data.get("data_emissao", datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace("Z", "+00:00"))
        cidade = escape_paragraph_text(conteudo.get("cidade", "São Paulo"))
        story.append(Spacer(1, 0.6 * cm))
        story.append(
            Paragraph(
                f"{cidade}, {format_date_medium_pt(data_emissao)}",
                styles["CF_Center"],
            )
        )
        self._create_footer(story, profissional_data, styles)
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _generate_receituario(self, relatorio_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(relatorio_data["clinica_id"])
        profissional_data = self._get_profissional_data(relatorio_data["profissional_id"])
        doc, styles, theme = self._doc_with_footer(buffer, clinica_data)
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>RECEITUÁRIO</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.8 * cm))
        conteudo = relatorio_data.get("conteudo", {})
        story.append(
            Paragraph(
                f"Paciente: <b>{escape_paragraph_text(conteudo.get('nome_paciente', ''))}</b>",
                styles["CF_Body"],
            )
        )
        story.append(Spacer(1, 0.45 * cm))

        medicamentos = conteudo.get("medicamentos", [])
        if medicamentos:
            for i, med in enumerate(medicamentos, 1):
                story.append(
                    Paragraph(
                        f"<b>{i}.</b> {escape_paragraph_text(med.get('nome', ''))}",
                        styles["CF_Body"],
                    )
                )
                story.append(
                    Paragraph(
                        f"&nbsp;&nbsp;&nbsp;Posologia: {escape_paragraph_text(med.get('posologia', ''))}",
                        styles["CF_Body"],
                    )
                )
                if med.get("observacoes"):
                    story.append(
                        Paragraph(
                            f"&nbsp;&nbsp;&nbsp;Obs: {plain_text_to_paragraph_xml(med.get('observacoes', ''))}",
                            styles["CF_Body"],
                        )
                    )
                story.append(Spacer(1, 0.25 * cm))

        if conteudo.get("orientacoes"):
            story.append(Spacer(1, 0.35 * cm))
            story.append(Paragraph("<b>Orientações:</b>", styles["CF_Body"]))
            story.append(
                Paragraph(plain_text_to_paragraph_xml(conteudo["orientacoes"]), styles["CF_BodyJustify"])
            )

        data_emissao = relatorio_data.get("data_emissao", datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace("Z", "+00:00"))
        cidade = escape_paragraph_text(conteudo.get("cidade", "São Paulo"))
        story.append(Spacer(1, 1.8 * cm))
        story.append(
            Paragraph(
                f"{cidade}, {format_date_medium_pt(data_emissao)}",
                styles["CF_Center"],
            )
        )
        self._create_footer(story, profissional_data, styles)
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _generate_declaracao(self, relatorio_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(relatorio_data["clinica_id"])
        profissional_data = self._get_profissional_data(relatorio_data["profissional_id"])
        doc, styles, theme = self._doc_with_footer(buffer, clinica_data)
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>DECLARAÇÃO</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.8 * cm))
        conteudo = relatorio_data.get("conteudo", {})
        texto_default = (
            f"Declaro para os devidos fins que o(a) paciente {escape_paragraph_text(conteudo.get('nome_paciente', ''))}, "
            f"portador(a) do documento {escape_paragraph_text(conteudo.get('documento_paciente', ''))}, "
            "esteve em consulta comigo nesta data."
        )
        raw = conteudo.get("texto")
        texto = plain_text_to_paragraph_xml(raw) if raw else texto_default
        story.append(Paragraph(texto, styles["CF_BodyJustify"]))

        data_emissao = relatorio_data.get("data_emissao", datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace("Z", "+00:00"))
        cidade = escape_paragraph_text(conteudo.get("cidade", "São Paulo"))
        story.append(Spacer(1, 1.8 * cm))
        story.append(
            Paragraph(
                f"{cidade}, {format_date_medium_pt(data_emissao)}",
                styles["CF_Center"],
            )
        )
        self._create_footer(story, profissional_data, styles)
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _generate_evolucao(self, relatorio_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(relatorio_data["clinica_id"])
        profissional_data = self._get_profissional_data(relatorio_data["profissional_id"])
        doc, styles, theme = self._doc_with_footer(buffer, clinica_data)
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>EVOLUÇÃO CLÍNICA</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.8 * cm))
        conteudo = relatorio_data.get("conteudo", {})
        story.append(
            Paragraph(
                f"Paciente: <b>{escape_paragraph_text(conteudo.get('nome_paciente', ''))}</b>",
                styles["CF_Body"],
            )
        )
        story.append(
            Paragraph(
                f"Data: {escape_paragraph_text(conteudo.get('data_atendimento', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(Spacer(1, 0.45 * cm))

        if conteudo.get("queixa"):
            story.append(Paragraph("<b>Queixa</b>", styles["CF_HeadingMinor"]))
            story.append(
                Paragraph(plain_text_to_paragraph_xml(conteudo["queixa"]), styles["CF_BodyJustify"])
            )
        if conteudo.get("evolucao"):
            story.append(Paragraph("<b>Evolução</b>", styles["CF_HeadingMinor"]))
            story.append(
                Paragraph(plain_text_to_paragraph_xml(conteudo["evolucao"]), styles["CF_BodyJustify"])
            )
        if conteudo.get("conduta"):
            story.append(Paragraph("<b>Conduta</b>", styles["CF_HeadingMinor"]))
            story.append(
                Paragraph(plain_text_to_paragraph_xml(conteudo["conduta"]), styles["CF_BodyJustify"])
            )

        self._create_footer(story, profissional_data, styles)
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _generate_anamnese(self, relatorio_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(relatorio_data["clinica_id"])
        profissional_data = self._get_profissional_data(relatorio_data["profissional_id"])
        doc, styles, theme = self._doc_with_footer(buffer, clinica_data)
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>ANAMNESE</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.8 * cm))
        conteudo = relatorio_data.get("conteudo", {})

        story.append(Paragraph("<b>DADOS DO PACIENTE</b>", styles["CF_HeadingSection"]))
        story.append(
            Paragraph(
                f"Nome: {escape_paragraph_text(conteudo.get('nome_paciente', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(
            Paragraph(
                f"Data de Nascimento: {escape_paragraph_text(conteudo.get('data_nascimento', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(
            Paragraph(
                f"Profissão: {escape_paragraph_text(conteudo.get('profissao', ''))}",
                styles["CF_Body"],
            )
        )
        story.append(Spacer(1, 0.45 * cm))

        campos = [
            ("queixa_principal", "Queixa Principal"),
            ("historia_doenca_atual", "História da Doença Atual"),
            ("historia_patologica_pregressa", "História Patológica Pregressa"),
            ("historia_familiar", "História Familiar"),
            ("habitos_vida", "Hábitos de Vida"),
            ("medicamentos_uso", "Medicamentos em Uso"),
            ("alergias", "Alergias"),
            ("exame_fisico", "Exame Físico"),
            ("hipotese_diagnostica", "Hipótese Diagnóstica"),
            ("plano_tratamento", "Plano de Tratamento"),
        ]
        for campo, titulo in campos:
            if conteudo.get(campo):
                story.append(Paragraph(f"<b>{titulo}</b>", styles["CF_HeadingMinor"]))
                story.append(
                    Paragraph(plain_text_to_paragraph_xml(conteudo[campo]), styles["CF_BodyJustify"])
                )
                story.append(Spacer(1, 0.25 * cm))

        self._create_footer(story, profissional_data, styles)
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_agenda_pdf(self, agendamentos_data, filtros=None):
        buffer = BytesIO()
        clinica_id = agendamentos_data[0].get("clinica_id") if agendamentos_data else None
        clinica_data = self._get_clinica_data(clinica_id) if clinica_id else {}
        theme = clinica_theme(clinica_data)
        styles = build_paragraph_styles(theme)
        gen_at = datetime.now().strftime("%d/%m/%Y %H:%M")
        doc = ClinflowDocTemplate(
            buffer,
            clinica_nome=(clinica_data or {}).get("nome_clinica") or "",
            generated_at=gen_at,
            theme=theme,
        )
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        titulo = "AGENDA DE ATENDIMENTOS"
        if filtros:
            if filtros.get("data_inicio") and filtros.get("data_fim"):
                titulo += f"<br/>{escape_paragraph_text(filtros['data_inicio'])} a {escape_paragraph_text(filtros['data_fim'])}"
            elif filtros.get("data_agendamento"):
                titulo += f"<br/>{escape_paragraph_text(filtros['data_agendamento'])}"

        story.append(Paragraph(f"<b>{titulo}</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.45 * cm))

        if not agendamentos_data:
            story.append(Paragraph("Nenhum agendamento encontrado.", styles["CF_Body"]))
        else:
            agendamentos_por_data = {}
            for ag in agendamentos_data:
                data = ag.get("data_agendamento", "Sem data")
                agendamentos_por_data.setdefault(data, []).append(ag)

            for data in sorted(agendamentos_por_data.keys()):
                day_story = []
                day_story.append(
                    Paragraph(
                        f"<b>{escape_paragraph_text(self._format_date(data))}</b>",
                        styles["CF_HeadingSection"],
                    )
                )
                day_story.append(Spacer(1, 0.25 * cm))

                table_data = [["Horário", "Paciente", "Profissional", "Status"]]
                for ag in sorted(
                    agendamentos_por_data[data], key=lambda x: x.get("horario_inicio", "")
                ):
                    horario = f"{ag.get('horario_inicio', '')} - {ag.get('horario_fim', '')}"
                    paciente = ag.get(
                        "paciente_nome", ag.get("paciente", {}).get("nome_completo", "N/A")
                    )
                    profissional = ag.get(
                        "profissional_nome", ag.get("profissional", {}).get("nome_completo", "N/A")
                    )
                    status = str(ag.get("status", "N/A")).upper()
                    table_data.append(
                        [
                            escape_paragraph_text(horario),
                            escape_paragraph_text(paciente),
                            escape_paragraph_text(profissional),
                            escape_paragraph_text(status),
                        ]
                    )

                nrows = len(table_data) - 1
                tbl = Table(table_data, colWidths=[3 * cm, 6 * cm, 5 * cm, 3 * cm])
                tbl.setStyle(
                    TableStyle(
                        themed_table_style(theme, header_rows=1, num_data_rows=max(nrows, 0))
                    )
                )
                day_story.append(tbl)
                day_story.append(Spacer(1, 0.65 * cm))

                if nrows <= 18:
                    story.append(KeepTogether(day_story))
                else:
                    story.extend(day_story)

        story.append(Spacer(1, 0.6 * cm))
        story.append(
            Paragraph(
                f"<b>Total de agendamentos:</b> {len(agendamentos_data)}",
                styles["CF_Body"],
            )
        )
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_frequencia_pdf(self, frequencia_data, filtros=None):
        buffer = BytesIO()
        por_profissional = frequencia_data.get("por_profissional", [])
        clinica_id = por_profissional[0].get("clinica_id") if por_profissional else None
        clinica_data = self._get_clinica_data(clinica_id) if clinica_id else {}
        theme = clinica_theme(clinica_data)
        styles = build_paragraph_styles(theme)
        gen_at = datetime.now().strftime("%d/%m/%Y %H:%M")
        doc = ClinflowDocTemplate(
            buffer,
            clinica_nome=(clinica_data or {}).get("nome_clinica") or "",
            generated_at=gen_at,
            theme=theme,
        )
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        mes = filtros.get("mes", "") if filtros else ""
        ano = filtros.get("ano", "") if filtros else ""
        d_ini = filtros.get("data_inicio", "") if filtros else ""
        d_fim = filtros.get("data_fim", "") if filtros else ""
        somente_faltas = bool(filtros.get("somente_faltas")) if filtros else False
        titulo = (
            "RELATÓRIO DE FALTAS (FREQUÊNCIA)"
            if somente_faltas
            else "RELATÓRIO DE FREQUÊNCIA (PRESENÇAS)"
        )
        if d_ini and d_fim:
            titulo += f"<br/>Período: {escape_paragraph_text(d_ini)} a {escape_paragraph_text(d_fim)}"
        elif mes and ano:
            mes_nome = (
                MESES_PT_CAP[int(mes) - 1]
                if str(mes).isdigit() and 1 <= int(mes) <= 12
                else escape_paragraph_text(str(mes))
            )
            titulo += f"<br/>{mes_nome}/{escape_paragraph_text(str(ano))}"

        story.append(Paragraph(f"<b>{titulo}</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.45 * cm))

        if not por_profissional:
            story.append(
                Paragraph("Nenhuma frequência registrada no período.", styles["CF_Body"])
            )
        else:
            for idx, prof in enumerate(por_profissional):
                if idx > 0:
                    story.append(Spacer(1, 0.75 * cm))
                prof_nome = prof.get("profissional_nome", "N/A")
                prof_role = prof.get("profissional_role", "N/A")
                story.append(
                    Paragraph(
                        f"<b>{escape_paragraph_text(prof_nome)}</b> — {escape_paragraph_text(prof_role)}",
                        styles["CF_HeadingSection"],
                    )
                )
                story.append(Spacer(1, 0.25 * cm))

                pacientes = prof.get("pacientes", [])
                if pacientes:
                    table_data = [["Paciente", "Datas de Atendimento", "Total"]]
                    for pac in pacientes:
                        paciente_nome = pac.get("paciente_nome", "N/A")
                        datas = pac.get("datas", [])
                        total = len(datas)
                        if len(datas) <= 3:
                            datas_str = ", ".join(
                                format_date_short(d) for d in datas
                            )
                        else:
                            primeiras = ", ".join(
                                format_date_short(d) for d in datas[:3]
                            )
                            datas_str = f"{primeiras} … (mais {len(datas) - 3})"
                        table_data.append(
                            [
                                escape_paragraph_text(paciente_nome),
                                escape_paragraph_text(datas_str),
                                str(total),
                            ]
                        )
                    nrows = len(table_data) - 1
                    tbl = Table(table_data, colWidths=[6 * cm, 8 * cm, 2 * cm])
                    st = themed_table_style(theme, header_rows=1, num_data_rows=max(nrows, 0))
                    st.append(("ALIGN", (2, 1), (2, -1), "CENTER"))
                    tbl.setStyle(TableStyle(st))
                    story.append(tbl)
                else:
                    story.append(Paragraph("Nenhum paciente atendido.", styles["CF_Meta"]))

        story.append(Spacer(1, 0.6 * cm))
        story.append(
            Paragraph(
                f"<b>Profissionais:</b> {len(por_profissional)}",
                styles["CF_Body"],
            )
        )
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_prontuario_pdf(self, prontuario_data):
        buffer = BytesIO()
        clinica_data = self._get_clinica_data(prontuario_data.get("clinica_id"))
        theme = clinica_theme(clinica_data)
        styles = build_paragraph_styles(theme)
        gen_at = datetime.now().strftime("%d/%m/%Y %H:%M")
        doc = ClinflowDocTemplate(
            buffer,
            clinica_nome=(clinica_data or {}).get("nome_clinica") or "",
            generated_at=gen_at,
            theme=theme,
        )
        story = []
        append_clinic_header_story(story, clinica_data, theme, styles, doc.width)

        story.append(Paragraph("<b>PRONTUÁRIO CLÍNICO</b>", styles["CF_TitleDoc"]))
        story.append(Spacer(1, 0.45 * cm))

        paciente = prontuario_data.get("paciente", {})
        if isinstance(paciente, str):
            p_nome = escape_paragraph_text(paciente)
        else:
            p_nome = escape_paragraph_text(paciente.get("nome_completo", "N/A"))

        resumo_rows = [
            ["Paciente", p_nome],
            ["Prontuário", escape_paragraph_text(prontuario_data.get("titulo", "N/A"))],
            [
                "Abertura",
                escape_paragraph_text(self._format_date(prontuario_data.get("data_criacao", ""))),
            ],
        ]
        rt = Table(resumo_rows, colWidths=[3.2 * cm, doc.width - 3.2 * cm])
        rt.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), theme["secondary"]),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (-1, -1), theme["body_text"]),
                    ("GRID", (0, 0), (-1, -1), 0.25, theme["grid"]),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(rt)
        story.append(Spacer(1, 0.55 * cm))

        for label, key in [
            ("Diagnóstico preliminar", "diagnostico_preliminar"),
            ("Histórico clínico", "historico_clinico"),
            ("Alergias", "alergias"),
            ("Medicações", "medicacoes"),
        ]:
            if prontuario_data.get(key):
                story.append(Paragraph(f"<b>{label}</b>", styles["CF_HeadingMinor"]))
                story.append(
                    Paragraph(
                        plain_text_to_paragraph_xml(prontuario_data[key]),
                        styles["CF_BodyJustify"],
                    )
                )
                story.append(Spacer(1, 0.3 * cm))

        evolucoes = prontuario_data.get("evolucoes", [])
        if evolucoes:
            story.append(Spacer(1, 0.35 * cm))
            story.append(Paragraph("<b>EVOLUÇÕES</b>", styles["CF_HeadingSection"]))
            story.append(Spacer(1, 0.3 * cm))

            for i, evolucao in enumerate(evolucoes, 1):
                head = f"Evolução {i} · {escape_paragraph_text(self._format_date(evolucao.get('data_criacao', '')))}"
                inner = [Paragraph(f"<b>{head}</b>", styles["CF_HeadingMinor"])]
                if evolucao.get("titulo_resumo"):
                    inner.append(
                        Paragraph(
                            f"<i>{escape_paragraph_text(evolucao['titulo_resumo'])}</i>",
                            styles["CF_Body"],
                        )
                    )
                meta_bits = []
                if evolucao.get("data_sessao"):
                    meta_bits.append(
                        f"Sessão: {escape_paragraph_text(self._format_date(evolucao.get('data_sessao', '')))}"
                    )
                if evolucao.get("humor"):
                    meta_bits.append(f"Humor: {escape_paragraph_text(evolucao['humor'])}")
                if evolucao.get("comportamento"):
                    meta_bits.append(
                        f"Comportamento: {escape_paragraph_text(evolucao['comportamento'])}"
                    )
                if meta_bits:
                    inner.append(
                        Paragraph(" · ".join(meta_bits), styles["CF_Meta"]),
                    )
                if evolucao.get("conteudo"):
                    inner.append(
                        Paragraph(
                            plain_text_to_paragraph_xml(evolucao["conteudo"]),
                            styles["CF_BodyJustify"],
                        )
                    )
                if evolucao.get("observacoes"):
                    inner.append(Paragraph("<b>Observações</b>", styles["CF_HeadingMinor"]))
                    inner.append(
                        Paragraph(
                            plain_text_to_paragraph_xml(evolucao["observacoes"]),
                            styles["CF_BodyJustify"],
                        )
                    )

                card = Table([[inner]], colWidths=[doc.width])
                card.setStyle(
                    TableStyle(
                        [
                            ("BOX", (0, 0), (-1, -1), 0.8, theme["grid"]),
                            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                            ("LEFTPADDING", (0, 0), (-1, -1), 10),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                            ("TOPPADDING", (0, 0), (-1, -1), 10),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                        ]
                    )
                )
                story.append(card)
                story.append(Spacer(1, 0.45 * cm))

        story.append(Spacer(1, 0.5 * cm))
        story.append(
            Paragraph(
                "<i>Documento confidencial. Uso exclusivo da equipe de saúde.</i>",
                styles["CF_Center"],
            )
        )
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _format_date(self, date_str):
        return format_date_long_pt(date_str)

    def _format_date_short(self, date_str):
        return format_date_short(date_str)
