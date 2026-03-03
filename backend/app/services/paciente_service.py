# filepath: backend/app/services/paciente_service.py
from typing import List, Optional, Dict
from app.repositories.base_repository import BaseRepository
from app.schemas.paciente_schema import PacienteCreate, PacienteUpdate, PacienteResponse
from app.utils.exceptions import NotFoundException, ValidationException
from database.supabase_client import get_supabase_client


class PacienteService:
    """Service de pacientes"""
    
    def __init__(self):
        self.repository = BaseRepository("pacientes")

    async def listar_pacientes(
        self, 
        clinica_id: str, 
        ativo: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[Dict]:
        """Lista pacientes com filtros opcionais"""
        
        client = get_supabase_client()
        query = client.table("pacientes").select("*").eq("clinica_id", clinica_id)
        print(f"Listando pacientes para clínica {clinica_id} com filtros: ativo={ativo}, search='{search}'")
        if ativo is not None:
            query = query.eq("ativo", ativo)
        
        if search:
            # Busca avançada
            query = query.or_(
                f"nome_completo.ilike.%{search}%,"
                f"cpf.ilike.%{search}%,"
                f"email.ilike.%{search}%"
            )
        
        query = query.order("nome_completo")
        result = query.execute()
        print(result)
        return result.data or []

    async def buscar_paciente(self, paciente_id: str, clinica_id: str) -> Dict:
        """Busca paciente por ID"""
        paciente = await self.repository.get_by_id(paciente_id)
        
        if not paciente or paciente.get("clinica_id") != clinica_id:
            raise NotFoundException(f"Paciente {paciente_id} não encontrado")
        
        return paciente

    async def criar_paciente(
        self, 
        paciente: PacienteCreate, 
        clinica_id: str,
        criado_por: str
    ) -> Dict:
        """Cria novo paciente com validação"""
        
        # Valida CPF único (se fornecido)
        if paciente.cpf:
            client = get_supabase_client()
            existing = client.table("pacientes")\
                .select("id")\
                .eq("clinica_id", clinica_id)\
                .eq("cpf", paciente.cpf)\
                .eq("ativo", True)\
                .execute()
            
            if existing.data:
                raise ValidationException("CPF já cadastrado nesta clínica")
        
        # Prepara dados
        paciente_data = paciente.model_dump()
        paciente_data["clinica_id"] = clinica_id
        paciente_data["criado_por"] = criado_por
        paciente_data["ativo"] = True
        
        # Cria
        return await self.repository.create(paciente_data)

    async def atualizar_paciente(
        self,
        paciente_id: str,
        paciente: PacienteUpdate,
        clinica_id: str
    ) -> Dict:
        """Atualiza dados do paciente com validação"""
        
        # Valida se paciente existe
        await self.buscar_paciente(paciente_id, clinica_id)
        
        # Valida CPF único (se alterado)
        if paciente.cpf:
            client = get_supabase_client()
            existing = client.table("pacientes")\
                .select("id")\
                .eq("clinica_id", clinica_id)\
                .eq("cpf", paciente.cpf)\
                .eq("ativo", True)\
                .neq("id", paciente_id)\
                .execute()
            
            if existing.data:
                raise ValidationException("CPF já cadastrado para outro paciente")
        
        # Atualiza apenas campos fornecidos
        paciente_data = paciente.model_dump(exclude_unset=True)
        
        return await self.repository.update(paciente_id, paciente_data)

    async def inativar_paciente(self, paciente_id: str, clinica_id: str):
        """Inativa paciente (soft delete)"""
        
        # Valida se paciente existe
        await self.buscar_paciente(paciente_id, clinica_id)
        
        # Inativa
        await self.repository.update(paciente_id, {"ativo": False})
