# Plano Estratégico de Evolução — ClinNext
## Roadmap para tornar o produto 100% comercializável

> **Versão:** 1.0
> **Data base:** Maio/2026
> **Horizonte total:** 16 semanas (4 meses)
> **Objetivo:** levar o ClinNext de "MVP avançado com bugs estruturais" para "SaaS clínico vendável nacionalmente para clínicas de até 30 profissionais".
> **Premissa de time:** 1 dev sênior fullstack (mínimo). Estimativas dobram com júnior, caem 40% com 2 devs sêniores. Designer 0.5 FTE no Fase 2 em diante. CS/Suporte 0.5 FTE a partir do Fase 3.

---

## ÍNDICE

1. [Visão geral e princípios](#1-visão-geral-e-princípios)
2. [Métricas de sucesso](#2-métricas-de-sucesso)
3. [Fase 0 — Pré-Sprint (semana 0)](#fase-0--pré-sprint-semana-0)
4. [Fase 1 — Parar de Perder Dados (semanas 1–2)](#fase-1--parar-de-perder-dados-semanas-12)
5. [Fase 2 — Parar de Vazar Dados (semanas 3–4)](#fase-2--parar-de-vazar-dados-semanas-34)
6. [Fase 3 — Parar de Frustrar Usuários (semanas 5–6)](#fase-3--parar-de-frustrar-usuários-semanas-56)
7. [Fase 4 — Tornar Vendável (semanas 7–8)](#fase-4--tornar-vendável-semanas-78)
8. [Fase 5 — Diferenciar-se no Mercado (semanas 9–12)](#fase-5--diferenciar-se-no-mercado-semanas-912)
9. [Fase 6 — Escalar com Confiança (semanas 13–16)](#fase-6--escalar-com-confiança-semanas-1316)
10. [Cronograma consolidado](#10-cronograma-consolidado)
11. [Definition of Done por Fase](#11-definition-of-done-por-fase)
12. [Riscos e mitigações](#12-riscos-e-mitigações)
13. [Anexos](#13-anexos)

---

## 1. Visão geral e princípios

### Sequência lógica

```
Fase 0       1            2            3           4            5             6
PrepSprint → Confiabilidade → Segurança → UX/Fluxos → Vendável → Diferencial → Escala
(1 semana)   (2 semanas)    (2 semanas) (2 semanas) (2 semanas) (4 semanas)  (4 semanas)

╔════════════════ MVP funcional ═══════════════╦═══ Beta privado ═══╦══ Lançamento público ══╗
                                               ↑                   ↑                          ↑
                                          Fim Fase 2          Fim Fase 4               Fim Fase 6
```

### Princípios não-negociáveis

1. **Saúde antes de feature.** Bug que afeta prontuário/financeiro tem prioridade absoluta sobre roadmap novo.
2. **LGPD desde o dia 0.** Toda nova feature precisa passar pelo checklist LGPD (consentimento, retenção, log, anonimização).
3. **Testar antes de migrar.** Nenhuma fase começa sem que a anterior tenha cobertura de teste mínima.
4. **Feature flag por padrão.** Toda feature nova vai atrás de uma flag até ter ≥1 semana em produção sem incidentes.
5. **Documentar enquanto faz.** Decisão arquitetural sem ADR = decisão que será refeita errada em 3 meses.
6. **Cada Fase tem um critério de saída objetivo.** Sem ele, NÃO se passa para a próxima Fase, mesmo com pressão comercial.

### O que NÃO faremos neste plano

- Integração com TISS/convênios completos (mercado diferente, exige 6+ meses só pra isso).
- App mobile nativo (PWA já cobre 80% das necessidades).
- Multi-clínica/grupo de clínicas (depois da base estável, em planejamento futuro).
- IA generativa para prontuário (modismo prematuro para o estágio atual).

---

## 2. Métricas de sucesso

### KPIs técnicos (medidos semanalmente)

| Métrica | Baseline atual (estimado) | Meta Fase 2 | Meta Fase 4 | Meta Fase 6 |
|---|---|---|---|---|
| p95 latência API | ~1200ms | <800ms | <500ms | <300ms |
| Taxa de erro 5xx | desconhecida | <1% | <0.5% | <0.1% |
| Cobertura de testes backend | ~15% | 40% | 60% | 75% |
| Bugs críticos abertos | 6 | 0 | 0 | 0 |
| Tempo médio de resolução de bug | — | <5 dias | <3 dias | <1 dia |
| Vulnerabilidades CVSS ≥ 7 | ≥3 | 0 | 0 | 0 |
| Bundle frontend | desconhecido | <500KB gz | <400KB gz | <350KB gz |
| Conta criada → primeiro paciente | impossível medir hoje | <10min | <5min | <3min |

### KPIs de produto (a partir da Fase 4)

| Métrica | Meta Fase 4 | Meta Fase 6 |
|---|---|---|
| Clínicas piloto ativas | 3–5 | 15–30 |
| MRR | R$ 500–1.000 | R$ 5.000–15.000 |
| NPS | ≥ 30 | ≥ 50 |
| Churn mensal | < 10% | < 5% |
| Tickets de suporte/clínica/mês | < 5 | < 2 |
| Ativação D7 (clínica usa em 7 dias) | > 60% | > 80% |

---

## Fase 0 — Pré-Sprint (semana 0)

**Objetivo:** preparar o terreno para que as Fases seguintes não sejam atrasadas por falta de ambiente, observabilidade ou processo.

### Tarefas

| # | Tarefa | Esforço | Prioridade |
|---|---|---|---|
| 0.1 | Criar projeto Linear/Jira/GitHub Projects com este plano em forma de épicos + tasks | 0.5d | Alta |
| 0.2 | Branch protection no `main`: PR obrigatório, 1 review, checks passing | 0.2d | Alta |
| 0.3 | Configurar **GitHub Actions** com 3 workflows: lint, test, build | 0.5d | Alta |
| 0.4 | Criar ambientes separados: `dev`, `staging`, `prod` no Supabase (3 projetos distintos) | 1d | Crítico |
| 0.5 | Migrar `.env` para secret manager (Vercel env vars + 1Password/Doppler para o time) | 0.5d | Crítico |
| 0.6 | Rotacionar `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` e demais (as atuais estão em arquivo local) | 0.2d | Crítico |
| 0.7 | Habilitar **Sentry** (free tier serve para começar) no backend e no frontend, com `BEFORE_SEND` redactando `cpf`, `email`, `nome_completo`, `descricao`, `conteudo` | 0.5d | Alta |
| 0.8 | Habilitar **Vercel Analytics** + **Web Vitals** | 0.1d | Média |
| 0.9 | Configurar **Upstash Redis** (free tier) para rate limiting futuro | 0.2d | Alta |
| 0.10 | Criar Notion/docs com: **ADR template**, **Runbook de incidente**, **Onboarding de cliente**, **Postmortem template** | 0.5d | Média |
| 0.11 | Backup automático Supabase → S3/Backblaze diário (script + cron) | 0.5d | Crítico |
| 0.12 | Definir nicho oficial: "ClinNext atende clínicas multidisciplinares (fono, psico, TO, fisio) particulares com 1–30 profissionais — fora do mercado de convênios complexos" | 0.1d | Alta |

**Critério de saída da Fase 0:**
- ✅ Ambientes dev/staging/prod isolados.
- ✅ Sentry recebendo erros.
- ✅ Chaves rotacionadas.
- ✅ Backup automático ligado.
- ✅ Plano completo em ferramenta de gestão.

**Esforço total:** 4–5 dias (1 semana de 1 dev).

---

## Fase 1 — Parar de Perder Dados (semanas 1–2)

**Objetivo:** eliminar todos os bugs que causam perda silenciosa de dados clínicos ou agendamentos duplicados. Sem isso, qualquer clínica piloto cancela em 30 dias.

**Tema da Fase:** *"Nenhum dado clínico pode ser perdido por culpa do software."*

### Sprint 1 (semana 1)

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 1.1 | **Conflito de agendamento** — `create_agendamento` chama `check_agendamento_conflict` antes de inserir, retornando 409 se houver conflito. | Teste: 2 POSTs concorrentes para mesmo (profissional, data, horário) → 1 sucesso + 1 409. | 1d |
| 1.2 | **EXCLUDE GIST no Postgres** sobre `agendamentos` impedindo overlap a nível de banco (defesa em profundidade). | Migration aplicada; INSERT manual com overlap retorna erro 23P01. | 0.5d |
| 1.3 | **Soft delete real em prontuários**: `delete_prontuario` deixa de chamar `repo.delete` e passa a fazer `update(deletado_em=now())`. Idem `delete_evolucao`. | Teste: DELETE → registro continua na tabela, `deletado_em IS NOT NULL`; GET retorna 404. | 0.5d |
| 1.4 | **Soft delete em relatórios** + papel-lixo recuperável por 90 dias (campo `deletado_em`, índice parcial, RPC list filtrando). | DELETE relatório → existe no banco, não aparece em GET, admin pode "restaurar" via novo endpoint. | 1d |
| 1.5 | **Hard delete somente via job de limpeza**: cron mensal apaga registros com `deletado_em < now() - 90 days` **exceto** prontuários e evoluções (que respeitam 20 anos CFM). | Job idempotente, dry-run flag, log em `audit_logs`. | 1d |
| 1.6 | **Whitelist de campos** em `update_prontuario` e `update_evolucao` — remover `criado_por`, `data_criacao`, `clinica_id`, `id` do payload aceito. | Teste: PUT com `criado_por: outro_id` ignora o campo. | 0.5d |
| 1.7 | **Validação de profissional** em `create_agendamento`: só aceita `profissional_id` que existe na clínica e tem role válido. | Teste: agendar com profissional_id de outra clínica → 400. | 0.5d |

### Sprint 2 (semana 2)

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 1.8 | **Unificar audit logs**: escolher `audit_logs` (plural, dos triggers) como fonte única; refatorar `app/utils/audit.py` para INSERT na mesma tabela; atualizar `lgpd_routes.list_audit_log` para ler dela. | Endpoint `/lgpd/audit-log` retorna eventos tanto de triggers quanto manuais. | 1d |
| 1.9 | **Fluxo real de criar usuário/profissional**: `create_usuario` chama `supabase.auth.admin.create_user(email, ...)`, depois insere em `usuarios`, depois dispara e-mail de "definir senha" via Resend com magic link. | Admin cria conta → usuário recebe e-mail → define senha → consegue logar. | 2d |
| 1.10 | **Permitir mudar role** em `update_usuario`: aceitar `role` no payload com auditoria (`role_alterado_em`, `role_alterado_por`). | Admin promove recepção → admin; auditoria gravada. | 0.5d |
| 1.11 | **Decorator central de tratamento de erros** `@handle_errors` mapeando exceções → respostas limpas (sem `str(e)`, sem stack trace). | Nenhuma rota expõe `psycopg`, `PGRST`, ou trace no body. Sentry registra full trace. | 1d |
| 1.12 | **Remover dead code**: `app/services/agendamento_service.py`, `app/services/dashboard_service.py`, `middleware/auth_middleware.py` se não usado. | `pytest` continua passando; `pyflakes` não reporta imports não usados. | 0.3d |
| 1.13 | **Testes** para fluxos críticos: (a) duplo booking impedido, (b) soft delete, (c) update prontuário sem reescrever criado_por, (d) criar usuário cria conta Auth, (e) mudar role auditado. | `pytest -k "fase1"` cobre 5 cenários, todos verdes. | 1d |
| 1.14 | **Migration aplicada em staging + smoke test manual** com checklist de 10 fluxos críticos. | Documento "Smoke Test v1.0" preenchido. | 0.5d |

**Critério de saída da Fase 1:**
- ✅ Nenhum bug das categorias B1, B2, B3, B5, B6, B9 (auditoria) presente em staging.
- ✅ Cobertura de testes ≥ 30% no backend.
- ✅ Smoke test manual 10/10 verde.
- ✅ Sentry sem erros 5xx novos por 48h em staging.

**Esforço:** 10 dias úteis (2 semanas, 1 dev).

---

## Fase 2 — Parar de Vazar Dados (semanas 3–4)

**Objetivo:** fechar o perímetro de segurança e tornar a base apresentável para auditoria LGPD/ANPD. Após esta fase, o produto pode ser oferecido a clínicas piloto sem risco jurídico imediato.

**Tema da Fase:** *"Nenhum dado de paciente pode vazar entre clínicas ou para fora."*

### Sprint 3 (semana 3) — Identidade e perímetro

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 2.1 | **Token em cookie httpOnly + SameSite=Strict + Secure**, com CSRF token em header customizado `X-CSRF-Token`. Migrar `localStorage` → cookie. Atualizar `AuthContext`, `api.js`, `signOut`, todos os fluxos de fetch. | Token não acessível via `document.cookie` no DevTools; XSS simulada não rouba sessão. | 2d |
| 2.2 | **Refresh token** com TTL curto (15min access, 7d refresh, rotação a cada uso). | Sessão renovada silenciosamente; refresh roubado é invalidado ao detectar uso duplo. | 1.5d |
| 2.3 | **Rate limit com Redis (Upstash)**: `RATELIMIT_STORAGE_URI=redis://...`. Limites: login 5/min/IP + 10/h/email, signup 3/h/IP, reset-password 3/h/email. | Teste de carga: 100 logins concorrentes do mesmo IP → 95+ bloqueados. | 0.5d |
| 2.4 | **Política de senha forte**: mínimo 10 chars, 1 maiúscula, 1 número, 1 especial; lista de senhas banidas (top 10k); validação backend + frontend. | UI mostra força em tempo real; backend rejeita "senha123". | 0.5d |
| 2.5 | **2FA opcional** (TOTP via Google Authenticator) para role `admin`; obrigatório a partir de Fase 4 para admins. | Admin habilita 2FA, segundo login pede código de 6 dígitos. | 1.5d |
| 2.6 | **Headers de segurança** via Flask middleware: `CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. | `securityheaders.com` retorna grade A. | 0.5d |
| 2.7 | **Auditoria** dos cookies, sessões e CORS — `CORS_ORIGINS` em prod sem wildcard, sem `frontend.vercel.app` genérico. | Lista explícita por ambiente. | 0.2d |

### Sprint 4 (semana 4) — Isolamento de tenant e LGPD

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 2.8 | **RLS real no Supabase**: políticas em todas as tabelas (`pacientes`, `prontuarios`, `evolucoes`, `agendamentos`, `lancamentos_financeiros`, `mensalidades_pacientes`, `pagamentos_mensalidades`, `relatorios`, `audit_logs`, `frequencia_atendimentos`, `pacotes_*`) baseadas em `current_setting('app.current_clinica_id')`. | RLS habilitado em todas; sem RLS = build falha. | 2d |
| 2.9 | **Middleware `set_app_context`**: antes de cada request autenticada, backend roda `SET LOCAL app.current_clinica_id = '...'; SET LOCAL app.current_user_id = '...';` na conexão. Service role passa a ser último recurso (operações cross-tenant explícitas). | Teste: chamar endpoint sem set_app_context → query retorna 0 linhas. | 1.5d |
| 2.10 | **Testes de fuzz cross-tenant**: bateria automatizada onde Admin da clínica A tenta acessar 100% dos endpoints com IDs da clínica B; espera-se 404/403 em todos. | `pytest tests/test_cross_tenant_fuzz.py` com 50+ casos, todos verdes. | 1d |
| 2.11 | **Bucket privado para relatórios**: trocar `get_public_url` por `create_signed_url(ttl=300)` no momento do download; bucket configurado como privado. | Acessar URL antiga sem auth → 403; download via endpoint funciona. | 0.5d |
| 2.12 | **Validação real de upload** (magic bytes via `python-magic`): bloqueia executáveis disfarçados, valida tamanho real, normaliza extensão. | Teste: upload de `.exe` renomeado pra `.pdf` → 400. | 0.5d |
| 2.13 | **Anonimização LGPD completa**: estender `anonymize_patient` para limpar conteúdo livre em `evolucoes` e `prontuarios` que mencione `nome_completo` (regex case-insensitive + substituição), mudar hash de `hash()` (não determinístico) para `hashlib.sha256`. | Teste: paciente "João Silva" anonimizado → busca por "João" em evoluções retorna `[REDIGIDO]`. | 1d |
| 2.14 | **Export LGPD completo**: incluir `evolucoes`, `frequencias`, `pagamentos_mensalidades`, anexos com URLs assinadas temporárias, manifest JSON com hash SHA-256 do conteúdo (auditável). | Export gera ZIP com todos os dados + `manifest.json`. | 1d |
| 2.15 | **Termo de consentimento LGPD digital** no cadastro do paciente: PDF gerado, assinado eletronicamente (hash + timestamp), salvo em `paciente_consentimentos`. | Cadastro novo exige aceite; PDF acessível em "histórico LGPD". | 1d |
| 2.16 | **Sanitizar logs**: remover `logger.info(f"... data={data}")`, criar `safe_log()` helper que redige `cpf`, `email`, `conteudo`, `descricao`. | `grep -E "logger.*\\b(cpf|cpf_paciente|conteudo|descricao)\\b" backend/` → 0 ocorrências. | 0.5d |
| 2.17 | **Desligar `ALLOW_PUBLIC_SIGNUP` em prod** + `SIGNUP_INVITE_CODE` obrigatório. | `curl -X POST /auth/signup` sem invite em prod → 403. | 0.1d |

**Critério de saída da Fase 2:**
- ✅ Penteste interno básico (OWASP Top 10 manual + ZAP automatizado) sem findings High/Critical.
- ✅ RLS habilitado em 100% das tabelas com dados de clínica.
- ✅ Testes cross-tenant 100% verdes.
- ✅ `securityheaders.com` grade A.
- ✅ Export LGPD funcional e completo.
- ✅ Sentry sem PHI em payloads.

**Esforço:** 10 dias úteis (2 semanas, 1 dev). Recomenda-se contratar consultoria LGPD jurídica em paralelo para Termo de Consentimento e DPO.

---

## Fase 3 — Parar de Frustrar Usuários (semanas 5–6)

**Objetivo:** transformar o produto de "funciona" para "agradável de usar". Foco em fluxos do dia-a-dia da recepção e do profissional.

**Tema da Fase:** *"O usuário não pode perder tempo nem se sentir burro usando o sistema."*

### Sprint 5 (semana 5) — Fluxos críticos

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 3.1 | **Onboarding guiado** (5 passos): após primeiro login, checklist na home com (1) cadastrar primeiro paciente, (2) configurar primeira sala, (3) cadastrar primeiro profissional, (4) criar primeiro agendamento, (5) tour pela agenda. Persistido em `usuarios.onboarding_steps`. | Conta criada → checklist visível → cada passo marca verde ao concluir. | 2d |
| 3.2 | **Reorganizar sidebar** em 3 grupos: **Operação** (Dashboard, Pacientes, Agenda, Prontuários, Frequência), **Financeiro** (Mensalidades, Pacotes, Relatório financeiro), **Configurações** (Salas, Tipos atend., Modelos evolução, Profissionais, Conta). Collapsable com ícone. | Sidebar visual com grupos; usuário recepção vê grupos relevantes apenas. | 1d |
| 3.3 | **Autocomplete de paciente** (combobox com busca server-side debounced 250ms) em `AgendamentoForm`, `ProntuarioForm`, `MensalidadeForm`. Suporta busca por nome, CPF, telefone. | Em base de 1000 pacientes, encontrar por digitação parcial em <300ms. | 1.5d |
| 3.4 | **Dashboard para profissional**: nova versão da `/dashboard` quando role ∈ {fono, medico, profissional} mostrando: próximos 5 atendimentos, total de pacientes ativos, taxa pessoal de comparecimento, evoluções pendentes (concluídas mas sem evolução). | Profissional vê dashboard pessoal, não mais agenda direto. | 2d |
| 3.5 | **Cache com SWR** (substitui fetch manual): `/agenda`, `/dashboard`, `/pacientes`, `/prontuarios`. Invalidation por mutação. | Voltar à página revalida silenciosamente; SWR DevTools mostra cache hits. | 1.5d |
| 3.6 | **Header bug**: `displayName` usa `nome_completo` ao invés de `nome`. | Avatar mostra nome correto para 100% dos usuários. | 0.1d |
| 3.7 | **Toast unificado**: substituir todos os `console.error` em catch por `showToast(err.message, 'error')`. | Nenhum erro silencioso na UI; UX consistente. | 0.5d |

### Sprint 6 (semana 6) — Agenda e produtividade

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 3.8 | **Drag-and-drop na agenda** semanal (react-dnd ou similar): arrastar agendamento entre slots/colunas reagenda com confirmação modal e chamada PUT. Conflito impede drop visualmente. | Vídeo: arrastar agendamento → API atualizada → UI sem reload. | 3d |
| 3.9 | **Bloqueio de horário** (`agendamentos_bloqueios`): profissional cria intervalo "almoço 12-14h", "férias 15-30 jul", "compromisso pessoal". Aparece em cinza na agenda. | Não permite agendar dentro do bloqueio; visual claro. | 1.5d |
| 3.10 | **Cancelamento com preview**: modal `cancelar-recorrencia` mostra "Você está prestes a cancelar X agendamentos: [lista]" antes de confirmar. | Click "toda a série" → lista as 12 datas → exige confirmação digitada "CANCELAR". | 0.5d |
| 3.11 | **Lembrete de confirmação** pelo paciente (e-mail via Resend): 24h antes envia link assinado (Magic Link `/confirmar?token=...`) que muda status `agendada → confirmada` sem login. | Cron diário envia; click no link confirma. | 2d |
| 3.12 | **Notificações in-app** (sininho no header): paciente sem evolução há X dias, mensalidade prestes a vencer, pacote acabando. Polling 30s ou Supabase realtime. | Sininho com contador; click abre painel lateral. | 1.5d |
| 3.13 | **Acessibilidade WCAG AA**: `aria-label` em todos os botões só-ícone; contraste corrigido (texto neutral-400 → neutral-500 mín.); foco visível em todos os elementos interativos; testes com axe-core no CI. | Lighthouse Accessibility ≥ 95. | 1d |
| 3.14 | **Mobile fixes**: charts responsivos com `aspect-ratio`, modais de agendamento com bottom sheet em mobile (Vaul ou similar), tabelas com swipe. | iPhone SE renderiza dashboard e agenda sem overflow. | 1d |

**Critério de saída da Fase 3:**
- ✅ Onboarding completo testado por 3 usuários reais não-técnicos.
- ✅ Lighthouse: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- ✅ Pelo menos 2 fluxos críticos (criar agendamento, registrar evolução) em <3 cliques desde a home.
- ✅ Teste de carga (k6): 50 usuários concorrentes mantêm p95 < 800ms.

**Esforço:** 10 dias úteis (2 semanas, 1 dev + 0.5 designer).

---

## Fase 4 — Tornar Vendável (semanas 7–8)

**Objetivo:** preparar a operação para receber clientes pagantes. Aqui o foco sai do código e entra em marketing, suporte, billing.

**Tema da Fase:** *"Conseguir vender, cobrar e suportar a primeira clínica paga."*

### Sprint 7 (semana 7) — Comercialização

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 4.1 | **Billing/assinatura própria**: integração com Stripe Brasil (ou Pagar.me/Asaas para boleto+pix). Planos: Starter (até 3 prof, R$ 89), Pro (até 10 prof, R$ 199), Business (até 30 prof, R$ 399). Trial 14d sem cartão. | Clínica nova entra no Starter trial → 14d → cobrança automática. | 3d |
| 4.2 | **Webhook de cobrança**: failed payment → e-mail + grace period 7d → block + readonly. | Cartão recusado → e-mail dia 1, 3, 7; dia 8 conta vira somente leitura. | 1d |
| 4.3 | **Landing page** (`clinnext.com.br` ou domínio definido): hero + features + planos + depoimentos (mesmo que 2–3 piloto) + FAQ + CTA "começar teste grátis". | Lighthouse mobile ≥ 90; tempo de carregamento <2s; analytics instalado. | 2d |
| 4.4 | **Página de preços** com calculadora ("quantos profissionais?" → sugere plano). | 100% das clínicas piloto entendem o plano em <30s. | 0.5d |
| 4.5 | **Política de privacidade + Termos de uso** redigidos por advogado especialista em healthcare/SaaS. Linkar no footer e no signup. | Documentos publicados em URL fixa, mencionados no signup. | (consultoria externa, 1 semana paralela) |
| 4.6 | **DPA — Data Processing Agreement** modelo para clínicas que pedirem. | PDF + processo de assinatura digital. | (consultoria) |
| 4.7 | **Help center** simples (Intercom Help Center, Notion público, ou estático no próprio domínio) com 20 artigos básicos: como cadastrar paciente, como criar pacote, como exportar relatório etc. | 20 artigos publicados; busca funcional. | 2d |
| 4.8 | **Chat de suporte in-app** (Crisp ou Intercom, free tier inicial). | Widget visível em todas as páginas autenticadas. | 0.3d |

### Sprint 8 (semana 8) — Confiança operacional

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 4.9 | **Status page** pública (`status.clinnext.com.br`) com uptime e incidentes (BetterStack/Statuspage free). | Página live; instrumentar /health a cada 30s. | 0.5d |
| 4.10 | **Runbook de incidente**: passos para 5 cenários (DB down, Auth down, Storage down, Stripe down, deploy quebrou). | Documento revisado; ensaio de simulação completo. | 1d |
| 4.11 | **Postmortem template** + processo: todo incidente Sev1/Sev2 gera postmortem em 72h. | 1 postmortem fictício preenchido como exemplo. | 0.2d |
| 4.12 | **Modelos de evolução por especialidade** populados: fono pediátrica, fono adulto, psico TCC, psico psicanalítica, TO sensorial, fisio ortopédica. 10 templates totais. | Conta nova já vem com modelos sugeridos; profissional adapta. | 2d |
| 4.13 | **Repasse financeiro do profissional** v1: cadastro de % por tipo de atendimento; relatório mensal exportável em PDF (já tem motor ReportLab). | Admin vê quanto paga a cada profissional; profissional vê quanto recebe. | 2d |
| 4.14 | **PWA + Install prompt**: `manifest.json`, ícones, service worker básico, install banner em mobile. | App instalável em iOS e Android; abre offline o shell. | 1d |
| 4.15 | **Backup off-Supabase noturno** validado (restore test mensal): script Python → S3, ciclo de retenção (7d hot, 30d cold, 1y archive). | Restore manual em ambiente novo a partir de backup ≤ 30min. | 1d |
| 4.16 | **Documentação de cliente final**: manual em PDF (20 páginas), vídeo de 5min "primeiros passos" no YouTube/Vimeo. | Linkados no help center e no onboarding. | 2d |
| 4.17 | **3 clínicas piloto contratadas** (pode ser amigos/network, gratuitas inicialmente em troca de feedback estruturado). | 3 contratos assinados; 1ª clínica usando há ≥7 dias. | (vendas, 2 semanas paralelas) |

**Critério de saída da Fase 4:**
- ✅ 3 clínicas piloto reais usando o sistema em produção.
- ✅ Billing funcionando end-to-end (mesmo que valor R$ 1 simbólico no piloto).
- ✅ Help center + chat de suporte operantes.
- ✅ Status page e runbook ativos.
- ✅ NPS inicial dos pilotos ≥ 20.
- ✅ Documentação cliente final entregue.

**Esforço:** 10 dias úteis (2 semanas, 1 dev) + atividades comerciais paralelas.

---

## Fase 5 — Diferenciar-se no Mercado (semanas 9–12)

**Objetivo:** ir além do "feature parity" do nicho e construir vantagem competitiva real. A partir daqui pode-se elevar preço e crescer com mais segurança.

**Tema da Fase:** *"Funcionalidades que iClinic/Feegow não têm bem feitas para clínicas particulares multidisciplinares."*

### Sprint 9 (semana 9) — Comunicação com paciente

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 5.1 | **Lembrete por WhatsApp** via 360dialog ou Twilio (cobra por mensagem). Template "lembrete consulta" homologado pelo WhatsApp Business. | Lembrete 24h antes envia; paciente responde "1" → confirmado. | 3d |
| 5.2 | **Lembrete por SMS** fallback (Zenvia ou Twilio) quando paciente não tem WhatsApp. | Toggle no cadastro: WhatsApp / SMS / E-mail / Nenhum. | 1d |
| 5.3 | **Página pública de agendamento** (`/agendar/<slug-clinica>`): paciente escolhe profissional e horário sem login, cria cadastro próprio + agendamento status "aguardando confirmação". | Clínica habilita; link gera ≥ 1 agendamento de teste. | 3d |
| 5.4 | **Fila de espera**: paciente entra em fila com prioridade; agenda cancelada → notifica próximo da fila (WhatsApp/SMS). | Cancelamento → fila → 1ª pessoa recebe oferta → aceita ou expira em 1h. | 2d |

### Sprint 10 (semana 10) — Prontuário avançado

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 5.5 | **Evolução SOAP estruturada** opcional: campos Subjetivo / Objetivo / Avaliação / Plano + texto livre. | Profissional escolhe entre "livre" e "SOAP" ao criar; admin define padrão por especialidade. | 2d |
| 5.6 | **CID-10** vinculável à evolução (lookup de 14k códigos com busca). | Profissional digita "F32" → mostra "Episódio depressivo"; salvo no banco. | 1.5d |
| 5.7 | **Assinatura digital** de evolução finalizada (ClickSign/D4Sign API): gera PDF com assinatura ICP-Brasil ou eletrônica simples + timestamp. | Evolução finalizada → botão "Assinar" → PDF assinado anexado. | 3d |
| 5.8 | **Anamnese padronizada por especialidade**: formulário inicial que vira o primeiro prontuário automaticamente. | Cadastrar paciente → escolher especialidade → preencher anamnese → prontuário criado. | 2d |
| 5.9 | **Linha do tempo do paciente** (`/pacientes/[id]/timeline`): vista cronológica unificada de agendamentos + evoluções + relatórios + pagamentos + observações. | Timeline visual estilo Twitter/feed, com filtros. | 2d |

### Sprint 11 (semana 11) — Financeiro inteligente

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 5.10 | **Pacote inteligente**: renovação automática quando saldo < 2 sessões (com aprovação opcional); notificação ao paciente. | Saldo = 1 → e-mail "renovar pacote?" com link de aprovação. | 2d |
| 5.11 | **Cobrança recorrente do paciente**: integração Stripe/Asaas para mensalidades; cartão salvo (tokenizado), cobrança automática mensal. | Paciente paga 1ª mensalidade com cartão → próximas debitam automaticamente. | 3d |
| 5.12 | **Boleto + PIX gerado em 1 clique** (Asaas/Stark Bank): mensalidade pendente → botão "gerar cobrança" → link com boleto e QR code PIX. | Link funciona; pagamento via PIX atualiza status em <30s (webhook). | 2d |
| 5.13 | **Comissão automática do profissional** v2: cálculo considerando faltas, valor por tipo de atendimento, dedução de impostos, exportação em planilha. | Relatório mensal exportável em Excel; profissional vê dashboard pessoal. | 2d |
| 5.14 | **Conciliação financeira**: marcar lançamentos como conciliados com extrato bancário (upload OFX ou marcação manual). | Lançamentos conciliados não somam no "pendente". | 1.5d |

### Sprint 12 (semana 12) — Telemedicina e crescimento

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 5.15 | **Telemedicina** (Jitsi Meet self-hosted ou Whereby Embedded): agendamento marca tipo "online", botão "iniciar consulta" abre videoconferência integrada; link enviado ao paciente por WhatsApp/e-mail. | Profissional + paciente entram em call; até 60min; gravação opcional. | 4d |
| 5.16 | **Modo família**: paciente principal + dependentes (pais autorizando filhos). Compartilhamento de cadastro, separação de prontuário. | Mãe cadastra 2 filhos como dependentes; agenda para cada. | 2d |
| 5.17 | **Programa de indicação**: clínica indica outra clínica → ambas ganham 1 mês grátis quando 2ª pagar. | Link rastreável; relatório de indicações no painel admin. | 1.5d |
| 5.18 | **Painel admin (interno seu)**: MRR, churn, ARPU, NPS, clínicas ativas, tickets em aberto. | Dashboard pessoal seu com dados de produção. | 2d |

**Critério de saída da Fase 5:**
- ✅ ≥ 5 features competitivas vs. iClinic/Feegow funcionando bem.
- ✅ Pelo menos 1 caso de uso real onde ClinNext faz melhor do que concorrentes.
- ✅ 8–15 clínicas pagantes.
- ✅ MRR ≥ R$ 2.000.
- ✅ NPS ≥ 40.
- ✅ Churn mensal < 8%.

**Esforço:** 20 dias úteis (4 semanas, 1 dev + 0.5 designer + 0.5 CS).

---

## Fase 6 — Escalar com Confiança (semanas 13–16)

**Objetivo:** preparar a infraestrutura e o produto para crescer de 15 para 100+ clínicas sem refatoração pesada.

**Tema da Fase:** *"Crescer 10x sem o sistema cair."*

### Sprint 13 (semana 13) — Performance e capacity

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 6.1 | **Connection pooler** Supabase configurado explicitamente (`pgbouncer` em transaction mode); conexões reutilizadas. | Métrica Supabase: < 30% das conexões max em pico. | 0.5d |
| 6.2 | **Índices** revisados em todas as queries quentes (`EXPLAIN ANALYZE`); índices compostos `(clinica_id, data_agendamento, profissional_id)` etc. | Top-10 queries lentas todas < 50ms. | 2d |
| 6.3 | **Materialized view** para dashboard (refresh a cada 5min ou triggered por mutação). | Dashboard < 200ms p95 mesmo em clínica grande. | 1.5d |
| 6.4 | **Cursor pagination** em listagens grandes (`/prontuarios`, `/agendamentos`, `/lancamentos`). | Listar 10.000 prontuários paginado < 200ms por página. | 1d |
| 6.5 | **CDN para assets** (Vercel já faz) + revisão de fontes/imagens. | Total bundle < 350KB gzip. | 0.5d |
| 6.6 | **Teste de carga k6** simulando 200 clínicas × 20 usuários simultâneos. | p95 < 500ms, taxa de erro < 0.5%. | 1.5d |

### Sprint 14 (semana 14) — Observabilidade e SRE

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 6.7 | **Logs estruturados** (JSON) com `request_id`, `clinica_id`, `user_id`, `duration_ms` em todas as rotas. | Procurar por `request_id=xyz` retorna trace completo. | 1d |
| 6.8 | **Métricas custom** (Prometheus-compatible ou Datadog APM): latência por endpoint, erro por endpoint, usuários ativos, MRR realtime. | Dashboard de operação visualizado em tempo real. | 2d |
| 6.9 | **Alertas** (PagerDuty/Opsgenie ou Slack incoming): p95 > 1s, taxa de erro > 2%, queue de e-mails parada, Supabase down. | Simular falha → alerta chega em < 2min. | 1d |
| 6.10 | **Distributed tracing** (Sentry Performance ou OpenTelemetry → Honeycomb). | Trace completo de request com tempo em cada camada. | 1.5d |
| 6.11 | **Auditoria de dependências** (`pip-audit`, `npm audit`, Snyk free): rotina semanal no CI. | Nenhuma vuln High ≥ 7d sem update. | 0.5d |
| 6.12 | **Plano de Disaster Recovery**: RTO < 4h, RPO < 1h. Drill quinzenal de restore. | Documento + 1 drill executado com sucesso. | 1d |

### Sprint 15 (semana 15) — Maturidade do produto

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 6.13 | **Permissões granulares por usuário** (não só por role): admin pode definir "este profissional pode ver financeiro" ou "esta recepção não pode cancelar agendamento de outro profissional". | Painel de permissões custom; testes de cada combinação. | 3d |
| 6.14 | **Auditoria visual** (página `/auditoria` para admin): filtro por usuário, recurso, ação, período; export CSV. | Admin filtra "quem viu o prontuário X" em < 5s. | 2d |
| 6.15 | **Feature flags** (LaunchDarkly ou Unleash self-hosted): toda feature nova vai atrás de flag. | Painel de flags com on/off por clínica. | 1.5d |
| 6.16 | **Internacionalização base** (next-intl): português primeiro, mas com estrutura preparada para espanhol/inglês. | UI inteira passa por `t()`; trocar locale funciona. | 2d |
| 6.17 | **API pública v1** (read-only inicialmente) com autenticação por API key por clínica; documentação OpenAPI/Swagger. | Clínica gera API key; `curl` autenticado funciona. | 2d |

### Sprint 16 (semana 16) — Lançamento público

| # | Tarefa | Critério de aceite | Esforço |
|---|---|---|---|
| 6.18 | **Marketing launch**: Product Hunt, LinkedIn, Instagram da área, parcerias com influencers de fono/psico, anúncios Google Ads em palavras-chave de cauda longa. | 1.000 visitas no site no dia do lançamento; 50 leads. | (marketing) |
| 6.19 | **Webinar de lançamento** com convidado da área (fono/psico conhecido). | 100 inscritos; 50 ao vivo. | (marketing) |
| 6.20 | **Plano de retenção** dos primeiros 30 clientes: contato mensal pessoal, NPS quinzenal, kit boas-vindas físico. | 90% dos 30 primeiros ativos no fim do mês 1. | (CS) |
| 6.21 | **Postmortem do lançamento**: análise crítica do que funcionou e do que falhou. | Documento + plano de ajuste para próximo trimestre. | 1d |

**Critério de saída da Fase 6 (e do plano):**
- ✅ Infraestrutura suporta 200 clínicas × 30 usuários sem degradação.
- ✅ Observabilidade completa: posso responder "o que aconteceu" em < 5min.
- ✅ ≥ 30 clínicas pagantes ativas.
- ✅ MRR ≥ R$ 8.000 (caminho para R$ 30k em 6 meses).
- ✅ NPS ≥ 50.
- ✅ Churn mensal < 5%.
- ✅ Ticket de suporte/clínica/mês < 2.
- ✅ Documentação técnica e de produto completas.

**Esforço:** 20 dias úteis (4 semanas, 1 dev + 0.5 designer + 0.5 CS + atividades de marketing).

---

## 10. Cronograma consolidado

```
Semana │ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │10 │11 │12 │13 │14 │15 │16
───────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───
Fase 0 │ █ │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
Fase 1 │   │ █ │ █ │   │   │   │   │   │   │   │   │   │   │   │   │   │
Fase 2 │   │   │   │ █ │ █ │   │   │   │   │   │   │   │   │   │   │   │
Fase 3 │   │   │   │   │   │ █ │ █ │   │   │   │   │   │   │   │   │   │
Fase 4 │   │   │   │   │   │   │   │ █ │ █ │   │   │   │   │   │   │   │
Fase 5 │   │   │   │   │   │   │   │   │   │ █ │ █ │ █ │ █ │   │   │   │
Fase 6 │   │   │   │   │   │   │   │   │   │   │   │   │   │ █ │ █ │ █ │ █

Milestones:
- Semana 2:   ✅ MVP confiável (sem perda de dados)
- Semana 4:   ✅ Pronto para piloto (segurança/LGPD ok)
- Semana 6:   ✅ Beta privado (3–5 clínicas)
- Semana 8:   ✅ Beta pago (com billing)
- Semana 12:  ✅ Diferenciação (telemedicina, WhatsApp, prontuário avançado)
- Semana 16:  ✅ Lançamento público (escala)
```

| Fase | Semanas | Foco | Resultado | Esforço total |
|---|---|---|---|---|
| 0 | 0 | Setup | Ambiente pronto | 5d |
| 1 | 1–2 | Confiabilidade | Sem perda de dados | 10d |
| 2 | 3–4 | Segurança | Sem vazamentos | 10d |
| 3 | 5–6 | UX/Fluxos | Agradável de usar | 10d |
| 4 | 7–8 | Vendável | 3 piloto pagantes | 10d |
| 5 | 9–12 | Diferenciar | 15 clínicas + diferenciais | 20d |
| 6 | 13–16 | Escalar | 30+ clínicas + lançamento | 20d |
| **Total** | **16 semanas** | | | **85d (≈ 4 meses, 1 dev sênior)** |

---

## 11. Definition of Done por Fase

Antes de marcar uma Fase como "Done" e seguir para a próxima, **todos** os critérios abaixo precisam ser verdadeiros.

### Universal (todas as Fases)
- [ ] Todas as tasks da Fase fechadas no board.
- [ ] PRs revisados e merged em `main`.
- [ ] Deploy em staging há ≥ 48h sem incidentes Sev1/Sev2.
- [ ] Sentry zerado de erros não tratados da Fase.
- [ ] Cobertura de testes não regrediu vs. baseline.
- [ ] Documentação atualizada (ADRs, runbook, manual cliente quando aplicável).
- [ ] Demo interna de 30min mostrando o que mudou.
- [ ] Smoke test manual 100% verde.

### Específicos por Fase
- **Fase 1:** + checklist de 6 bugs críticos (B1–B6) marcados como fechados com teste regressivo.
- **Fase 2:** + penteste interno básico sem findings High/Critical + RLS em 100% das tabelas.
- **Fase 3:** + Lighthouse 4 categorias ≥ 85 + 3 usuários reais não-técnicos completam onboarding.
- **Fase 4:** + billing end-to-end em produção + 3 clínicas piloto contratadas.
- **Fase 5:** + 5 features competitivas operantes + NPS dos pilotos ≥ 40.
- **Fase 6:** + teste de carga 200×30 verde + observabilidade completa + 30 clínicas pagantes.

---

## 12. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dev fica sozinho e fica doente/parado | Alta | Alto | Documentar tudo; contratar dev pleno até Fase 3 |
| Supabase muda preço / política | Média | Alto | Backup off-platform desde Fase 0; código preparado para migrar |
| Clínica piloto encontra bug crítico não previsto | Alta | Médio | Bug bounty interno; SLA de resolução 24h em Sev1 |
| Concorrência baixa preço de R$ 99 pra R$ 49 | Média | Médio | Foco em nicho específico; diferenciação na Fase 5 |
| LGPD/ANPD intensifica fiscalização | Média | Alto | Fase 2 conclui antes de qualquer cliente real; DPO contratado meio-período |
| Pagamento Stripe não funciona bem com clínica brasileira (boleto, MEI) | Alta | Médio | Plano B com Asaas; testar com 3 piloto antes |
| Dev sai do projeto | Baixa | Crítico | Bus factor mitigado pela documentação contínua |
| Marketing não traz leads suficientes | Alta | Alto | Diversificar canais: orgânico (SEO/conteúdo) + paid (Google Ads) + parcerias + indicação |
| Demanda explode além da capacidade | Baixa | Médio | Fila de espera no signup; priorizar plano Business no atendimento |
| Vercel cobra muito acima do esperado | Média | Médio | Migrar para Railway/Render/Fly.io se função serverless ficar cara |

---

## 13. Anexos

### A. Checklist de revisão de Pull Request

Adicionar ao template de PR em `.github/PULL_REQUEST_TEMPLATE.md`:

- [ ] Não adiciona `str(e)` em response body.
- [ ] Não loga PHI (cpf, email, conteudo, descricao, nome em texto livre).
- [ ] Filtro `clinica_id` aplicado em toda query nova.
- [ ] Soft delete usado, nunca `DELETE` físico em tabelas clínicas.
- [ ] Whitelist de campos em endpoints PUT/PATCH.
- [ ] Teste cobrindo o feliz e o triste path.
- [ ] Sem `console.log` no código frontend.
- [ ] Documentação atualizada se mudou contrato de API.
- [ ] Migration backward-compatible (não quebra schema antigo).
- [ ] Feature atrás de flag se for nova funcionalidade.

### B. Templates a criar

1. `docs/adr/0001-template.md` — Architecture Decision Record.
2. `docs/runbook/incident.md` — Runbook de incidente.
3. `docs/runbook/postmortem-template.md` — Template de postmortem.
4. `docs/customer/onboarding.md` — Onboarding de cliente (CS).
5. `.github/PULL_REQUEST_TEMPLATE.md` — Checklist acima.
6. `.github/ISSUE_TEMPLATE/bug_report.md` — Template de bug.
7. `.github/ISSUE_TEMPLATE/feature_request.md` — Template de feature.

### C. Ferramentas recomendadas (custo total estimado: R$ 0–300/mês até Fase 4)

| Categoria | Ferramenta | Plano | Custo |
|---|---|---|---|
| Issue tracking | GitHub Projects ou Linear | Free / Standard | R$ 0–50 |
| Error tracking | Sentry | Developer | R$ 0 |
| Analytics | Vercel Analytics | Free | R$ 0 |
| Rate limit | Upstash Redis | Free | R$ 0 |
| Backup | Backblaze B2 | Pay-as-you-go | R$ 5–30 |
| Status page | BetterStack | Free | R$ 0 |
| Chat suporte | Crisp | Basic | R$ 0–125 |
| Help center | Notion ou Crisp | Free | R$ 0 |
| Auth provider | Supabase Auth | incluso | R$ 0 |
| Billing | Stripe ou Asaas | % por transação | variável |
| WhatsApp Business | 360dialog | Pay-per-message | R$ 0.10/msg |
| E-mail transacional | Resend | Free 3k/mês | R$ 0 |
| Domain + SSL | Registro.br + Cloudflare | Anual | R$ 40 |
| DPO meio-período | Consultoria externa | Mensal | R$ 1.500–3.000 (Fase 2+) |

### D. Compromisso semanal sugerido

- **Segunda 9h:** retrospectiva da semana anterior + planning da nova (30min).
- **Diário 9h–9h15:** stand-up (mesmo solo, escrever 3 linhas no canal: "Ontem / Hoje / Bloqueios").
- **Quarta 16h:** ligação com 1 cliente piloto a partir da Fase 4 (NPS qualitativo).
- **Sexta 16h:** demo da semana + atualização do status no plano + atualização das KPIs.

### E. Sinais de alerta para revisitar o plano

- Métrica técnica regredindo 2 semanas seguidas → reservar 1 sprint só para tech debt.
- NPS caindo abaixo de 30 → pausar features novas, ir investigar com clientes.
- Churn > 15% em 2 meses seguidos → re-validar nicho/PMF.
- Dev gastando > 30% do tempo em suporte → contratar CS ou automatizar.
- p95 > 1.5s em produção → priorizar performance imediatamente.

---

**Última atualização:** 10/05/2026
**Próxima revisão:** ao final de cada Fase
**Owner:** [seu nome]
