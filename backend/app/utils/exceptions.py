# filepath: backend/app/utils/exceptions.py

class clinnextException(Exception):
    """Exceção base para clinnext"""
    def __init__(self, message, status_code=500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class UnauthorizedException(clinnextException):
    """Usuário não autenticado"""
    def __init__(self, message="Não autenticado"):
        super().__init__(message, 401)


class ForbiddenException(clinnextException):
    """Usuário sem permissão"""
    def __init__(self, message="Sem permissão"):
        super().__init__(message, 403)


class NotFoundException(clinnextException):
    """Recurso não encontrado"""
    def __init__(self, message="Recurso não encontrado"):
        super().__init__(message, 404)


class ConflictException(clinnextException):
    """Conflito (ex: agendamento duplicado, CPF já existe)"""
    def __init__(self, message="Conflito"):
        super().__init__(message, 409)


class ValidationException(clinnextException):
    """Dados inválidos"""
    def __init__(self, message="Dados inválidos"):
        super().__init__(message, 400)


class RLSViolationException(ForbiddenException):
    """RLS violation - tentativa de acessar dados de outra clínica"""
    def __init__(self, message="Acesso negado - RLS policy violated"):
        super().__init__(message)


class ConflictAgendamentoException(ConflictException):
    """Conflito de agendamento"""
    def __init__(self):
        super().__init__("Conflito: Profissional já possui agendamento neste horário")


class CPFAlreadyExistsException(ConflictException):
    """CPF já existe"""
    def __init__(self):
        super().__init__("CPF já cadastrado nesta clínica")


class EmailAlreadyExistsException(ConflictException):
    """Email já existe"""
    def __init__(self):
        super().__init__("Email já cadastrado")


class PacienteNaoEncontradoException(NotFoundException):
    """Paciente não encontrado"""
    def __init__(self):
        super().__init__("Paciente não encontrado")


class AgendamentoNaoEncontradoException(NotFoundException):
    """Agendamento não encontrado"""
    def __init__(self):
        super().__init__("Agendamento não encontrado")

