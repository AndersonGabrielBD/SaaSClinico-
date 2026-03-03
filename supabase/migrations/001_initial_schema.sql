-- ============================================================================
-- FonoFlow: Schema Inicial do Banco de Dados
-- SaaS Multi-tenant para Clínicas de Fonoaudiologia
-- ============================================================================

-- ============================================================================
-- 1. EXTENSÕES NECESSÁRIAS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TIPOS CUSTOMIZADOS (ENUMS)
-- ============================================================================
CREATE TYPE user_role AS ENUM ('admin', 'fono', 'medico', 'recepcao');
CREATE TYPE appointment_status AS ENUM ('agendada', 'confirmada', 'cancelada', 'faltou', 'concluida');
CREATE TYPE payment_status AS ENUM ('pendente', 'pago', 'parcial', 'cancelado');
CREATE TYPE gender_type AS ENUM ('M', 'F', 'outro');

-- ============================================================================
-- 3. TABELAS GLOBAIS (Sem isolamento de tenant)
-- ============================================================================

-- Tabela de Clínicas (Tenants)
CREATE TABLE IF NOT EXISTS public.clinicas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_clinica VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(9),
    logo_url TEXT,
    cores_primaria VARCHAR(7) DEFAULT '#2D6A4F',
    cores_secundaria VARCHAR(7) DEFAULT '#F8F9FA',
    cores_neutra VARCHAR(7) DEFAULT '#E9ECEF',
    ativo BOOLEAN DEFAULT true,
    plano_assinatura VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT nome_valido CHECK (LENGTH(nome_clinica) > 0),
    CONSTRAINT email_valido CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_clinicas_ativo ON public.clinicas(ativo);
CREATE INDEX idx_clinicas_cnpj ON public.clinicas(cnpj);

-- ============================================================================
-- 4. TABELAS DE AUTENTICAÇÃO E AUTORIZAÇAO
-- ============================================================================

-- Tabela de Usuários (integrada com Supabase Auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    foto_perfil_url TEXT,
    role user_role NOT NULL DEFAULT 'recepcao',
    especialidade VARCHAR(100), -- Para médicos e fonoaudiólogos
    numero_registro VARCHAR(50), -- CRFa, CRM, etc
    ativo BOOLEAN DEFAULT true,
    primeiro_acesso BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deletado_em TIMESTAMP WITH TIME ZONE,
    CONSTRAINT nome_valido CHECK (LENGTH(nome_completo) > 0)
);

CREATE INDEX idx_usuarios_clinica_id ON public.usuarios(clinica_id);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_cpf ON public.usuarios(cpf);
CREATE INDEX idx_usuarios_ativo ON public.usuarios(ativo);
CREATE INDEX idx_usuarios_role ON public.usuarios(role);

-- ============================================================================
-- 5. GESTÃO DE PACIENTES
-- ============================================================================

-- Tabela de Pacientes
CREATE TABLE IF NOT EXISTS public.pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    data_nascimento DATE,
    genero gender_type,
    email VARCHAR(255),
    telefone_principal VARCHAR(20),
    telefone_secundario VARCHAR(20),
    endereco TEXT,
    numero VARCHAR(10),
    complemento VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(9),
    responsavel_nome VARCHAR(255), -- Para menores de idade
    responsavel_telefone VARCHAR(20),
    responsavel_email VARCHAR(255),
    responsavel_relacao VARCHAR(50), -- pai, mae, avó, etc
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    CONSTRAINT nome_paciente_valido CHECK (LENGTH(nome_completo) > 0)
);

CREATE INDEX idx_pacientes_clinica_id ON public.pacientes(clinica_id);
CREATE INDEX idx_pacientes_cpf ON public.pacientes(cpf);
CREATE INDEX idx_pacientes_email ON public.pacientes(email);
CREATE INDEX idx_pacientes_telefone ON public.pacientes(telefone_principal);
CREATE INDEX idx_pacientes_ativo ON public.pacientes(ativo);

-- ============================================================================
-- 6. GESTÃO DE AGENDA
-- ============================================================================

-- Tabela de Salas/Consultórios
CREATE TABLE IF NOT EXISTS public.salas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    capacidade INT DEFAULT 1,
    equipamentos TEXT[], -- Array de strings: ["audiômetro", "impedanciômetro", etc]
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT nome_sala_valido CHECK (LENGTH(nome) > 0)
);

CREATE INDEX idx_salas_clinica_id ON public.salas(clinica_id);
CREATE INDEX idx_salas_ativo ON public.salas(ativo);

-- Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    sala_id UUID REFERENCES public.salas(id) ON DELETE SET NULL,
    data_agendamento DATE NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    tipo_atendimento VARCHAR(100), -- Avaliação, Reavaliação, Seguimento, etc
    status appointment_status DEFAULT 'agendada',
    observacoes TEXT,
    confirmacao_via_sms BOOLEAN DEFAULT false,
    confirmacao_data TIMESTAMP WITH TIME ZONE,
    confirmado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    cancelado_em TIMESTAMP WITH TIME ZONE,
    cancelado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    motivo_cancelamento VARCHAR(255),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    CONSTRAINT horario_valido CHECK (horario_inicio < horario_fim),
    CONSTRAINT data_futura CHECK (data_agendamento >= CURRENT_DATE)
);

CREATE INDEX idx_agendamentos_clinica_id ON public.agendamentos(clinica_id);
CREATE INDEX idx_agendamentos_paciente_id ON public.agendamentos(paciente_id);
CREATE INDEX idx_agendamentos_profissional_id ON public.agendamentos(profissional_id);
CREATE INDEX idx_agendamentos_sala_id ON public.agendamentos(sala_id);
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data_agendamento);
CREATE INDEX idx_agendamentos_status ON public.agendamentos(status);
CREATE INDEX idx_agendamentos_data_profissional ON public.agendamentos(data_agendamento, profissional_id);

-- ============================================================================
-- 7. GESTÃO DE PRONTUÁRIOS E EVOLUÇÕES
-- ============================================================================

-- Tabela de Prontuários
CREATE TABLE IF NOT EXISTS public.prontuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    diagnostico_preliminar TEXT,
    historico_clinico TEXT,
    alergias TEXT,
    medicacoes TEXT,
    visivel_para_paciente BOOLEAN DEFAULT false,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    CONSTRAINT titulo_valido CHECK (LENGTH(titulo) > 0)
);

CREATE INDEX idx_prontuarios_clinica_id ON public.prontuarios(clinica_id);
CREATE INDEX idx_prontuarios_paciente_id ON public.prontuarios(paciente_id);
CREATE INDEX idx_prontuarios_data_criacao ON public.prontuarios(data_criacao);

-- Tabela de Evoluções (Notas de Atendimento)
CREATE TABLE IF NOT EXISTS public.evolucoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    prontuario_id UUID NOT NULL REFERENCES public.prontuarios(id) ON DELETE CASCADE,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    conteudo TEXT NOT NULL,
    observacoes_confidenciais TEXT,
    titulo_resumo VARCHAR(255),
    imutavel BOOLEAN DEFAULT false, -- Após finalizar, não pode ser editado
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    CONSTRAINT conteudo_valido CHECK (LENGTH(conteudo) > 0)
);

CREATE INDEX idx_evolucoes_clinica_id ON public.evolucoes(clinica_id);
CREATE INDEX idx_evolucoes_prontuario_id ON public.evolucoes(prontuario_id);
CREATE INDEX idx_evolucoes_agendamento_id ON public.evolucoes(agendamento_id);
CREATE INDEX idx_evolucoes_data_criacao ON public.evolucoes(data_criacao);

-- Tabela de Anexos de Prontuários (PDF, Imagens de Exames, etc)
CREATE TABLE IF NOT EXISTS public.anexos_prontuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    evolucao_id UUID REFERENCES public.evolucoes(id) ON DELETE CASCADE,
    prontuario_id UUID REFERENCES public.prontuarios(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(50), -- pdf, image, audio, video
    caminho_arquivo TEXT NOT NULL, -- Caminho no Supabase Storage
    tamanho_bytes INT,
    descricao VARCHAR(255),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_anexos_clinica_id ON public.anexos_prontuarios(clinica_id);
CREATE INDEX idx_anexos_evolucao_id ON public.anexos_prontuarios(evolucao_id);
CREATE INDEX idx_anexos_prontuario_id ON public.anexos_prontuarios(prontuario_id);

-- ============================================================================
-- 8. GESTÃO FINANCEIRA
-- ============================================================================

-- Tabela de Planos de Preço/Serviços
CREATE TABLE IF NOT EXISTS public.servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco_padrao DECIMAL(10, 2) NOT NULL,
    tempo_estimado_minutos INT,
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT preco_valido CHECK (preco_padrao >= 0)
);

CREATE INDEX idx_servicos_clinica_id ON public.servicos(clinica_id);
CREATE INDEX idx_servicos_ativo ON public.servicos(ativo);

-- Tabela de Lançamentos Financeiros
CREATE TABLE IF NOT EXISTS public.lancamentos_financeiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    tipo_valor VARCHAR(20) DEFAULT 'credito', -- credito, debito
    status payment_status DEFAULT 'pendente',
    data_vencimento DATE,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    metodo_pagamento VARCHAR(50), -- cartao, dinheiro, transferencia, cheque, pix
    observacoes TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    CONSTRAINT valor_valido CHECK (valor > 0)
);

CREATE INDEX idx_lancamentos_clinica_id ON public.lancamentos_financeiros(clinica_id);
CREATE INDEX idx_lancamentos_paciente_id ON public.lancamentos_financeiros(paciente_id);
CREATE INDEX idx_lancamentos_agendamento_id ON public.lancamentos_financeiros(agendamento_id);
CREATE INDEX idx_lancamentos_status ON public.lancamentos_financeiros(status);
CREATE INDEX idx_lancamentos_data_criacao ON public.lancamentos_financeiros(data_criacao);

-- ============================================================================
-- 9. AUDITORIA E LOGS
-- ============================================================================

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tabela_afetada VARCHAR(100) NOT NULL,
    registro_id UUID,
    acao VARCHAR(50), -- INSERT, UPDATE, DELETE, VIEW
    dados_anteriores JSONB,
    dados_novos JSONB,
    alteracoes_resumo JSONB,
    endereco_ip VARCHAR(45),
    user_agent TEXT,
    data_acao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_clinica_id ON public.audit_logs(clinica_id);
CREATE INDEX idx_audit_usuario_id ON public.audit_logs(usuario_id);
CREATE INDEX idx_audit_tabela ON public.audit_logs(tabela_afetada);
CREATE INDEX idx_audit_data_acao ON public.audit_logs(data_acao);
CREATE INDEX idx_audit_registro ON public.audit_logs(tabela_afetada, registro_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Ativar RLS em todas as tabelas de tenant
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos_prontuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - FUNÇÃO AUXILIAR
-- ============================================================================

-- Função para obter clinica_id do JWT
CREATE OR REPLACE FUNCTION get_clinica_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'clinica_id')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função para obter user_id do JWT
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- RLS POLICIES - USUARIOS
-- ============================================================================

-- Usuários podem ver apenas usuários da mesma clínica
CREATE POLICY "usuarios_select_same_clinica" ON public.usuarios
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Usuários podem inserir novos usuários (Admin only - será aplicado via service)
CREATE POLICY "usuarios_insert_own_clinica" ON public.usuarios
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Usuários podem atualizar usuários da mesma clínica
CREATE POLICY "usuarios_update_own_clinica" ON public.usuarios
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- Usuários podem deletar (soft delete) usuários da mesma clínica
CREATE POLICY "usuarios_delete_own_clinica" ON public.usuarios
    FOR DELETE
    USING (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - PACIENTES
-- ============================================================================

-- Pacientes podem ser lidos apenas por usuários da mesma clínica
CREATE POLICY "pacientes_select_same_clinica" ON public.pacientes
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Pacientes podem ser inseridos por usuários da mesma clínica
CREATE POLICY "pacientes_insert_own_clinica" ON public.pacientes
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Pacientes podem ser atualizados por usuários da mesma clínica
CREATE POLICY "pacientes_update_own_clinica" ON public.pacientes
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- Pacientes podem ser deletados por usuários da mesma clínica
CREATE POLICY "pacientes_delete_own_clinica" ON public.pacientes
    FOR DELETE
    USING (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - SALAS
-- ============================================================================

-- Salas podem ser lidas apenas por usuários da mesma clínica
CREATE POLICY "salas_select_same_clinica" ON public.salas
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Salas podem ser inseridas por usuários da mesma clínica (Admin only)
CREATE POLICY "salas_insert_own_clinica" ON public.salas
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Salas podem ser atualizadas por usuários da mesma clínica (Admin only)
CREATE POLICY "salas_update_own_clinica" ON public.salas
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - AGENDAMENTOS
-- ============================================================================

-- Agendamentos podem ser lidos por usuários da mesma clínica
CREATE POLICY "agendamentos_select_same_clinica" ON public.agendamentos
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Agendamentos podem ser inseridos por usuários da mesma clínica
CREATE POLICY "agendamentos_insert_own_clinica" ON public.agendamentos
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Agendamentos podem ser atualizados por usuários da mesma clínica
CREATE POLICY "agendamentos_update_own_clinica" ON public.agendamentos
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- Agendamentos podem ser deletados por usuários da mesma clínica
CREATE POLICY "agendamentos_delete_own_clinica" ON public.agendamentos
    FOR DELETE
    USING (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - PRONTUÁRIOS
-- ============================================================================

-- Prontuários podem ser lidos por usuários da mesma clínica
CREATE POLICY "prontuarios_select_same_clinica" ON public.prontuarios
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Prontuários podem ser inseridos por usuários da mesma clínica
CREATE POLICY "prontuarios_insert_own_clinica" ON public.prontuarios
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Prontuários podem ser atualizados por usuários da mesma clínica
CREATE POLICY "prontuarios_update_own_clinica" ON public.prontuarios
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - EVOLUÇÕES
-- ============================================================================

-- Evoluções podem ser lidas por usuários da mesma clínica
CREATE POLICY "evolucoes_select_same_clinica" ON public.evolucoes
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Evoluções podem ser inseridas por usuários da mesma clínica
CREATE POLICY "evolucoes_insert_own_clinica" ON public.evolucoes
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Evoluções imutáveis não podem ser atualizadas (apenas criador pode atualizar se não imutável)
CREATE POLICY "evolucoes_update_own_clinica" ON public.evolucoes
    FOR UPDATE
    USING (clinica_id = get_clinica_id() AND NOT imutavel AND criado_por = get_user_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - ANEXOS DE PRONTUÁRIOS
-- ============================================================================

-- Anexos podem ser lidos por usuários da mesma clínica
CREATE POLICY "anexos_select_same_clinica" ON public.anexos_prontuarios
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Anexos podem ser inseridos por usuários da mesma clínica
CREATE POLICY "anexos_insert_own_clinica" ON public.anexos_prontuarios
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Anexos podem ser deletados apenas por quem criou (ou admin)
CREATE POLICY "anexos_delete_criador" ON public.anexos_prontuarios
    FOR DELETE
    USING (clinica_id = get_clinica_id() AND criado_por = get_user_id());

-- ============================================================================
-- RLS POLICIES - SERVIÇOS
-- ============================================================================

-- Serviços podem ser lidos por usuários da mesma clínica
CREATE POLICY "servicos_select_same_clinica" ON public.servicos
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Serviços podem ser inseridos por usuários da mesma clínica (Admin only)
CREATE POLICY "servicos_insert_own_clinica" ON public.servicos
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Serviços podem ser atualizados por usuários da mesma clínica (Admin only)
CREATE POLICY "servicos_update_own_clinica" ON public.servicos
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - LANÇAMENTOS FINANCEIROS
-- ============================================================================

-- Lançamentos podem ser lidos por usuários da mesma clínica
CREATE POLICY "lancamentos_select_same_clinica" ON public.lancamentos_financeiros
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Lançamentos podem ser inseridos por usuários da mesma clínica
CREATE POLICY "lancamentos_insert_own_clinica" ON public.lancamentos_financeiros
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- Lançamentos podem ser atualizados por usuários da mesma clínica
CREATE POLICY "lancamentos_update_own_clinica" ON public.lancamentos_financeiros
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- RLS POLICIES - AUDIT LOGS
-- ============================================================================

-- Logs de auditoria podem ser lidos apenas por usuários da mesma clínica (Admin only)
CREATE POLICY "audit_logs_select_same_clinica" ON public.audit_logs
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- Logs de auditoria podem ser inseridos (gerado automaticamente)
CREATE POLICY "audit_logs_insert_own_clinica" ON public.audit_logs
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- ============================================================================
-- TRIGGERS AUXILIARES
-- ============================================================================

-- Atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clinicas_timestamp
    BEFORE UPDATE ON public.clinicas
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_usuarios_timestamp
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_pacientes_timestamp
    BEFORE UPDATE ON public.pacientes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_agendamentos_timestamp
    BEFORE UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_prontuarios_timestamp
    BEFORE UPDATE ON public.prontuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_evolucoes_timestamp
    BEFORE UPDATE ON public.evolucoes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_salas_timestamp
    BEFORE UPDATE ON public.salas
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_servicos_timestamp
    BEFORE UPDATE ON public.servicos
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_lancamentos_timestamp
    BEFORE UPDATE ON public.lancamentos_financeiros
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE public.clinicas IS 'Tabela global contendo as clínicas (tenants) do sistema FonoFlow';
COMMENT ON TABLE public.usuarios IS 'Usuários do sistema, isolados por clinica_id';
COMMENT ON TABLE public.pacientes IS 'Pacientes das clínicas, isolados por clinica_id';
COMMENT ON TABLE public.agendamentos IS 'Agendamentos de atendimentos, isolados por clinica_id';
COMMENT ON TABLE public.prontuarios IS 'Prontuários eletrônicos dos pacientes, isolados por clinica_id';
COMMENT ON TABLE public.evolucoes IS 'Notas de evolução de atendimentos, isoladas por clinica_id';
COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria para compliance LGPD';

COMMENT ON FUNCTION get_clinica_id() IS 'Extrai clinica_id do JWT do usuário logado';
COMMENT ON FUNCTION get_user_id() IS 'Extrai user_id (UUID auth) do usuário logado';
