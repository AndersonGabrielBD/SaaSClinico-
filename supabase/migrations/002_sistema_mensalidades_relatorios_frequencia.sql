-- ============================================================================
-- FonoFlow: Migração 002 - Sistema de Mensalidades, Relatórios e Frequência
-- Data: 01/03/2026
-- ============================================================================

-- ============================================================================
-- 1. ALTERAÇÕES EM TABELAS EXISTENTES
-- ============================================================================

-- Adicionar profissional_id à tabela prontuarios para rastreamento
ALTER TABLE public.prontuarios 
ADD COLUMN IF NOT EXISTS profissional_id UUID REFERENCES public.usuarios(id);

-- Atualizar prontuários existentes: definir profissional_id como criado_por
UPDATE public.prontuarios 
SET profissional_id = criado_por 
WHERE profissional_id IS NULL;

-- Criar índice para consultas de prontuários por profissional
CREATE INDEX IF NOT EXISTS idx_prontuarios_profissional ON public.prontuarios(profissional_id, clinica_id);

-- ============================================================================
-- 2. SISTEMA DE MENSALIDADES
-- ============================================================================

-- Tabela de Configuração de Mensalidades por Paciente
CREATE TABLE IF NOT EXISTS public.mensalidades_pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    valor_mensalidade DECIMAL(10,2) NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    criado_por UUID NOT NULL REFERENCES public.usuarios(id),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valor_positivo CHECK (valor_mensalidade > 0),
    CONSTRAINT mensalidade_unica_por_paciente UNIQUE (clinica_id, paciente_id)
);

-- Tabela de Histórico de Pagamentos Mensais
CREATE TABLE IF NOT EXISTS public.pagamentos_mensalidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    mensalidade_id UUID NOT NULL REFERENCES public.mensalidades_pacientes(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    mes_referencia DATE NOT NULL, -- Primeiro dia do mês (ex: 2026-03-01)
    status payment_status DEFAULT 'pendente',
    data_vencimento DATE NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    valor_pago DECIMAL(10,2),
    metodo_pagamento VARCHAR(50), -- 'cartao', 'dinheiro', 'transferencia', 'pix', 'cheque'
    observacoes TEXT,
    registrado_por UUID REFERENCES public.usuarios(id),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT pagamento_unico_por_mes UNIQUE (clinica_id, paciente_id, mes_referencia),
    CONSTRAINT valor_pago_positivo CHECK (valor_pago IS NULL OR valor_pago > 0)
);

-- Índices para otimização de consultas de mensalidades
CREATE INDEX idx_mensalidades_clinica_ativo ON public.mensalidades_pacientes(clinica_id, ativo);
CREATE INDEX idx_mensalidades_paciente ON public.mensalidades_pacientes(paciente_id);

-- Índices para consultas de pagamentos e alertas de vencimento
CREATE INDEX idx_pagamentos_clinica_status ON public.pagamentos_mensalidades(clinica_id, status);
CREATE INDEX idx_pagamentos_mes_referencia ON public.pagamentos_mensalidades(mes_referencia);
CREATE INDEX idx_pagamentos_data_vencimento ON public.pagamentos_mensalidades(data_vencimento);
CREATE INDEX idx_pagamentos_paciente_mes ON public.pagamentos_mensalidades(paciente_id, mes_referencia);

-- ============================================================================
-- 3. SISTEMA DE RELATÓRIOS MÉDICOS
-- ============================================================================

-- Tipo ENUM para tipos de relatórios
CREATE TYPE tipo_relatorio AS ENUM ('atestado', 'laudo', 'receituario', 'declaracao', 'evolucao', 'avaliacao');

-- Tabela de Relatórios
CREATE TABLE IF NOT EXISTS public.relatorios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    prontuario_id UUID REFERENCES public.prontuarios(id) ON DELETE SET NULL,
    profissional_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    tipo_relatorio tipo_relatorio NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    conteudo JSONB NOT NULL, -- Dados do template (campos variáveis)
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    pdf_url TEXT, -- Caminho no Supabase Storage
    assinatura_digital TEXT, -- Texto da assinatura ou URL da imagem
    valido BOOLEAN DEFAULT true,
    observacoes TEXT,
    criado_por UUID NOT NULL REFERENCES public.usuarios(id),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT titulo_valido CHECK (LENGTH(titulo) > 0)
);

-- Índices para relatórios
CREATE INDEX idx_relatorios_clinica ON public.relatorios(clinica_id);
CREATE INDEX idx_relatorios_paciente ON public.relatorios(paciente_id);
CREATE INDEX idx_relatorios_profissional ON public.relatorios(profissional_id);
CREATE INDEX idx_relatorios_prontuario ON public.relatorios(prontuario_id);
CREATE INDEX idx_relatorios_tipo ON public.relatorios(tipo_relatorio);
CREATE INDEX idx_relatorios_data_emissao ON public.relatorios(data_emissao DESC);

-- ============================================================================
-- 4. SISTEMA DE FREQUÊNCIA DE ATENDIMENTOS
-- ============================================================================

-- Tabela de Registro de Frequência
CREATE TABLE IF NOT EXISTS public.frequencia_atendimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    data_atendimento DATE NOT NULL,
    compareceu BOOLEAN NOT NULL,
    observacoes TEXT,
    registrado_por UUID NOT NULL REFERENCES public.usuarios(id),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT frequencia_unica_por_agendamento UNIQUE (agendamento_id)
);

-- Índices para consultas de frequência
CREATE INDEX idx_frequencia_clinica ON public.frequencia_atendimentos(clinica_id);
CREATE INDEX idx_frequencia_paciente_profissional ON public.frequencia_atendimentos(paciente_id, profissional_id);
CREATE INDEX idx_frequencia_profissional ON public.frequencia_atendimentos(profissional_id);
CREATE INDEX idx_frequencia_data ON public.frequencia_atendimentos(data_atendimento DESC);

-- ============================================================================
-- 5. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.mensalidades_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia_atendimentos ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5.1 POLÍTICAS PARA MENSALIDADES_PACIENTES
-- ----------------------------------------------------------------------------

-- SELECT: Admin e recepcao veem tudo, profissional vê apenas seus pacientes
CREATE POLICY "SELECT mensalidades - Admin e Recepcao completo"
ON public.mensalidades_pacientes FOR SELECT
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
        OR EXISTS (
            SELECT 1 FROM public.prontuarios p
            WHERE p.paciente_id = mensalidades_pacientes.paciente_id
            AND p.profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        )
    )
);

-- INSERT/UPDATE/DELETE: Apenas admin e recepcao
CREATE POLICY "INSERT mensalidades - Admin e Recepcao"
ON public.mensalidades_pacientes FOR INSERT
WITH CHECK (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
);

CREATE POLICY "UPDATE mensalidades - Admin e Recepcao"
ON public.mensalidades_pacientes FOR UPDATE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
);

CREATE POLICY "DELETE mensalidades - Admin e Recepcao"
ON public.mensalidades_pacientes FOR DELETE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
);

-- ----------------------------------------------------------------------------
-- 5.2 POLÍTICAS PARA PAGAMENTOS_MENSALIDADES
-- ----------------------------------------------------------------------------

-- SELECT: Admin e recepcao veem tudo, profissional vê apenas seus pacientes
CREATE POLICY "SELECT pagamentos - Admin e Recepcao completo"
ON public.pagamentos_mensalidades FOR SELECT
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
        OR EXISTS (
            SELECT 1 FROM public.prontuarios p
            WHERE p.paciente_id = pagamentos_mensalidades.paciente_id
            AND p.profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        )
    )
);

-- INSERT/UPDATE/DELETE: Apenas admin e recepcao
CREATE POLICY "INSERT pagamentos - Admin e Recepcao"
ON public.pagamentos_mensalidades FOR INSERT
WITH CHECK (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
);

CREATE POLICY "UPDATE pagamentos - Admin e Recepcao"
ON public.pagamentos_mensalidades FOR UPDATE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
);

CREATE POLICY "DELETE pagamentos - Admin e Recepcao"
ON public.pagamentos_mensalidades FOR DELETE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
);

-- ----------------------------------------------------------------------------
-- 5.3 POLÍTICAS PARA RELATORIOS
-- ----------------------------------------------------------------------------

-- SELECT: Admin e recepcao veem tudo, profissional vê apenas seus próprios relatórios
CREATE POLICY "SELECT relatorios"
ON public.relatorios FOR SELECT
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
        OR profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
    )
);

-- INSERT: Profissional pode criar seus próprios relatórios
CREATE POLICY "INSERT relatorios - Profissional"
ON public.relatorios FOR INSERT
WITH CHECK (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
);

-- UPDATE: Apenas o profissional criador ou admin
CREATE POLICY "UPDATE relatorios - Criador ou Admin"
ON public.relatorios FOR UPDATE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    )
);

-- DELETE: Apenas o profissional criador ou admin
CREATE POLICY "DELETE relatorios - Criador ou Admin"
ON public.relatorios FOR DELETE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    )
);

-- ----------------------------------------------------------------------------
-- 5.4 POLÍTICAS PARA FREQUENCIA_ATENDIMENTOS
-- ----------------------------------------------------------------------------

-- SELECT: Admin e recepcao veem tudo, profissional vê apenas seus registros
CREATE POLICY "SELECT frequencia"
ON public.frequencia_atendimentos FOR SELECT
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
        OR profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
    )
);

-- INSERT: Profissional registra frequência dos seus atendimentos
CREATE POLICY "INSERT frequencia - Profissional"
ON public.frequencia_atendimentos FOR INSERT
WITH CHECK (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
    )
);

-- UPDATE: Apenas o profissional que registrou ou admin
CREATE POLICY "UPDATE frequencia - Criador ou Admin"
ON public.frequencia_atendimentos FOR UPDATE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    )
);

-- DELETE: Apenas admin
CREATE POLICY "DELETE frequencia - Admin"
ON public.frequencia_atendimentos FOR DELETE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);

-- ----------------------------------------------------------------------------
-- 5.5 ATUALIZAR POLÍTICAS DE PRONTUÁRIOS (Isolamento por Profissional)
-- ----------------------------------------------------------------------------

-- Remover políticas antigas de SELECT em prontuários se existirem
DROP POLICY IF EXISTS "SELECT prontuarios - Isolamento de clinica" ON public.prontuarios;

-- Nova política: profissional vê apenas seus próprios prontuários
CREATE POLICY "SELECT prontuarios - Por profissional"
ON public.prontuarios FOR SELECT
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'recepcao')
        OR profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
    )
);

-- UPDATE prontuários: apenas profissional criador
DROP POLICY IF EXISTS "UPDATE prontuarios - Isolamento de clinica" ON public.prontuarios;

CREATE POLICY "UPDATE prontuarios - Criador ou Admin"
ON public.prontuarios FOR UPDATE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    )
);

-- DELETE prontuários: apenas profissional criador ou admin
DROP POLICY IF EXISTS "DELETE prontuarios - Isolamento de clinica" ON public.prontuarios;

CREATE POLICY "DELETE prontuarios - Criador ou Admin"
ON public.prontuarios FOR DELETE
USING (
    clinica_id = (current_setting('request.jwt.claims', true)::json->>'clinica_id')::uuid
    AND (
        profissional_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    )
);

-- ============================================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para gerar pagamentos do mês atual para todas as mensalidades ativas
CREATE OR REPLACE FUNCTION gerar_pagamentos_mes_corrente()
RETURNS INTEGER AS $$
DECLARE
    mes_atual DATE := DATE_TRUNC('month', CURRENT_DATE);
    contador INTEGER := 0;
    mensalidade RECORD;
BEGIN
    FOR mensalidade IN 
        SELECT * FROM public.mensalidades_pacientes WHERE ativo = true
    LOOP
        -- Verificar se já existe pagamento para o mês
        IF NOT EXISTS (
            SELECT 1 FROM public.pagamentos_mensalidades
            WHERE mensalidade_id = mensalidade.id
            AND mes_referencia = mes_atual
        ) THEN
            -- Criar pagamento pendente
            INSERT INTO public.pagamentos_mensalidades (
                clinica_id,
                mensalidade_id,
                paciente_id,
                mes_referencia,
                status,
                data_vencimento,
                valor_pago
            ) VALUES (
                mensalidade.clinica_id,
                mensalidade.id,
                mensalidade.paciente_id,
                mes_atual,
                'pendente',
                (mes_atual + (mensalidade.dia_vencimento - 1) * INTERVAL '1 day')::DATE,
                mensalidade.valor_mensalidade
            );
            contador := contador + 1;
        END IF;
    END LOOP;
    
    RETURN contador;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular estatísticas de frequência por paciente e profissional
CREATE OR REPLACE FUNCTION calcular_estatisticas_frequencia(
    p_paciente_id UUID,
    p_profissional_id UUID
)
RETURNS TABLE (
    total_atendimentos BIGINT,
    total_comparecimentos BIGINT,
    total_faltas BIGINT,
    percentual_presenca NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_atendimentos,
        COUNT(*) FILTER (WHERE compareceu = true)::BIGINT as total_comparecimentos,
        COUNT(*) FILTER (WHERE compareceu = false)::BIGINT as total_faltas,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE compareceu = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0
        END as percentual_presenca
    FROM public.frequencia_atendimentos
    WHERE paciente_id = p_paciente_id
    AND profissional_id = p_profissional_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Trigger para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mensalidades_atualizacao
    BEFORE UPDATE ON public.mensalidades_pacientes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_pagamentos_atualizacao
    BEFORE UPDATE ON public.pagamentos_mensalidades
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_relatorios_atualizacao
    BEFORE UPDATE ON public.relatorios
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

-- ============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE public.mensalidades_pacientes IS 'Configuração de mensalidades fixas por paciente';
COMMENT ON TABLE public.pagamentos_mensalidades IS 'Histórico de pagamentos mensais realizados';
COMMENT ON TABLE public.relatorios IS 'Relatórios médicos (atestados, laudos, etc) vinculados ao profissional';
COMMENT ON TABLE public.frequencia_atendimentos IS 'Registro de frequência (comparecimento) por profissional';

COMMENT ON COLUMN public.mensalidades_pacientes.dia_vencimento IS 'Dia do mês para vencimento (1-31)';
COMMENT ON COLUMN public.pagamentos_mensalidades.mes_referencia IS 'Primeiro dia do mês de referência (ex: 2026-03-01)';
COMMENT ON COLUMN public.relatorios.conteudo IS 'Dados JSON do template do relatório';
COMMENT ON COLUMN public.relatorios.pdf_url IS 'URL do PDF gerado no Supabase Storage';

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
