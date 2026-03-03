# FonoFlow - Documentação do Schema do Banco de Dados

## 📋 Visão Geral

Este documento descreve a estrutura do banco de dados PostgreSQL para o **FonoFlow**, um SaaS multi-tenant para clínicas de fonoaudiologia. O schema foi projetado com foco em:

- ✅ **Isolamento de Dados por Tenant** - Cada clínica (clinica_id) tem seus próprios dados completamente isolados
- ✅ **Row Level Security (RLS)** - Políticas de segurança em nível de linha impedem acesso cruzado entre clínicas
- ✅ **Conformidade LGPD** - Logs de auditoria e trilha de quem criou/editou cada registro
- ✅ **Performance** - Índices otimizados para queries comuns
- ✅ **Rastreabilidade** - Campos de `criado_por` e `data_atualizacao` em todas as tabelas

---

## 📊 Estrutura de Tabelas

### 1. Tabelas Globais (Sem RLS)

#### `clinicas` (Tenants)
```sql
─ id (UUID) - Chave primária
├─ nome_clinica (VARCHAR)
├─ cnpj (VARCHAR) - Único
├─ email, telefone, endereço, cidade, estado, cep
├─ logo_url (para Identity Visual)
├─ cores_primaria, cores_secundaria, cores_neutra (Customização UI)
├─ plano_assinatura (starter, professional, enterprise)
├─ ativo (soft delete)
└─ data_criacao, data_atualizacao
```

**Sem RLS:** Apenas admins do sistema podem acessar.

---

### 2. Tabelas de Autenticação e Autorização

#### `usuarios` (Usuários do Sistema)
```sql
─ id (UUID) - Referencia auth.users do Supabase Auth
├─ clinica_id (UUID) - ISOLAMENTO: cada usuário pertence a uma clínica
├─ nome_completo, cpf (único), email, telefone
├─ foto_perfil_url
├─ role (admin | fono | medico | recepcao) - RBAC
├─ especialidade (para clínicos)
├─ numero_registro (CRFa, CRM, etc)
├─ ativo (soft delete)
├─ primeiro_acesso (para onboarding)
└─ data_criacao, data_atualizacao, criado_por
```

**RLS Policy:** Usuários veem apenas usuários da mesma clínica

**Índices:** clinica_id, email, cpf, ativo, role

---

### 3. Tabelas de Pacientes

#### `pacientes`
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ nome_completo, cpf (único), data_nascimento, gênero
├─ email, telefone_principal, telefone_secundario
├─ endereco, numero, complemento, cidade, estado, cep
├─ responsavel_* (para menores de idade)
├─ ativo
├─ observacoes
└─ data_criacao, data_atualizacao, criado_por
```

**RLS Policy:** Apenas usuários da mesma clínica podem ler/escrever pacientes

**Índices:** clinica_id, cpf, email, telefone, ativo

**Restrição:** Email da clínica deve existir para contato

---

### 4. Tabelas de Agenda

#### `salas` (Consultórios/Salas)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ nome, descricao
├─ capacidade
├─ equipamentos (TEXT[]) - Array: ["audiômetro", "impedanciômetro"]
├─ ativo
└─ data_criacao, data_atualizacao
```

**RLS Policy:** Apenas usuários da mesma clínica

---

#### `agendamentos` ⭐ (Crítico para Conflitos)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ paciente_id (UUID) - Foreign Key
├─ profissional_id (UUID) - Foreign Key para usuarios
├─ sala_id (UUID) - Foreign Key (nullable)
├─ data_agendamento (DATE)
├─ horario_inicio (TIME)
├─ horario_fim (TIME)
├─ tipo_atendimento (Avaliação | Reavaliação | Seguimento)
├─ status (agendada | confirmada | cancelada | faltou | concluida)
├─ observacoes
├─ confirmacao_via_sms, confirmacao_data
├─ cancelado_em, cancelado_por, motivo_cancelamento
└─ data_criacao, data_atualizacao, criado_por
```

**RLS Policy:** Apenas usuários da mesma clínica

**Índices Críticos:**
- `(clinica_id, data_agendamento, profissional_id)` - Detectar conflitos
- `(data_agendamento)` - Buscar agendamentos do dia
- `status` - Filtrar por status

**Validações:**
- `horario_inicio < horario_fim`
- `data_agendamento >= CURRENT_DATE`

**Importante:** O backend deve verificar conflitos:
```
SELECT COUNT(*) FROM agendamentos
WHERE clinica_id = $clinica_id
  AND profissional_id = $profissional_id
  AND data_agendamento = $data
  AND (horario_inicio, horario_fim) OVERLAPS ($inicio, $fim)
  AND status != 'cancelada'
```

---

### 5. Tabelas de Prontuários

#### `prontuarios` (Prontuário Eletrônico)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ paciente_id (UUID)
├─ agendamento_id (UUID, nullable)
├─ titulo, descricao
├─ diagnostico_preliminar, historico_clinico
├─ alergias, medicacoes
├─ visivel_para_paciente (futuro: paciente vê prontuário)
└─ data_criacao, data_atualizacao, criado_por
```

**RLS Policy:** Apenas usuários da mesma clínica

---

#### `evolucoes` (Notas de Atendimento com Imutabilidade)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ prontuario_id (UUID)
├─ agendamento_id (UUID, nullable)
├─ conteudo (TEXT) - Nota do atendimento
├─ observacoes_confidenciais (não aparece em relatórios públicos)
├─ titulo_resumo (para Timeline)
├─ imutavel (após finalizar, fica imutável - Auditoria LGPD)
└─ data_criacao, data_atualizacao, criado_por
```

**RLS Policy:**
- SELECT: Todos da clínica
- INSERT: Todos da clínica
- UPDATE: Apenas o criador E apenas se não for imutável

**Índices:** clinica_id, prontuario_id, agendamento_id, data_criacao

---

#### `anexos_prontuarios` (Arquivos de Exames, PDFs, etc)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ evolucao_id (UUID, nullable)
├─ prontuario_id (UUID, nullable)
├─ nome_arquivo, tipo_arquivo (pdf | image | audio | video)
├─ caminho_arquivo (s3://bucket/clinica_id/...)
├─ tamanho_bytes, descricao
└─ data_criacao, criado_por
```

**RLS Policy:**
- SELECT: Todos da clínica
- INSERT: Todos da clínica
- DELETE: Apenas o criador

**Storage:** Supabase Storage isolado por `clinica_id/ano/mes/arquivo`

---

### 6. Tabelas de Financeiro

#### `servicos` (Planos de Preço)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ nome (Avaliação Inicial, Reavaliação, etc)
├─ descricao
├─ preco_padrao (DECIMAL)
├─ tempo_estimado_minutos
├─ ativo
└─ data_criacao, data_atualizacao
```

**RLS Policy:** Apenas usuários da mesma clínica (Admin only via service layer)

---

#### `lancamentos_financeiros` (Controle de Pagamentos)
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ agendamento_id (UUID, nullable) - Link com atendimento
├─ paciente_id (UUID, nullable)
├─ descricao
├─ valor (DECIMAL)
├─ tipo_valor (credito | debito)
├─ status (pendente | pago | parcial | cancelado)
├─ data_vencimento
├─ data_pagamento
├─ metodo_pagamento (cartao | dinheiro | transferencia | cheque | pix)
├─ observacoes
└─ data_criacao, data_atualizacao, criado_por
```

**RLS Policy:** Apenas usuários da mesma clínica

**Fluxo Automático:**
1. Agendamento concluído → trigger de lançamento automático pendente
2. Recepção marca como pago → data_pagamento preenchida

---

### 7. Tabela de Auditoria LGPD

#### `audit_logs`
```sql
─ id (UUID)
├─ clinica_id (UUID) - ISOLAMENTO
├─ usuario_id (UUID) - Quem fez?
├─ tabela_afetada (usuarios | pacientes | agendamentos | etc)
├─ registro_id (UUID) - Qual registro?
├─ acao (INSERT | UPDATE | DELETE | VIEW)
├─ dados_anteriores (JSONB) - Para UPDATE, dados antes da mudança
├─ dados_novos (JSONB) - Dados depois da mudança
├─ alteracoes_resumo (JSONB) - {"campo": "valor_anterior -> valor_novo"}
├─ endereco_ip (para rastreamento)
├─ user_agent
└─ data_acao (timestamp autorizado)
```

**RLS Policy:** Apenas admins da clínica podem ler

**Triggers Automáticos:** (implementar com pg_audit ou trigger customizado)
- Insere automaticamente em INSERT/UPDATE/DELETE de tabelas sensíveis

---

## 🔐 Row Level Security (RLS)

### Funções de Contexto

```sql
get_clinica_id()  -- Extrai clinica_id do JWT
get_user_id()     -- Extrai user_id do auth.uid()
```

O JWT do Supabase Auth deve conter a claim `clinica_id`:

```json
{
  "sub": "user-uuid",
  "email": "user@clinica.com",
  "clinica_id": "clinica-uuid",
  "role": "admin",
  "aud": "authenticated"
}
```

### Padrão de RLS

Toda tabela multi-tenant segue este padrão:

```sql
-- SELECT: Pode ler dados da própria clínica
CREATE POLICY "table_select" ON table_name
    FOR SELECT
    USING (clinica_id = get_clinica_id());

-- INSERT: Pode criar dados na própria clínica
CREATE POLICY "table_insert" ON table_name
    FOR INSERT
    WITH CHECK (clinica_id = get_clinica_id());

-- UPDATE: Pode editar dados da própria clínica
CREATE POLICY "table_update" ON table_name
    FOR UPDATE
    USING (clinica_id = get_clinica_id())
    WITH CHECK (clinica_id = get_clinica_id());

-- DELETE: Pode deletar dados da própria clínica
CREATE POLICY "table_delete" ON table_name
    FOR DELETE
    USING (clinica_id = get_clinica_id());
```

### Exceções Importantes

#### `evolucoes` - Imutabilidade para Auditoria
```sql
-- Apenas criador pode atualizar E apenas se não for imutável
CREATE POLICY "evolucoes_update" ON evolucoes
    FOR UPDATE
    USING (clinica_id = get_clinica_id() 
           AND NOT imutavel 
           AND criado_por = get_user_id())
    WITH CHECK (clinica_id = get_clinica_id());
```

#### `anexos_prontuarios` - Deletar Apenas Criador
```sql
CREATE POLICY "anexos_delete_criador" ON anexos_prontuarios
    FOR DELETE
    USING (clinica_id = get_clinica_id() AND criado_por = get_user_id());
```

---

## 📐 Índices para Performance

### Critical Path (Agenda)
```sql
CREATE INDEX idx_agendamentos_data_profissional 
  ON agendamentos(data_agendamento, profissional_id);

CREATE INDEX idx_agendamentos_clinica_id ON agendamentos(clinica_id);
```

### Busca de Registros
```sql
CREATE INDEX idx_pacientes_cpf ON pacientes(cpf);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_lancamentos_status ON lancamentos_financeiros(status);
```

### Auditoria e Timeline
```sql
CREATE INDEX idx_audit_data_acao ON audit_logs(data_acao);
CREATE INDEX idx_evolucoes_data_criacao ON evolucoes(data_criacao);
```

---

## 🔄 Triggers Automáticos

### Update Timestamp
Toda tabela tem um trigger que atualiza `data_atualizacao` automaticamente:

```sql
CREATE TRIGGER update_tabela_timestamp
    BEFORE UPDATE ON tabela_nome
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
```

### Soft Delete
Tabelas com `ativo` (BOOLEAN DEFAULT true) implementam soft delete:

```sql
-- Ao invés de DELETE, fazer UPDATE ativo = false
UPDATE usuarios SET ativo = false, data_atualizacao = NOW() WHERE id = $1;
```

---

## 📝 Fluxos de Negócio

### 1️⃣ Criar Agendamento com Validação de Conflito

```sql
-- Backend valida conflito ANTES de inserir
SELECT COUNT(*) as conflito_count
FROM agendamentos
WHERE clinica_id = $clinica_id
  AND profissional_id = $profissional_id
  AND data_agendamento = $data_agendamento
  AND (horario_inicio, horario_fim) OVERLAPS ($horario_inicio, $horario_fim)
  AND status != 'cancelada';

-- Se conflito_count = 0, permite inserir
INSERT INTO agendamentos (...) VALUES (...);
```

### 2️⃣ Registrar Evolução em Atendimento

```sql
-- 1. Cria prontuário (se não existir)
INSERT INTO prontuarios (clinica_id, paciente_id, titulo, criado_por)
VALUES ($clinica_id, $paciente_id, $titulo, $user_id);

-- 2. Insere evolução (imutável = false inicialmente)
INSERT INTO evolucoes (prontuario_id, conteudo, imutavel, clinica_id, criado_por)
VALUES ($prontuario_id, $conteudo, false, $clinica_id, $user_id);

-- 3. Marca imutável após finalizar atendimento
UPDATE evolucoes SET imutavel = true WHERE id = $id AND criado_por = $user_id;
```

### 3️⃣ Criar Lançamento Financeiro Automático

```sql
-- Trigger ao concluir agendamento
CREATE TRIGGER criar_lancamento_ao_concluir_agendamento
AFTER UPDATE OF status ON agendamentos
FOR EACH ROW
WHEN (NEW.status = 'concluida' AND OLD.status != 'concluida')
EXECUTE FUNCTION criar_lancamento_financeiro();
```

### 4️⃣ Auditoria de Acesso a Prontuário Sensível

```sql
-- Log automático ao visualizar prontuário
INSERT INTO audit_logs (clinica_id, usuario_id, tabela_afetada, registro_id, acao, data_acao)
VALUES ($clinica_id, $user_id, 'prontuarios', $prontuario_id, 'VIEW', NOW());
```

---

## 🚀 Como Usar no FastAPI

### Exemplo: Obter Pacientes da Clínica Logada

```python
from fastapi import Depends
from supabase import create_client, Client

async def get_supabase(request: Request) -> Client:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    supabase = create_client(URL, KEY)
    supabase.auth.set_session({"access_token": token, "refresh_token": ""})
    return supabase

async def get_pacientes(supabase: Client = Depends(get_supabase)):
    # RLS automaticamente filtra por clinica_id do JWT
    response = supabase.table("pacientes").select("*").execute()
    return response.data
```

O Supabase automaticamente injeta o `clinica_id` no filtro RLS!

---

## 📋 Checklist de Implementação

- [ ] Executar migrations SQL no Supabase
- [ ] Configurar Claims Customizadas no Supabase Auth (clinica_id no JWT)
- [ ] Implementar triggers de auditoria (pg_audit ou customizado)
- [ ] Criar função de auto-lançamento financeiro
- [ ] Testar RLS com múltiplas contas de clínicas diferentes
- [ ] Implementar validação de conflito no backend
- [ ] Configurar Storage com isolamento por clinica_id
- [ ] Criar backups automáticos
- [ ] Documentar procedimentos de LGPD (direito ao esquecimento, etc)

---

## 🔑 Referências

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [LGPD - Lei Geral de Proteção de Dados Pessoais](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)
