import logging
from typing import List, Dict, Optional
from datetime import datetime
import os
import uuid
from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class RelatorioService:
    """Serviço para gerenciar relatórios médicos com upload de arquivos"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
        self.bucket_name = 'relatorios'  # Nome do bucket no Supabase Storage
    
    def criar_relatorio(self, clinica_id: str, paciente_id: str, 
                       profissional_id: str, titulo: str,
                       file_content: bytes, file_name: str,
                       tipo_arquivo: str, criado_por: str,
                       observacoes: Optional[str] = None) -> Dict:
        """Cria novo relatório com upload de arquivo"""
        try:
            # Gerar nome único para o arquivo
            file_extension = os.path.splitext(file_name)[1]
            unique_filename = f"{clinica_id}/{paciente_id}/{uuid.uuid4()}{file_extension}"
            
            # Upload para Supabase Storage
            logger.info(f"📤 Fazendo upload do arquivo: {unique_filename}")
            
            storage_response = self.supabase.storage.from_(self.bucket_name).upload(
                path=unique_filename,
                file=file_content,
                file_options={"content-type": tipo_arquivo}
            )
            
            # Obter URL pública
            file_url = self.supabase.storage.from_(self.bucket_name).get_public_url(unique_filename)
            
            # Criar registro no banco
            relatorio_data = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'profissional_id': profissional_id,
                'titulo': titulo,
                'arquivo_url': file_url,
                'arquivo_path': unique_filename,
                'tipo_arquivo': tipo_arquivo,
                'nome_arquivo_original': file_name,
                'observacoes': observacoes,
                'criado_por': criado_por,
                'data_upload': datetime.now().isoformat()
            }
            
            response = self.supabase.table('relatorios') \
                .insert(relatorio_data) \
                .execute()
            
            logger.info(f"✅ Relatório criado com sucesso: {response.data[0]['id']}")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao criar relatório: {str(e)}")
            raise
    
    def listar_relatorios(self, clinica_id: str, filters: Optional[Dict] = None,
                         user_role: Optional[str] = None,
                         user_id: Optional[str] = None) -> List[Dict]:
        """Lista relatórios com filtros opcionais e controle de acesso por role"""
        try:
            query = self.supabase.table('relatorios') \
                .select('''
                    *,
                    pacientes(nome_completo),
                    usuarios!profissional_id(nome_completo)
                ''') \
                .eq('clinica_id', clinica_id)
            
            # Filtro por role: profissional vê apenas seus relatórios
            if user_role and user_role not in ['admin', 'recepcao']:
                query = query.eq('profissional_id', user_id)
            
            # Filtros adicionais
            if filters:
                if 'paciente_id' in filters:
                    query = query.eq('paciente_id', filters['paciente_id'])
                if 'profissional_id' in filters:
                    query = query.eq('profissional_id', filters['profissional_id'])
            
            response = query.order('data_upload', desc=True).execute()
            
            # Formatar resposta
            relatorios = []
            for item in response.data:
                paciente = item.pop('pacientes', None)
                profissional = item.pop('usuarios', None)
                
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                if profissional:
                    item['profissional_nome'] = profissional.get('nome_completo')
                
                relatorios.append(item)
            
            logger.info(f"✅ Listados {len(relatorios)} relatórios")
            return relatorios
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar relatórios: {str(e)}")
            raise
    
    def buscar_relatorio(self, relatorio_id: str, clinica_id: str) -> Dict:
        """Busca um relatório específico"""
        try:
            response = self.supabase.table('relatorios') \
                .select('''
                    *,
                    pacientes(nome_completo, cpf),
                    usuarios!profissional_id(nome_completo, especialidade)
                ''') \
                .eq('id', relatorio_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            
            relatorio = response.data
            paciente = relatorio.pop('pacientes', None)
            profissional = relatorio.pop('usuarios', None)
            
            if paciente:
                relatorio['paciente_nome'] = paciente.get('nome_completo')
                relatorio['paciente_cpf'] = paciente.get('cpf')
            
            if profissional:
                relatorio['profissional_nome'] = profissional.get('nome_completo')
                relatorio['profissional_especialidade'] = profissional.get('especialidade')
            
            logger.info(f"✅ Relatório {relatorio_id} encontrado")
            return relatorio
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar relatório: {str(e)}")
            raise
    
    def download_arquivo(self, relatorio_id: str, clinica_id: str) -> bytes:
        """Faz download do arquivo do relatório"""
        try:
            # Buscar informações do relatório
            relatorio = self.buscar_relatorio(relatorio_id, clinica_id)
            arquivo_path = relatorio.get('arquivo_path')
            
            if not arquivo_path:
                raise ValueError("Relatório não possui arquivo anexado")
            
            # Download do Storage
            logger.info(f"📥 Fazendo download do arquivo: {arquivo_path}")
            file_data = self.supabase.storage.from_(self.bucket_name).download(arquivo_path)
            
            logger.info(f"✅ Arquivo baixado com sucesso")
            return file_data
            
        except Exception as e:
            logger.error(f"❌ Erro ao fazer download: {str(e)}")
            raise
    
    def atualizar_relatorio(self, relatorio_id: str, clinica_id: str, 
                           dados: Dict) -> Dict:
        """Atualiza informações do relatório (não o arquivo)"""
        try:
            # Campos permitidos para atualização
            campos_permitidos = ['titulo', 'observacoes']
            dados_atualizacao = {k: v for k, v in dados.items() if k in campos_permitidos}
            
            response = self.supabase.table('relatorios') \
                .update(dados_atualizacao) \
                .eq('id', relatorio_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Relatório {relatorio_id} atualizado")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar relatório: {str(e)}")
            raise
    
    def excluir_relatorio(self, relatorio_id: str, clinica_id: str) -> None:
        """Exclui relatório e arquivo do storage"""
        try:
            # Buscar informações do relatório
            relatorio = self.buscar_relatorio(relatorio_id, clinica_id)
            arquivo_path = relatorio.get('arquivo_path')
            
            # Excluir arquivo do storage
            if arquivo_path:
                logger.info(f"🗑️ Excluindo arquivo: {arquivo_path}")
                self.supabase.storage.from_(self.bucket_name).remove([arquivo_path])
            
            # Excluir registro do banco
            self.supabase.table('relatorios') \
                .delete() \
                .eq('id', relatorio_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Relatório {relatorio_id} excluído")
            
        except Exception as e:
            logger.error(f"❌ Erro ao excluir relatório: {str(e)}")
            raise
