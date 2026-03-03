# SaaSClinico - Resumo Executivo da Arquitetura

**Última atualização:** 2 de Março de 2026

---

## 🎯 Visão Geral Rápida

**SaaSClinico** é uma aplicação SaaS completa para gerenciamento de clínicas de fonoaudiologia com:
- ✅ Multi-tenant (isolamento por clínica)
- ✅ Autenticação JWT + Supabase
- ✅ 13 módulos funcionais
- ✅ API REST + Frontend React
- ✅ Row Level Security (RLS) no banco

**Stack:**
- **Backend:** Flask (Python 3.11) + Supabase
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth + JWT Tokens

---

## 📈 Endpoints Principais (Quick Reference)

### Authentication
```
POST   /auth/login              # Autentica usuário
POST   /auth/signup             # Registra novo usuário
```

### Pacientes
```
GET    /pacientes               # Listar pacientes
GET    /pacientes/<id>          # Buscar por ID
POST   /pacientes               # Criar (admin, recepcao)
PUT    /pacientes/<id>          # Atualizar (admin, recepcao)
DELETE /pacientes/<id>          # Inativar (admin, recepcao)
```

### Agendamentos
```
GET    /agendamentos            # Listar (com filtros)
GET    /agendamentos/<id>       # Buscar por ID
POST   /agendamentos            # Criar (admin, recepcao)
PUT    /agendamentos/<id>       # Atualizar (admin, recepcao)
PUT    /agendamentos/<id>/status # Alterar status
```

### Prontuários
```
GET    /prontuarios             # Listar (profissionais veem apenas seus pacientes)
GET    /prontuarios/<id>        # Buscar por ID
POST   /prontuarios             # Criar
PUT    /prontuarios/<id>        # Atualizar
```

### Frequência (Presença)
```
POST   /frequencia              # Registrar frequência
GET    /frequencia/paciente/<id> # Histórico do paciente
GET    /frequencia/paciente/<id>/estatisticas # Taxa de frequência
```

### Mensalidades
```
GET    /mensalidades            # Listar
GET    /mensalidades/<id>       # Buscar
POST   /mensalidades            # Criar
PUT    /mensalidades/<id>       # Atualizar
POST   /mensalidades/<id>/pagamentos # Registrar pagamento
```

### Relatórios
```
GET    /relatorios              # Listar
GET    /relatorios/<id>         # Buscar
POST   /relatorios              # Upload de documento
DELETE /relatorios/<id>         # Deletar
```

### Dashboard
```
GET    /dashboard/stats         # Estatísticas (pacientes, agendamentos hoje/semana)
GET    /dashboard/recent        # Atividades recentes
```

### Outros
```
GET    /salas                   # Listar salas
POST   /salas                   # Criar sala
GET    /usuarios                # Listar usuários
POST   /usuarios                # Criar usuário (admin)
GET    /profissionais           # Listar profissionais
```

---

## 🔐 Roles e Permissões

| Role | Pacientes | Agendamentos | Prontuários | Frequência | Relatórios |
|------|----------|-------------|------------|-----------|-----------|
| **admin** | CRUD | CRUD | CRUD | Ver | CRUD |
| **recepcao** | CRUD | CRUD | Ver | Ver | Ver |
| **fono** | Ver | Ver | CRUD próprios | Registrar próprios | CRUD próprios |
| **medico** | Ver | Ver | CRUD próprios | Ver | CRUD próprios |
| **profissional** | Ver | Ver | Ver | Registrar próprios | Ver |

---

## 📁 Estrutura Chave

```
Backend:
  app.py                  → Entry point (Factory Flask)
  config.py              → Configurações
  app/routes/            → 13 Blueprints (Controllers)
  app/services/          → Lógica de negócio
  app/repositories/      → Acesso a dados
  database/supabase_client.py → Singleton cliente Supabase

Frontend:
  src/app/               → Páginas Next.js
  src/components/        → React Components
  src/services/          → API wrapper
  src/context/           → AuthContext (estado global)
  src/lib/api.js        → Cliente HTTP (fetch wrapper)

Database:
  supabase/migrations/   → Histórico do schema
  supabase/scripts/      → RPC Functions
```

---

## 🔄 Fluxo de Autenticação

1. **Login:** `POST /auth/login` com email + password
2. **Supabase Auth:** Autentica no Supabase
3. **Backend:** Busca perfil (clinica_id, role) e gera **JWT Token**
4. **Frontend:** Armazena token em `localStorage`
5. **Requisições:** Token enviado em header `Authorization: Bearer <token>`
6. **Backend:** Valida com decorator `@require_auth` + valida role com `@require_roles`

---

## 🛡️ Segurança Multi-tenant

**Isolamento por clinica_id:**
```
1. Usuário autentica → token contém clinica_id
2. Routes extraem clinica_id do token
3. BaseRepository força filtro clinica_id em todas queries
4. Row Level Security (RLS) do Supabase como 2ª camada
5. Resultado: Usuário só vê dados da sua clínica
```

---

## 📊 Serviços de Negócio

| Serviço | Responsabilidade |
|---------|-----------------|
| **PacienteService** | CRUD + validação CPF |
| **AgendamentoService** | Validação de conflitos, transições de status |
| **MensalidadeService** | Gestão de pagamentos |
| **FrequenciaService** | Registro de presença + estatísticas |
| **RelatorioService** | Upload e gerenciamento de documentos |
| **DashboardService** | Estatísticas e métricas |
| **PDFService** | Geração de PDFs |
| **ProntuarioService** | Gestão de registros médicos |

---

## 🗂️ Acesso ao Banco de Dados

**BaseRepository** = CRUD + Multi-tenant automático

```python
# Uso:
repo = BaseRepository('pacientes', clinica_id)

# Automaticamente:
pacientes = repo.get_all()  # SELECT * WHERE clinica_id = ? 
paciente = repo.get_by_id(id)  # SELECT * WHERE id = ? AND clinica_id = ?
novo = repo.create(data)  # INSERT com clinica_id forçado
repo.update(id, data)  # UPDATE WHERE id = ? AND clinica_id = ?
```

**RPC Functions** (para queries complexas):
- `get_pacientes()` - Busca otimizada
- `get_agendamentos()` - Com valida conflitos
- `get_prontuarios()` - Com acesso por role
- `get_dashboard_stats()` - Agregações

---

## 🔗 Validações Chave

### Agendamentos
```
✓ Profissional sem conflito de horário (mesma data)
✓ Horário início < fim
✓ Formato de data/hora válido
✓ Não permitir agendamentos no passado
✓ Transições de status válidas (agendada→confirmada→concluida)
```

### Pacientes
```
✓ Nome obrigatório
✓ CPF único por clínica (se fornecido)
✓ Email válido (se fornecido)
✓ Soft delete (marca como inativo)
```

### Mensalidades
```
✓ Só um paciente pode ter uma mensalidade
✓ Validação de datas (vencimento)
✓ Histórico de pagamentos
```

---

## 🚀 Dependências Críticas

**Backend:**
- Flask 3.0.0
- Supabase SDK 1.0.4
- PyJWT 2.8.0
- ReportLab 4.0.7 (PDFs)
- Gunicorn 21.2.0 (produção)

**Frontend:**
- Next.js 14
- TypeScript/JavaScript
- Tailwind CSS 3
- Fetch API (nativa)

**Database:**
- PostgreSQL (via Supabase)
- Row Level Security (RLS) ativada
- Triggers e Functions customizadas

---

## 🔐 Env Variables Obrigatórias

```bash
# Backend (.env)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
SUPABASE_JWT_SECRET=jwt-secret
SECRET_KEY=flask-secret-key
ENVIRONMENT=development|production
CORS_ORIGINS=http://localhost:3000,https://example.com

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000 (dev) ou https://api.example.com (prod)
```

---

## 📊 Status Agendamentos

```
agendada ────→ confirmada ────→ concluida (✓ Final)
   ↓                ↓
faltou (Final)  cancelada (Final)
```

---

## 💼 Tabelas Principais

```
clinicas
├── id (PK)
├── nome_clinica
├── email
└── ...

usuarios
├── id (PK)
├── clinica_id (FK)
├── email
├── role (admin|recepcao|fono|medico|profissional)
├── ativo
└── ...

pacientes
├── id (PK)
├── clinica_id (FK)
├── nome_completo
├── cpf (UNIQUE per clinica)
├── email
├── ativo
└── ...

agendamentos
├── id (PK)
├── clinica_id (FK)
├── paciente_id (FK)
├── profissional_id (FK)
├── sala_id (FK)
├── data_agendamento
├── horario_inicio
├── horario_fim
├── status (agendada|confirmada|concluida|cancelada|faltou)
└── ...

prontuarios
├── id (PK)
├── clinica_id (FK)
├── paciente_id (FK)
├── profissional_id (FK)
├── data_consulta
├── anamnese
├── diagnostico
└── ...

mensalidades
├── id (PK)
├── clinica_id (FK)
├── paciente_id (FK)
├── valor_mensal
├── status (ativa|paga|vencida)
└── ...

frequencia
├── id (PK)
├── clinica_id (FK)
├── paciente_id (FK)
├── profissional_id (FK)
├── data_atendimento
├── compareceu (bool)
└── ...

relatorios
├── id (PK)
├── clinica_id (FK)
├── paciente_id (FK)
├── profissional_id (FK)
├── arquivo (blob)
├── tipo (pdf|doc|docx)
└── ...

pacientes_profissionais (Many-to-Many)
├── paciente_id (FK)
├── profissional_id (FK)
├── clinica_id (FK)
└── ativo
```

---

## 🎯 Exemplo: Criar Agendamento

**1. Frontend:**
```javascript
const agendamento = {
  paciente_id: 'uuid-1',
  profissional_id: 'uuid-2',
  sala_id: 'uuid-3',
  data_agendamento: '2026-03-15',
  horario_inicio: '09:00',
  horario_fim: '10:00'
};

const resultado = await agendamentoService.create(agendamento);
```

**2. HTTP Request:**
```
POST /agendamentos HTTP/1.1
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{ agendamento }
```

**3. Backend:**
- `@require_auth` valida token
- `@require_roles(['admin', 'recepcao'])` valida permissão
- `get_current_user()` extrai clinica_id
- `AgendamentoService.validar_conflito()` valida horários
- `BaseRepository.create()` salva com clinica_id automático
- Retorna agendamento criado com status: "agendada"

**4. Frontend:**
- Recebe agendamento criado
- Atualiza UI (lista de agendamentos)
- Mostra notificação de sucesso

---

## 🔧 Configuração Rápida (Dev)

```bash
# Backend
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
echo "SUPABASE_URL=..." > .env
echo "SUPABASE_KEY=..." >> .env
python -c "from app import create_app; app = create_app(); app.run()"

# Frontend (em outro terminal)
cd frontend-next
npm install
npm run dev
# Acessa http://localhost:3000
```

---

## 📞 Suporte Rápido

### Como...

**...autenticar uma requisição?**
- Header: `Authorization: Bearer <token>`
- Token obtido em POST `/auth/login`
- Válido por 7 dias

**...filtrar dados?**
- Query params: `GET /agendamentos?status=agendada&data_inicio=2026-03-01`
- Filtros aplicados no BaseRepository com clinica_id automático

**...validar conflitos de agendamento?**
- Service valida: novo_inicio < ag_fim AND novo_fim > ag_inicio
- Ignora agendamentos cancelados

**...gerenciar permissões?**
- Role definido no token JWT
- Validado com decorator `@require_roles(['admin'])`
- Retorna 403 se sem permissão

**...adicionar novo endpoint?**
1. Criar função em `routes/xyz_routes.py`
2. Adicionar serviço em `services/xyz_service.py` se necessário
3. Registrar blueprint em `app.py` com `url_prefix`
4. Documentar em ARQUITETURA_TECNICA.md

---

## 🎓 Padrões de Código

### Routes (Controller)
```python
@bp.route('/endpoint', methods=['POST'])
@require_auth
@require_roles(['admin'])
def mana_funcao():
    user = get_current_user()
    clinica_id = user['clinica_id']
    data = request.get_json()
    service = MeuService()
    resultado = service.meu_metodo(clinica_id, data)
    return jsonify(resultado), 201
```

### Services (Lógica)
```python
class MeuService:
    def __init__(self):
        self.repo = BaseRepository('minha_tabela')
    
    def meu_metodo(self, clinica_id, data):
        # Validações
        # Processamento
        # Retorna resultado
        pass
```

### Frontend
```javascript
// service
export const meuService = {
  async getAll(params) {
    return api.get('/endpoint', { params });
  }
};

// uso em componente
const dados = await meuService.getAll({ filtro: 'valor' });
```

---

## ✅ Checklist de Desenvolvimento

- [ ] Adicionar `@require_auth` em rotas protegidas
- [ ] Adicionar `@require_roles(['role'])` para autorização
- [ ] Usar `BaseRepository(table_name, clinica_id)` para acesso a dados
- [ ] Extrair `clinica_id` sempre do `get_current_user()`
- [ ] Validar com Pydantic Schemas
- [ ] Testar com múltiplos perfis/roles
- [ ] Documentar endpoints em ARQUITETURA_TECNICA.md
- [ ] Adicionar tratamento de erro apropriado (try/except)
- [ ] Usar logging para debug
- [ ] Validar filtros de query params

---

## 🚨 Troubleshooting Comum

| Problema | Solução |
|----------|---------|
| 401 Unauthorized | Token ausente ou expirado, fazer login novamente |
| 403 Forbidden | Role do usuário não tem permissão, verificar `@require_roles` |
| Conflito de agendamento | Validar horário (início < fim) e verificar agendamentos existentes |
| CPF duplicado | CPF já existe na clínica, verificar `check_cpf_exists` |
| Usuário não vê dados | Verificar `clinica_id`, pode estar isolado por RLS |

---

## 📚 Links para Mais Info

- [ARQUITETURA_TECNICA.md](ARQUITETURA_TECNICA.md) - Documentação completa
- [supabase/SCHEMA_DOCUMENTATION.md](supabase/SCHEMA_DOCUMENTATION.md) - Schema SQL
- [docs/RELACAO_PACIENTE_PROFISSIONAL.md](docs/RELACAO_PACIENTE_PROFISSIONAL.md) - Relações
- [docs/RELATORIOS_UPLOAD.md](docs/RELATORIOS_UPLOAD.md) - Upload de arquivos

---

**Versão:** 1.0.0  
**Data:** 2 de Março de 2026  
**Status:** ✅ Pronto para usar
