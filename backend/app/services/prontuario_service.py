# filepath: backend/app/services/prontuario_service.py
import logging
from typing import List, Optional
from database.supabase_client import get_supabase_client
from app.schemas.prontuario_schema import (
    ProntuarioCreate,
    ProntuarioUpdate,
    ProntuarioResponse,
    EvolucaoCreate,
    EvolucaoUpdate,
    EvolucaoResponse,
)

logger = logging.getLogger(__name__)


class ProntuarioService:
    def __init__(self):
        self.supabase = get_supabase_client()

    # ============== PRONTUÁRIOS ==============

    async def listar_prontuarios(
        self,
        clinica_id: str,
        paciente_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[ProntuarioResponse]:
        """Lista prontuários da clínica"""
        try:
            response = self.supabase.table("prontuarios").select("*").eq(
                "clinica_id", clinica_id
            )
            
            if paciente_id:
                response = response.eq("paciente_id", paciente_id)

            if search:
                response = response.or_(
                    f"titulo.ilike.%{search}%,descricao.ilike.%{search}%"
                )

            response = response.order("data_criacao", desc=True)
            data = response.execute().data

            logger.info(
                f"✅ Prontuários listados: {len(data)} encontrados (clínica: {clinica_id})"
            )
            return data or []

        except Exception as e:
            logger.error(f"❌ Erro ao listar prontuários: {str(e)}")
            raise

    async def buscar_prontuario(
        self, prontuario_id: str, clinica_id: str
    ) -> ProntuarioResponse:
        """Busca prontuário por ID com evolução e anexos"""
        try:
            # Buscar prontuário
            prontuario = (
                self.supabase.table("prontuarios").select("*")
                .eq("id", prontuario_id)
                .eq("clinica_id", clinica_id)
                .single()
                .execute()
                .data
            )

            if not prontuario:
                raise Exception("Prontuário não encontrado")

            # Buscar evoluções
            evolucoes = (
                self.supabase.table("evolucoes").select("*")
                .eq("prontuario_id", prontuario_id)
                .order("data_criacao", desc=True)
                .execute()
                .data
            )

            # Buscar anexos
            anexos = (
                self.supabase.table("anexos_prontuarios").select("*")
                .eq("prontuario_id", prontuario_id)
                .order("data_criacao", desc=True)
                .execute()
                .data
            )

            prontuario["evolucoes"] = evolucoes or []
            prontuario["anexos"] = anexos or []

            logger.info(f"✅ Prontuário buscado: {prontuario_id}")
            return prontuario

        except Exception as e:
            logger.error(f"❌ Erro ao buscar prontuário: {str(e)}")
            raise

    async def criar_prontuario(
        self, clinica_id: str, user_id: str, data: ProntuarioCreate
    ) -> ProntuarioResponse:
        """Cria novo prontuário"""
        try:
            prontuario_dict = data.model_dump()
            prontuario_dict["clinica_id"] = clinica_id
            prontuario_dict["criado_por"] = user_id

            response = self.supabase.table("prontuarios").insert(prontuario_dict).execute()
            prontuario = response.data[0] if response.data else None

            logger.info(f"✅ Prontuário criado: {prontuario['id']}")
            return prontuario

        except Exception as e:
            logger.error(f"❌ Erro ao criar prontuário: {str(e)}")
            raise

    async def atualizar_prontuario(
        self, prontuario_id: str, clinica_id: str, data: ProntuarioUpdate
    ) -> ProntuarioResponse:
        """Atualiza prontuário"""
        try:
            update_data = data.model_dump(exclude_unset=True)

            update_query = self.supabase.table("prontuarios").update(update_data)
            update_query = update_query.eq("id", prontuario_id)
            update_query = update_query.eq("clinica_id", clinica_id)
            response = update_query.execute()
            prontuario = response.data[0] if response.data else None

            logger.info(f"✅ Prontuário atualizado: {prontuario_id}")
            return prontuario

        except Exception as e:
            logger.error(f"❌ Erro ao atualizar prontuário: {str(e)}")
            raise

    async def deletar_prontuario(self, prontuario_id: str, clinica_id: str) -> None:
        """Deleta prontuário"""
        try:
            delete_query = self.supabase.table("prontuarios").delete()
            delete_query = delete_query.eq("id", prontuario_id)
            delete_query = delete_query.eq("clinica_id", clinica_id)
            delete_query.execute()

            logger.info(f"✅ Prontuário deletado: {prontuario_id}")

        except Exception as e:
            logger.error(f"❌ Erro ao deletar prontuário: {str(e)}")
            raise

    # ============== EVOLUÇÕES ==============

    async def listar_evolucoes(self, prontuario_id: str) -> List[EvolucaoResponse]:
        """Lista evoluções de um prontuário"""
        try:
            query = self.supabase.table("evolucoes").select("*")
            query = query.eq("prontuario_id", prontuario_id)
            query = query.order("data_criacao", desc=True)
            evolucoes = query.execute().data

            logger.info(f"✅ Evoluções listadas: {len(evolucoes)} encontradas")
            return evolucoes or []

        except Exception as e:
            logger.error(f"❌ Erro ao listar evoluções: {str(e)}")
            raise

    async def buscar_evolucao(self, evolucao_id: str) -> EvolucaoResponse:
        """Busca evolução por ID"""
        try:
            query = self.supabase.table("evolucoes").select("*")
            query = query.eq("id", evolucao_id)
            evolucao = query.single().execute().data

            logger.info(f"✅ Evolução buscada: {evolucao_id}")
            return evolucao

        except Exception as e:
            logger.error(f"❌ Erro ao buscar evolução: {str(e)}")
            raise

    async def criar_evolucao(
        self, prontuario_id: str, user_id: str, data: EvolucaoCreate
    ) -> EvolucaoResponse:
        """Cria nova evolução"""
        try:
            evolucao_dict = data.model_dump()
            evolucao_dict["prontuario_id"] = prontuario_id
            evolucao_dict["criado_por"] = user_id

            response = self.supabase.table("evolucoes").insert(evolucao_dict).execute()
            evolucao = response.data[0] if response.data else None

            logger.info(f"✅ Evolução criada: {evolucao['id']}")
            return evolucao

        except Exception as e:
            logger.error(f"❌ Erro ao criar evolução: {str(e)}")
            raise

    async def atualizar_evolucao(
        self, evolucao_id: str, data: EvolucaoUpdate
    ) -> EvolucaoResponse:
        """Atualiza evolução (verifica se é imutável)"""
        try:
            # Verificar se é imutável
            query = self.supabase.table("evolucoes").select("imutavel")
            query = query.eq("id", evolucao_id)
            evolucao = query.single().execute().data

            if evolucao.get("imutavel"):
                raise Exception("Esta evolução está finalizada e não pode ser editada")

            update_data = data.model_dump(exclude_unset=True)
            update_query = self.supabase.table("evolucoes").update(update_data)
            update_query = update_query.eq("id", evolucao_id)
            response = update_query.execute()
            evolucao = response.data[0] if response.data else None

            logger.info(f"✅ Evolução atualizada: {evolucao_id}")
            return evolucao

        except Exception as e:
            logger.error(f"❌ Erro ao atualizar evolução: {str(e)}")
            raise

    async def finalizar_evolucao(self, evolucao_id: str) -> EvolucaoResponse:
        """Finaliza evolução (torna imutável)"""
        try:
            update_query = self.supabase.table("evolucoes").update({"imutavel": True})
            update_query = update_query.eq("id", evolucao_id)
            response = update_query.execute()
            evolucao = response.data[0] if response.data else None

            logger.info(f"✅ Evolução finalizada: {evolucao_id}")
            return evolucao

        except Exception as e:
            logger.error(f"❌ Erro ao finalizar evolução: {str(e)}")
            raise

    async def deletar_evolucao(self, evolucao_id: str) -> None:
        """Deleta evolução (verifica se é imutável)"""
        try:
            # Verificar se é imutável
            query = self.supabase.table("evolucoes").select("imutavel")
            query = query.eq("id", evolucao_id)
            evolucao = query.single().execute().data

            if evolucao.get("imutavel"):
                raise Exception("Esta evolução está finalizada e não pode ser excluída")

            delete_query = self.supabase.table("evolucoes").delete()
            delete_query = delete_query.eq("id", evolucao_id)
            delete_query.execute()

            logger.info(f"✅ Evolução deletada: {evolucao_id}")

        except Exception as e:
            logger.error(f"❌ Erro ao deletar evolução: {str(e)}")
            raise

    # ============== ANEXOS ==============

    async def listar_anexos(
        self, prontuario_id: str, evolucao_id: Optional[str] = None
    ) -> list:
        """Lista anexos de um prontuário"""
        try:
            query = self.supabase.table("anexos_prontuarios").select("*")
            query = query.eq("prontuario_id", prontuario_id)

            if evolucao_id:
                query = query.eq("evolucao_id", evolucao_id)

            query = query.order("data_criacao", desc=True)
            anexos = query.execute().data

            logger.info(f"✅ Anexos listados: {len(anexos)} encontrados")
            return anexos or []

        except Exception as e:
            logger.error(f"❌ Erro ao listar anexos: {str(e)}")
            raise

    async def deletar_anexo(self, anexo_id: str) -> None:
        """Deleta anexo"""
        try:
            delete_query = self.supabase.table("anexos_prontuarios").delete()
            delete_query = delete_query.eq("id", anexo_id)
            delete_query.execute()

            logger.info(f"✅ Anexo deletado: {anexo_id}")

        except Exception as e:
            logger.error(f"❌ Erro ao deletar anexo: {str(e)}")
            raise
