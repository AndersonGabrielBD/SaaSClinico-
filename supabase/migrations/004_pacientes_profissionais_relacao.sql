-- Migration: Relação Muitos-para-Muitos entre Pacientes e Profissionais
-- Descrição: Permite que um paciente seja atendido por vários profissionais

-- 1. Criar tabela intermediária (pivot table)
CREATE TABLE IF NOT EXISTS public.pacientes_profissionais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
    data_vinculo TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir que não há duplicatas
    UNIQUE(paciente_id, profissional_id)
);

-- 2. Criar índices para performance
CREATE INDEX idx_pacientes_profissionais_paciente ON public.pacientes_profissionais(paciente_id);
CREATE INDEX idx_pacientes_profissionais_profissional ON public.pacientes_profissionais(profissional_id);
CREATE INDEX idx_pacientes_profissionais_clinica ON public.pacientes_profissionais(clinica_id);
CREATE INDEX idx_pacientes_profissionais_ativo ON public.pacientes_profissionais(ativo);

-- 3. Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_pacientes_profissionais_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para auto-atualização
CREATE TRIGGER trigger_update_pacientes_profissionais_timestamp
    BEFORE UPDATE ON public.pacientes_profissionais
    FOR EACH ROW
    EXECUTE FUNCTION update_pacientes_profissionais_timestamp();

-- 5. RLS Policies
ALTER TABLE public.pacientes_profissionais ENABLE ROW LEVEL SECURITY;

-- Policy de SELECT: Usuários veem vínculos da sua clínica
CREATE POLICY "pacientes_profissionais_select_policy" ON public.pacientes_profissionais
FOR SELECT
USING (
    clinica_id = (SELECT clinica_id FROM usuarios WHERE id = auth.uid())
);

-- Policy de INSERT: Admin e Recepção podem criar vínculos
CREATE POLICY "pacientes_profissionais_insert_policy" ON public.pacientes_profissionais
FOR INSERT
WITH CHECK (
    clinica_id = (SELECT clinica_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT role FROM usuarios WHERE id = auth.uid()) IN ('admin', 'recepcao')
);

-- Policy de UPDATE: Admin e Recepção podem atualizar vínculos
CREATE POLICY "pacientes_profissionais_update_policy" ON public.pacientes_profissionais
FOR UPDATE
USING (
    clinica_id = (SELECT clinica_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT role FROM usuarios WHERE id = auth.uid()) IN ('admin', 'recepcao')
);

-- Policy de DELETE: Admin e Recepção podem deletar vínculos
CREATE POLICY "pacientes_profissionais_delete_policy" ON public.pacientes_profissionais
FOR DELETE
USING (
    clinica_id = (SELECT clinica_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT role FROM usuarios WHERE id = auth.uid()) IN ('admin', 'recepcao')
);

-- 6. Migrar dados existentes (se houver profissional_responsavel_id)
DO $$
BEGIN
    -- Verificar se a coluna existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pacientes' 
        AND column_name = 'profissional_responsavel_id'
    ) THEN
        -- Migrar vínculos existentes
        INSERT INTO public.pacientes_profissionais (paciente_id, profissional_id, clinica_id)
        SELECT 
            p.id,
            p.profissional_responsavel_id,
            p.clinica_id
        FROM public.pacientes p
        WHERE p.profissional_responsavel_id IS NOT NULL
        ON CONFLICT (paciente_id, profissional_id) DO NOTHING;
        
        -- Opcional: Remover a coluna antiga (descomente se quiser)
        -- ALTER TABLE public.pacientes DROP COLUMN IF EXISTS profissional_responsavel_id;
    END IF;
END $$;

-- 7. Comentários para documentação
COMMENT ON TABLE public.pacientes_profissionais IS 'Tabela de relacionamento muitos-para-muitos entre pacientes e profissionais. Permite que um paciente seja atendido por vários profissionais.';
COMMENT ON COLUMN public.pacientes_profissionais.paciente_id IS 'Referência ao paciente';
COMMENT ON COLUMN public.pacientes_profissionais.profissional_id IS 'Referência ao profissional (fono/medico)';
COMMENT ON COLUMN public.pacientes_profissionais.data_vinculo IS 'Data em que o vínculo foi criado';
COMMENT ON COLUMN public.pacientes_profissionais.ativo IS 'Se o vínculo está ativo ou foi desativado';
COMMENT ON COLUMN public.pacientes_profissionais.observacoes IS 'Observações sobre o vínculo (ex: período de tratamento, especialidade, etc)';
