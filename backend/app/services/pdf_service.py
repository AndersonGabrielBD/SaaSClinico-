from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from database.supabase_client import get_supabase_client

class PdfService:
    def __init__(self):
        self.supabase = get_supabase_client()
    
    def generate_pdf(self, relatorio_data):
        """Gera PDF do relatório"""
        tipo = relatorio_data.get('tipo_relatorio')
        
        if tipo == 'atestado':
            return self._generate_atestado(relatorio_data)
        elif tipo == 'laudo':
            return self._generate_laudo(relatorio_data)
        elif tipo == 'receituario':
            return self._generate_receituario(relatorio_data)
        elif tipo == 'declaracao':
            return self._generate_declaracao(relatorio_data)
        elif tipo == 'evolucao':
            return self._generate_evolucao(relatorio_data)
        elif tipo == 'anamnese':
            return self._generate_anamnese(relatorio_data)
        else:
            raise ValueError(f"Tipo de relatório não suportado: {tipo}")
    
    def _get_clinica_data(self, clinica_id):
        """Busca dados da clínica"""
        try:
            response = self.supabase.table('clinicas')\
                .select('*')\
                .eq('id', clinica_id)\
                .single()\
                .execute()
            return response.data
        except:
            return {
                'nome_clinica': 'Clínica',
                'endereco': '',
                'telefone': '',
                'email': ''
            }
    
    def _get_profissional_data(self, profissional_id):
        """Busca dados do profissional"""
        try:
            response = self.supabase.table('usuarios')\
                .select('nome_completo, registro_profissional, especialidade')\
                .eq('id', profissional_id)\
                .single()\
                .execute()
            return response.data
        except:
            return {
                'nome_completo': 'Profissional',
                'registro_profissional': '',
                'especialidade': ''
            }
    
    def _create_header(self, story, clinica_data, styles):
        """Cria cabeçalho padrão do PDF"""
        # Nome da clínica
        story.append(Paragraph(
            f"<b>{clinica_data.get('nome_clinica', 'Clínica')}</b>",
            styles['Title']
        ))
        
        # Dados da clínica
        if clinica_data.get('endereco'):
            story.append(Paragraph(clinica_data['endereco'], styles['Normal']))
        
        info = []
        if clinica_data.get('telefone'):
            info.append(f"Tel: {clinica_data['telefone']}")
        if clinica_data.get('email'):
            info.append(f"Email: {clinica_data['email']}")
        
        if info:
            story.append(Paragraph(' | '.join(info), styles['Normal']))
        
        story.append(Spacer(1, 1*cm))
    
    def _create_footer(self, story, profissional_data, styles):
        """Cria rodapé com dados do profissional"""
        story.append(Spacer(1, 2*cm))
        
        # Linha de assinatura
        story.append(Paragraph("_" * 50, styles['Center']))
        story.append(Spacer(1, 0.3*cm))
        
        # Nome do profissional
        story.append(Paragraph(
            f"<b>{profissional_data.get('nome_completo', 'Profissional')}</b>",
            styles['Center']
        ))
        
        # Registro profissional
        if profissional_data.get('registro_profissional'):
            story.append(Paragraph(
                profissional_data['registro_profissional'],
                styles['Center']
            ))
        
        if profissional_data.get('especialidade'):
            story.append(Paragraph(
                profissional_data['especialidade'],
                styles['Center']
            ))
    
    def _generate_atestado(self, relatorio_data):
        """Gera PDF de atestado médico"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        
        # Estilos
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name='Center',
            parent=styles['Normal'],
            alignment=TA_CENTER
        ))
        styles.add(ParagraphStyle(
            name='Justify',
            parent=styles['Normal'],
            alignment=TA_JUSTIFY,
            spaceAfter=12
        ))
        
        # Busca dados
        clinica_data = self._get_clinica_data(relatorio_data['clinica_id'])
        profissional_data = self._get_profissional_data(relatorio_data['profissional_id'])
        
        # Cabeçalho
        self._create_header(story, clinica_data, styles)
        
        # Título
        story.append(Paragraph("<b>ATESTADO MÉDICO</b>", styles['Title']))
        story.append(Spacer(1, 1*cm))
        
        # Conteúdo
        conteudo = relatorio_data.get('conteudo', {})
        
        texto = f"""Atesto para os devidos fins que o(a) paciente <b>{conteudo.get('nome_paciente', '')}</b>, 
        portador(a) do documento {conteudo.get('documento_paciente', '')}, 
        esteve sob meus cuidados profissionais em {conteudo.get('data_atendimento', datetime.now().strftime('%d/%m/%Y'))}, 
        necessitando de afastamento de suas atividades por <b>{conteudo.get('dias_afastamento', '1')} dia(s)</b>, 
        no período de {conteudo.get('periodo_inicio', '')} a {conteudo.get('periodo_fim', '')}.
        """
        
        if conteudo.get('cid'):
            texto += f"<br/><br/>CID: {conteudo['cid']}"
        
        if conteudo.get('observacoes'):
            texto += f"<br/><br/>Observações: {conteudo['observacoes']}"
        
        story.append(Paragraph(texto, styles['Justify']))
        story.append(Spacer(1, 1*cm))
        
        # Data e local
        data_emissao = relatorio_data.get('data_emissao', datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace('Z', '+00:00'))
        
        story.append(Paragraph(
            f"{conteudo.get('cidade', 'São Paulo')}, {data_emissao.strftime('%d de %B de %Y')}",
            styles['Center']
        ))
        
        # Rodapé
        self._create_footer(story, profissional_data, styles)
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _generate_laudo(self, relatorio_data):
        """Gera PDF de laudo"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Center', parent=styles['Normal'], alignment=TA_CENTER))
        styles.add(ParagraphStyle(name='Justify', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12))
        
        clinica_data = self._get_clinica_data(relatorio_data['clinica_id'])
        profissional_data = self._get_profissional_data(relatorio_data['profissional_id'])
        
        self._create_header(story, clinica_data, styles)
        
        story.append(Paragraph("<b>LAUDO MÉDICO</b>", styles['Title']))
        story.append(Spacer(1, 1*cm))
        
        conteudo = relatorio_data.get('conteudo', {})
        
        # Dados do paciente
        story.append(Paragraph("<b>DADOS DO PACIENTE</b>", styles['Heading2']))
        story.append(Paragraph(f"Nome: {conteudo.get('nome_paciente', '')}", styles['Normal']))
        story.append(Paragraph(f"Documento: {conteudo.get('documento_paciente', '')}", styles['Normal']))
        story.append(Paragraph(f"Data de Nascimento: {conteudo.get('data_nascimento', '')}", styles['Normal']))
        story.append(Spacer(1, 0.5*cm))
        
        # Queixa principal
        if conteudo.get('queixa_principal'):
            story.append(Paragraph("<b>QUEIXA PRINCIPAL</b>", styles['Heading2']))
            story.append(Paragraph(conteudo['queixa_principal'], styles['Justify']))
            story.append(Spacer(1, 0.5*cm))
        
        # Histórico
        if conteudo.get('historico'):
            story.append(Paragraph("<b>HISTÓRICO</b>", styles['Heading2']))
            story.append(Paragraph(conteudo['historico'], styles['Justify']))
            story.append(Spacer(1, 0.5*cm))
        
        # Exame físico
        if conteudo.get('exame_fisico'):
            story.append(Paragraph("<b>EXAME FÍSICO</b>", styles['Heading2']))
            story.append(Paragraph(conteudo['exame_fisico'], styles['Justify']))
            story.append(Spacer(1, 0.5*cm))
        
        # Hipótese diagnóstica
        if conteudo.get('hipotese_diagnostica'):
            story.append(Paragraph("<b>HIPÓTESE DIAGNÓSTICA</b>", styles['Heading2']))
            story.append(Paragraph(conteudo['hipotese_diagnostica'], styles['Justify']))
            story.append(Spacer(1, 0.5*cm))
        
        # Conduta
        if conteudo.get('conduta'):
            story.append(Paragraph("<b>CONDUTA</b>", styles['Heading2']))
            story.append(Paragraph(conteudo['conduta'], styles['Justify']))
        
        data_emissao = relatorio_data.get('data_emissao', datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace('Z', '+00:00'))
        
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph(
            f"{conteudo.get('cidade', 'São Paulo')}, {data_emissao.strftime('%d de %B de %Y')}",
            styles['Center']
        ))
        
        self._create_footer(story, profissional_data, styles)
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _generate_receituario(self, relatorio_data):
        """Gera PDF de receituário"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Center', parent=styles['Normal'], alignment=TA_CENTER))
        
        clinica_data = self._get_clinica_data(relatorio_data['clinica_id'])
        profissional_data = self._get_profissional_data(relatorio_data['profissional_id'])
        
        self._create_header(story, clinica_data, styles)
        
        story.append(Paragraph("<b>RECEITUÁRIO</b>", styles['Title']))
        story.append(Spacer(1, 1*cm))
        
        conteudo = relatorio_data.get('conteudo', {})
        
        story.append(Paragraph(f"Paciente: <b>{conteudo.get('nome_paciente', '')}</b>", styles['Normal']))
        story.append(Spacer(1, 0.5*cm))
        
        # Medicamentos
        medicamentos = conteudo.get('medicamentos', [])
        if medicamentos:
            for i, med in enumerate(medicamentos, 1):
                story.append(Paragraph(f"<b>{i}.</b> {med.get('nome', '')}", styles['Normal']))
                story.append(Paragraph(f"    Posologia: {med.get('posologia', '')}", styles['Normal']))
                if med.get('observacoes'):
                    story.append(Paragraph(f"    Obs: {med.get('observacoes', '')}", styles['Normal']))
                story.append(Spacer(1, 0.3*cm))
        
        if conteudo.get('orientacoes'):
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph("<b>Orientações:</b>", styles['Normal']))
            story.append(Paragraph(conteudo['orientacoes'], styles['Normal']))
        
        data_emissao = relatorio_data.get('data_emissao', datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace('Z', '+00:00'))
        
        story.append(Spacer(1, 2*cm))
        story.append(Paragraph(
            f"{conteudo.get('cidade', 'São Paulo')}, {data_emissao.strftime('%d de %B de %Y')}",
            styles['Center']
        ))
        
        self._create_footer(story, profissional_data, styles)
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _generate_declaracao(self, relatorio_data):
        """Gera PDF de declaração"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Center', parent=styles['Normal'], alignment=TA_CENTER))
        styles.add(ParagraphStyle(name='Justify', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12))
        
        clinica_data = self._get_clinica_data(relatorio_data['clinica_id'])
        profissional_data = self._get_profissional_data(relatorio_data['profissional_id'])
        
        self._create_header(story, clinica_data, styles)
        
        story.append(Paragraph("<b>DECLARAÇÃO</b>", styles['Title']))
        story.append(Spacer(1, 1*cm))
        
        conteudo = relatorio_data.get('conteudo', {})
        
        texto = conteudo.get('texto', f"""Declaro para os devidos fins que o(a) paciente {conteudo.get('nome_paciente', '')}, 
        portador(a) do documento {conteudo.get('documento_paciente', '')}, 
        esteve em consulta comigo nesta data.""")
        
        story.append(Paragraph(texto, styles['Justify']))
        
        data_emissao = relatorio_data.get('data_emissao', datetime.now())
        if isinstance(data_emissao, str):
            data_emissao = datetime.fromisoformat(data_emissao.replace('Z', '+00:00'))
        
        story.append(Spacer(1, 2*cm))
        story.append(Paragraph(
            f"{conteudo.get('cidade', 'São Paulo')}, {data_emissao.strftime('%d de %B de %Y')}",
            styles['Center']
        ))
        
        self._create_footer(story, profissional_data, styles)
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _generate_evolucao(self, relatorio_data):
        """Gera PDF de evolução"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Center', parent=styles['Normal'], alignment=TA_CENTER))
        styles.add(ParagraphStyle(name='Justify', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12))
        
        clinica_data = self._get_clinica_data(relatorio_data['clinica_id'])
        profissional_data = self._get_profissional_data(relatorio_data['profissional_id'])
        
        self._create_header(story, clinica_data, styles)
        
        story.append(Paragraph("<b>EVOLUÇÃO CLÍNICA</b>", styles['Title']))
        story.append(Spacer(1, 1*cm))
        
        conteudo = relatorio_data.get('conteudo', {})
        
        story.append(Paragraph(f"Paciente: <b>{conteudo.get('nome_paciente', '')}</b>", styles['Normal']))
        story.append(Paragraph(f"Data: {conteudo.get('data_atendimento', '')}", styles['Normal']))
        story.append(Spacer(1, 0.5*cm))
        
        if conteudo.get('queixa'):
            story.append(Paragraph("<b>Queixa:</b>", styles['Normal']))
            story.append(Paragraph(conteudo['queixa'], styles['Justify']))
        
        if conteudo.get('evolucao'):
            story.append(Paragraph("<b>Evolução:</b>", styles['Normal']))
            story.append(Paragraph(conteudo['evolucao'], styles['Justify']))
        
        if conteudo.get('conduta'):
            story.append(Paragraph("<b>Conduta:</b>", styles['Normal']))
            story.append(Paragraph(conteudo['conduta'], styles['Justify']))
        
        self._create_footer(story, profissional_data, styles)
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _generate_anamnese(self, relatorio_data):
        """Gera PDF de anamnese"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Center', parent=styles['Normal'], alignment=TA_CENTER))
        styles.add(ParagraphStyle(name='Justify', parent=styles['Normal'], alignment=TA_JUSTIFY, spaceAfter=12))
        
        clinica_data = self._get_clinica_data(relatorio_data['clinica_id'])
        profissional_data = self._get_profissional_data(relatorio_data['profissional_id'])
        
        self._create_header(story, clinica_data, styles)
        
        story.append(Paragraph("<b>ANAMNESE</b>", styles['Title']))
        story.append(Spacer(1, 1*cm))
        
        conteudo = relatorio_data.get('conteudo', {})
        
        # Dados do paciente
        story.append(Paragraph("<b>DADOS DO PACIENTE</b>", styles['Heading2']))
        story.append(Paragraph(f"Nome: {conteudo.get('nome_paciente', '')}", styles['Normal']))
        story.append(Paragraph(f"Data de Nascimento: {conteudo.get('data_nascimento', '')}", styles['Normal']))
        story.append(Paragraph(f"Profissão: {conteudo.get('profissao', '')}", styles['Normal']))
        story.append(Spacer(1, 0.5*cm))
        
        # Campos da anamnese
        campos = [
            ('queixa_principal', 'Queixa Principal'),
            ('historia_doenca_atual', 'História da Doença Atual'),
            ('historia_patologica_pregressa', 'História Patológica Pregressa'),
            ('historia_familiar', 'História Familiar'),
            ('habitos_vida', 'Hábitos de Vida'),
            ('medicamentos_uso', 'Medicamentos em Uso'),
            ('alergias', 'Alergias'),
            ('exame_fisico', 'Exame Físico'),
            ('hipotese_diagnostica', 'Hipótese Diagnóstica'),
            ('plano_tratamento', 'Plano de Tratamento')
        ]
        
        for campo, titulo in campos:
            if conteudo.get(campo):
                story.append(Paragraph(f"<b>{titulo}</b>", styles['Heading3']))
                story.append(Paragraph(conteudo[campo], styles['Justify']))
                story.append(Spacer(1, 0.3*cm))
        
        self._create_footer(story, profissional_data, styles)
        
        doc.build(story)
        buffer.seek(0)
        return buffer