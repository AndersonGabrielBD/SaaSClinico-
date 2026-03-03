-- ============================================================================
-- FonoFlow: Triggers e Funções Avançadas
-- ============================================================================

-- ============================================================================
-- 1. AUDITORIA AUTOMÁTICA (LGPD COMPLIANCE)
-- ============================================================================

-- Função para registrar auditoria em INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_alteracoes JSONB;
    v_dados_anteriores JSONB;
    v_dados_novos JSONB;
    v_request_headers JSONB := '{}'::JSONB;
BEGIN
    BEGIN
        v_request_headers := COALESCE(current_setting('request.headers', true), '{}')::JSONB;
    EXCEPTION WHEN OTHERS THEN
        v_request_headers := '{}'::JSONB;
    END;

    -- Para INSERT
    IF TG_OP = 'INSERT' THEN
        v_dados_anteriores := NULL;
        v_dados_novos := to_jsonb(NEW);
        v_alteracoes := v_dados_novos;
    
    -- Para UPDATE
    ELSIF TG_OP = 'UPDATE' THEN
        v_dados_anteriores := to_jsonb(OLD);
        v_dados_novos := to_jsonb(NEW);
        
        -- Captura apenas campos que foram alterados
        SELECT jsonb_object_agg(key, value)
        INTO v_alteracoes
        FROM (
            SELECT key, value
            FROM jsonb_each(v_dados_novos)
            WHERE value != v_dados_anteriores ->> key
        ) AS changed;
    
    -- Para DELETE
    ELSIF TG_OP = 'DELETE' THEN
        v_dados_anteriores := to_jsonb(OLD);
        v_dados_novos := NULL;
        v_alteracoes := v_dados_anteriores;
    END IF;

    -- Insere registro de auditoria
    INSERT INTO public.audit_logs (
        clinica_id,
        usuario_id,
        tabela_afetada,
        registro_id,
        acao,
        dados_anteriores,
        dados_novos,
        alteracoes_resumo,
        endereco_ip,
        user_agent,
        data_acao
    ) VALUES (
        CASE 
            WHEN TG_OP = 'INSERT' THEN NEW.clinica_id
            WHEN TG_OP = 'UPDATE' THEN NEW.clinica_id
            WHEN TG_OP = 'DELETE' THEN OLD.clinica_id
        END,
        auth.uid(),
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'INSERT' THEN NEW.id
            WHEN TG_OP = 'UPDATE' THEN NEW.id
            WHEN TG_OP = 'DELETE' THEN OLD.id
        END,
        TG_OP,
        v_dados_anteriores,
        v_dados_novos,
        v_alteracoes,
        v_request_headers->>'x-forwarded-for',
        v_request_headers->>'user-agent',
        NOW()
    );

    -- Retorna novo registro (ou NULL se DELETE)
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers de auditoria para tabelas sensíveis
DROP TRIGGER IF EXISTS audit_usuarios ON public.usuarios;
CREATE TRIGGER audit_usuarios AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_pacientes ON public.pacientes;
CREATE TRIGGER audit_pacientes AFTER INSERT OR UPDATE OR DELETE ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_agendamentos ON public.agendamentos;
CREATE TRIGGER audit_agendamentos AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_prontuarios ON public.prontuarios;
CREATE TRIGGER audit_prontuarios AFTER INSERT OR UPDATE OR DELETE ON public.prontuarios
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_evolucoes ON public.evolucoes;
CREATE TRIGGER audit_evolucoes AFTER INSERT OR UPDATE OR DELETE ON public.evolucoes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_lancamentos ON public.lancamentos_financeiros;
CREATE TRIGGER audit_lancamentos AFTER INSERT OR UPDATE ON public.lancamentos_financeiros
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- 2. VALIDAÇÕES DE CONFLITO DE AGENDA
-- ============================================================================

-- Função para detectar e impedir conflitos de horário
CREATE OR REPLACE FUNCTION validar_conflito_agendamento()
RETURNS TRIGGER AS $$
DECLARE
    v_conflito_count INT;
    v_conflito_profissional INT;
    v_conflito_sala INT;
BEGIN
    -- Apenas valida se está sendo agendado ou confirmado
    IF NEW.status IN ('agendada', 'confirmada') THEN
        
        -- ✅ Validar conflito com mesmo profissional
        SELECT COUNT(*)
        INTO v_conflito_profissional
        FROM public.agendamentos
        WHERE clinica_id = NEW.clinica_id
          AND id != NEW.id  -- Não comparar com ele mesmo
          AND profissional_id = NEW.profissional_id
          AND data_agendamento = NEW.data_agendamento
          AND (horario_inicio, horario_fim) OVERLAPS (NEW.horario_inicio, NEW.horario_fim)
          AND status IN ('agendada', 'confirmada');

        IF v_conflito_profissional > 0 THEN
            RAISE EXCEPTION 'Conflito: Profissional já possui agendamento neste horário';
        END IF;

        -- ✅ Validar conflito com mesma sala (se sala foi selecionada)
        IF NEW.sala_id IS NOT NULL THEN
            SELECT COUNT(*)
            INTO v_conflito_sala
            FROM public.agendamentos
            WHERE clinica_id = NEW.clinica_id
              AND id != NEW.id
              AND sala_id = NEW.sala_id
              AND data_agendamento = NEW.data_agendamento
              AND (horario_inicio, horario_fim) OVERLAPS (NEW.horario_inicio, NEW.horario_fim)
              AND status IN ('agendada', 'confirmada');

            IF v_conflito_sala > 0 THEN
                RAISE EXCEPTION 'Conflito: Sala já está ocupada neste horário';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar trigger de validação de conflito
DROP TRIGGER IF EXISTS validar_conflito_agendamento_trigger ON public.agendamentos;
CREATE TRIGGER validar_conflito_agendamento_trigger
    BEFORE INSERT OR UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION validar_conflito_agendamento();

-- ============================================================================
-- 3. AUTO-CRIAÇÃO DE LANÇAMENTOS FINANCEIROS
-- ============================================================================

-- Função para criar lançamento quando agendamento é concluído
CREATE OR REPLACE FUNCTION criar_lancamento_ao_concluir_agendamento()
RETURNS TRIGGER AS $$
DECLARE
    v_servico_padrao_id UUID;
    v_preco DECIMAL(10, 2);
BEGIN
    -- Apenas cria se status mudou para 'concluida'
    IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status != 'concluida') THEN
        
        -- Busca um serviço padrão ou usa valor fixo
        -- Nota: Você pode implementar lógica mais complexa aqui
        
        -- Cria lançamento pendente automático
        INSERT INTO public.lancamentos_financeiros (
            clinica_id,
            agendamento_id,
            paciente_id,
            descricao,
            valor,
            tipo_valor,
            status,
            metodo_pagamento,
            criado_por,
            data_criacao
        ) VALUES (
            NEW.clinica_id,
            NEW.id,
            NEW.paciente_id,
            'Consulta de ' || NEW.tipo_atendimento || ' em ' || TO_CHAR(NEW.data_agendamento, 'DD/MM/YYYY'),
            COALESCE(v_preco, 100.00),  -- Valor padrão se não encontrar
            'credito',
            'pendente',
            NULL,
            NEW.profissional_id,
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-criar lançamento financeiro
DROP TRIGGER IF EXISTS criar_lancamento_ao_concluir_agendamento_trigger ON public.agendamentos;
CREATE TRIGGER criar_lancamento_ao_concluir_agendamento_trigger
    AFTER UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION criar_lancamento_ao_concluir_agendamento();

-- ============================================================================
-- 4. VALIDAÇÕES DE DADOS
-- ============================================================================

-- Função para validar CPF (formato básico)
CREATE OR REPLACE FUNCTION validar_cpf(cpf_input VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove caracteres especiais
    cpf_input := REPLACE(REPLACE(REPLACE(cpf_input, '.', ''), '-', ''), ' ', '');
    
    -- Valida formato (11 dígitos)
    RETURN cpf_input ~ '^\d{11}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar email
CREATE OR REPLACE FUNCTION validar_email(email_input VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email_input ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar CPF único por clínica
CREATE OR REPLACE FUNCTION validar_cpf_unico()
RETURNS TRIGGER AS $$
DECLARE
    v_cpf_exists INT;
BEGIN
    -- Verifica se CPF já existe nesta clínica
    IF NEW.cpf IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_cpf_exists
        FROM public.pacientes
        WHERE clinica_id = NEW.clinica_id
          AND cpf = NEW.cpf
          AND id != NEW.id
          AND ativo = true;

        IF v_cpf_exists > 0 THEN
            RAISE EXCEPTION 'CPF já cadastrado nesta clínica';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar CPF único
DROP TRIGGER IF EXISTS validar_cpf_unico_trigger ON public.pacientes;
CREATE TRIGGER validar_cpf_unico_trigger
    BEFORE INSERT OR UPDATE ON public.pacientes
    FOR EACH ROW
    EXECUTE FUNCTION validar_cpf_unico();

-- ============================================================================
-- 5. LIMPEZA E RETENÇÃO DE DADOS
-- ============================================================================

-- Função para soft-delete com retenção de dados
CREATE OR REPLACE FUNCTION soft_delete_usuario()
RETURNS TRIGGER AS $$
BEGIN
    -- Registra quem deletou e quando
    IF TG_OP = 'UPDATE' AND NEW.ativo = false AND OLD.ativo = true THEN
        UPDATE public.usuarios
        SET deletado_em = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar soft delete
DROP TRIGGER IF EXISTS soft_delete_usuario_trigger ON public.usuarios;
CREATE TRIGGER soft_delete_usuario_trigger
    AFTER UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_usuario();

-- Função para remover dados após retenção (LGPD - direito ao esquecimento)
-- Será executada por job agendado
CREATE OR REPLACE FUNCTION remover_dados_retencao()
RETURNS TABLE(tabela VARCHAR, registros_removidos INT) AS $$
DECLARE
    v_dias_retencao INT := 365;  -- 1 ano
    v_count INT;
BEGIN
    -- Remove eventos de auditoria antigos
    DELETE FROM public.audit_logs
    WHERE data_acao < NOW() - INTERVAL '1 year'
      AND tabela_afetada NOT IN ('pacientes', 'prontuarios', 'evolucoes');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'audit_logs'::VARCHAR, v_count;

    -- Remove agendamentos cancelados muito antigos
    DELETE FROM public.agendamentos
    WHERE status = 'cancelada'
      AND data_atualizacao < NOW() - INTERVAL '2 years';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'agendamentos_cancelados'::VARCHAR, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. SINCRONIZAÇÃO COM AUTH
-- ============================================================================

-- Função executada após criação de usuário no Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando um novo usuário é criado no auth.users,
    -- esta função pode ser acionada (se configurado no webhook)
    -- Para criar registro correspondente em public.usuarios
    
    -- Nota: Implementar conforme necessário
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. AGREGAÇÕES E CACHE
-- ============================================================================

-- Tabela de cache para dashboard (atualizada periodicamente)
CREATE TABLE IF NOT EXISTS public.dashboard_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    data_cache_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_pacientes INT,
    total_agendamentos_mes INT,
    total_faturamento_mes DECIMAL(10,2),
    taxa_confirmacao DECIMAL(5,2),
    agendamentos_dia INT,
    pendencias_abertas INT
);

CREATE INDEX idx_dashboard_cache_clinica ON public.dashboard_cache(clinica_id);

-- Função para atualizar cache do dashboard (executar por cron)
CREATE OR REPLACE FUNCTION atualizar_dashboard_cache()
RETURNS TABLE(clinica_id UUID, sucesso BOOLEAN) AS $$
DECLARE
    v_clinicas RECORD;
BEGIN
    -- Itera por cada clínica
    FOR v_clinicas IN SELECT id FROM public.clinicas WHERE ativo = true LOOP
        
        -- Delete entry anterior
        DELETE FROM public.dashboard_cache WHERE clinica_id = v_clinicas.id;
        
        -- Insert novo cache
        INSERT INTO public.dashboard_cache (
            clinica_id,
            total_pacientes,
            total_agendamentos_mes,
            total_faturamento_mes,
            taxa_confirmacao,
            agendamentos_dia,
            pendencias_abertas
        ) SELECT
            v_clinicas.id,
            (SELECT COUNT(*) FROM public.pacientes WHERE clinica_id = v_clinicas.id AND ativo = true),
            (SELECT COUNT(*) FROM public.agendamentos 
             WHERE clinica_id = v_clinicas.id 
             AND DATE_TRUNC('month', data_agendamento) = DATE_TRUNC('month', CURRENT_DATE)),
            (SELECT COALESCE(SUM(valor), 0) FROM public.lancamentos_financeiros 
             WHERE clinica_id = v_clinicas.id AND status = 'pago'
             AND DATE_TRUNC('month', data_pagamento) = DATE_TRUNC('month', CURRENT_DATE)),
            (SELECT COUNT(CASE WHEN status = 'confirmada' THEN 1 END)::DECIMAL 
                    / COUNT(*)::DECIMAL * 100
             FROM public.agendamentos 
             WHERE clinica_id = v_clinicas.id),
            (SELECT COUNT(*) FROM public.agendamentos 
             WHERE clinica_id = v_clinicas.id AND data_agendamento = CURRENT_DATE),
            (SELECT COUNT(*) FROM public.lancamentos_financeiros 
             WHERE clinica_id = v_clinicas.id AND status IN ('pendente', 'parcial'));
        
        RETURN QUERY SELECT v_clinicas.id, true;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. NOTIFICAÇÕES (PREPARAÇÃO PARA REAL-TIME)
-- ============================================================================

-- Tabela de fila de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes_fila (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tipo_notificacao VARCHAR(50), -- 'agendamento_confirmado', 'agendamento_cancelado', etc
    titulo VARCHAR(255),
    mensagem TEXT,
    dados_json JSONB,
    enviado BOOLEAN DEFAULT false,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_envio TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notificacoes_clinica ON public.notificacoes_fila(clinica_id);
CREATE INDEX idx_notificacoes_usuario ON public.notificacoes_fila(usuario_id);
CREATE INDEX idx_notificacoes_enviado ON public.notificacoes_fila(enviado);

-- Função para criar notificação quando agendamento é confirmado
CREATE OR REPLACE FUNCTION notificar_confirmacao_agendamento()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmada' AND OLD.status IS DISTINCT FROM 'confirmada' THEN
        INSERT INTO public.notificacoes_fila (
            clinica_id,
            usuario_id,
            tipo_notificacao,
            titulo,
            mensagem,
            dados_json
        ) VALUES (
            NEW.clinica_id,
            NEW.profissional_id,
            'agendamento_confirmado',
            'Agendamento Confirmado',
            'O agendamento com ' || (SELECT nome_completo FROM public.pacientes WHERE id = NEW.paciente_id) || 
            ' em ' || NEW.data_agendamento || ' foi confirmado.',
            jsonb_build_object('agendamento_id', NEW.id, 'paciente_id', NEW.paciente_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notificar_confirmacao_agendamento_trigger ON public.agendamentos;
CREATE TRIGGER notificar_confirmacao_agendamento_trigger
    AFTER UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION notificar_confirmacao_agendamento();

-- ============================================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON FUNCTION audit_trigger_function() IS 'Registra todas as mudanças em tabelas sensíveis para auditoria LGPD';
COMMENT ON FUNCTION validar_conflito_agendamento() IS 'Valida e impede conflitos de horário entre agendamentos';
COMMENT ON FUNCTION criar_lancamento_ao_concluir_agendamento() IS 'Auto-cria lançamento financeiro quando agendamento é concluído';
COMMENT ON FUNCTION atualizar_dashboard_cache() IS 'Atualiza cache de dashboard - executar por cron job a cada 30 min';
COMMENT ON FUNCTION remover_dados_retencao() IS 'Remove dados antigos conforme políticas de retenção LGPD - executar por cron';
COMMENT ON FUNCTION notificar_confirmacao_agendamento() IS 'Cria notificação quando agendamento é confirmado';
