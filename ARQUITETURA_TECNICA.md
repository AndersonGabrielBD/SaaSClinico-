# Documentação Técnica - SaaSClinico

**Versão:** 1.0.0  
**Data:** 2 de Março de 2026  
**Descrição:** Documentação completa da arquitetura técnica, endpoints, fluxo de dados e componentes do SaaSClinico

---

## 📑 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Autenticação e Autorização](#autenticação-e-autorização)
5. [API Endpoints](#api-endpoints)
6. [Schemas/Modelos de Dados](#schemasmodelos-de-dados)
7. [Camada de Serviços](#camada-de-serviços)
8. [Fluxo de Dados Frontend-Backend](#fluxo-de-dados-frontend-backend)
9. [Acesso ao Banco de Dados](#acesso-ao-banco-de-dados)
10. [Dependências e Configurações](#dependências-e-configurações)
11. [Middleware de Segurança](#middleware-de-segurança)

---

## 🏗️ Visão Geral da Arquitetura

O SaaSClinico é uma aplicação SaaS multi-tenant para gerenciamento de clínicas de fonoaudiologia. Utiliza arquitetura em **camadas** com separação clara entre:

```
┌─────────────────────────────────────────────┐
│         Frontend (Next.js + TypeScript)     │
│         - UI Components (Tailwind CSS)      │
│         - State Management (Context API)    │
│         - Services Layer (API Wrapper)      │
└────────────────┬────────────────────────────┘
                 │  HTTP/JSON
                 ▼
┌─────────────────────────────────────────────┐
│      Backend (Flask + Python)               │
│  ┌──────────────────────────────────────┐   │
│  │  Routes / Blueprints                │   │
│  │  (Controllers - recebem requisições) │   │
│  ├──────────────────────────────────────┤   │
│  │  Services                            │   │
│  │  (Lógica de negócio)                 │   │
│  ├──────────────────────────────────────┤   │
│  │  Repositories                        │   │
│  │  (Acesso a dados)                    │   │
│  ├──────────────────────────────────────┤   │
│  │  Middleware                          │   │
│  │  (JWT, CORS, etc)                    │   │
│  └──────────────────────────────────────┘   │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│   Banco de Dados (Supabase PostgreSQL)      │
│  - Row Level Security (RLS)                 │
│  - RPC Functions (otimizações)              │
│  - Multi-tenant (clinica_id como isolamento)│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│   Auth (Supabase Auth)                      │
│  - JWT Tokens                               │
│  - Sign up/Sign in                          │
└─────────────────────────────────────────────┘
```

---

## 💻 Stack Tecnológico

### Backend
| Componente | Tecnologia | Versão | Descrição |
|-----------|-----------|--------|-----------|
| Web Framework | Flask | 3.0.0 | Framework web leve em Python |
| CORS | Flask-CORS | 4.0.0 | Habilita requisições cross-origin |
| Banco de Dados | Supabase | 1.0.4 | PostgreSQL + Auth + Real-time |
| JWT | PyJWT | 2.8.0 | Criação e validação de tokens |
| HTTP Client | Requests | 2.31.0 | Cliente HTTP para requisições internas |
| PDF | ReportLab | 4.0.7 | Geração de documents PDF |
| Servidor | Gunicorn | 21.2.0 | WSGI HTTP Server para produção |
| Validação | Pydantic | - | Validação de schemas (schemas/) |
| Variáveis | python-dotenv | 1.0.0 | Carregamento de .env |

### Frontend
| Componente | Tecnologia | Descrição |
|-----------|-----------|-----------|
| Framework | Next.js 14+ | React com SSR/SSG |
| Linguagem | TypeScript/JavaScript | Type safety |
| Styling | Tailwind CSS 3 | Utility-first CSS framework |
| PostCSS | Via tailwind.config | Processamento de CSS |
| HTTP Client | Fetch API | Cliente HTTP nativo |
| State | Context API | Gerenciamento de estado (AuthContext) |

### DevOps
| Componente | Tecnologia | Descrição |
|-----------|-----------|-----------|
| Database | Supabase (PostgreSQL) | Banco principal multi-tenant |
| Host | Vercel | Deployment backend (Procfile) |
| Versioning | Git | Controle de versão |
| Secrets | .env | Variáveis de ambiente |

---

## 📁 Estrutura de Pastas

### Backend

```
backend/
├── app.py                          # Entry point / Factory de criação da app Flask
├── config.py                       # Configurações centralizadas
├── requirements.txt               # Dependências Python
├── runtime.txt                    # Versão do Python (Procfile)
├── Procfile                       # Instruções para deployment (Heroku/Vercel)
├── vercel.json                    # Config para deployment Vercel
│
├── api/
│   └── index.py                   # API handler para serverless (Vercel)
│
├── app/
│   ├── __init__.py
│   │
│   ├── routes/                    # Controllers / Endpoints (13 blueprints)
│   │   ├── auth_routes.py         # Login, signup, verificação token
│   │   ├── paciente_routes.py     # CRUD de pacientes
│   │   ├── prontuario_routes.py   # CRUD de prontuários
│   │   ├── agendamento_routes.py  # CRUD e validação de agendamentos
│   │   ├── usuario_routes.py      # CRUD de usuários/profissionais
│   │   ├── sala_routes.py         # CRUD de salas
│   │   ├── dashboard_routes.py    # Estatísticas e métricas
│   │   ├── mensalidades_routes.py # Gerenciamento de pagamentos
│   │   ├── frequencia_routes.py   # Registro de frequência de atendimento
│   │   ├── relatorios_routes.py   # Upload e gerenciamento de relatórios
│   │   ├── financeiro_routes.py   # Relatórios financeiros
│   │   ├── verificacao_routes.py  # Verificação de email/dados
│   │   ├── profissional_routes.py # Gerenciamento de profissionais
│   │   └── __init__.py
│   │
│   ├── services/                  # Lógica de negócio
│   │   ├── paciente_service.py
│   │   ├── agendamento_service.py
│   │   ├── prontuario_service.py
│   │   ├── mensalidade_service.py
│   │   ├── frequencia_service.py
│   │   ├── relatorio_service.py
│   │   ├── dashboard_service.py
│   │   ├── pdf_service.py         # Geração de PDFs
│   │   └── __init__.py
│   │
│   ├── repositories/              # Camada de acesso a dados
│   │   ├── base_repository.py     # Repository genérica com RPC
│   │   └── __init__.py
│   │
│   ├── schemas/                   # Pydantic models (validação)
│   │   ├── paciente_schema.py
│   │   ├── agendamento_schema.py
│   │   ├── prontuario_schema.py
│   │   ├── dashboard_schema.py
│   │   ├── frequencia_schema.py
│   │   ├── mensalidade_schema.py
│   │   └── __init__.py
│   │
│   ├── models/                    # Modelos de dados (futuro)
│   │   └── __init__.py
│   │
│   ├── utils/                     # Funções auxiliares
│   │   ├── jwt_utils.py           # Criação/validação JWT
│   │   ├── exceptions.py          # Exceções customizadas
│   │   └── __init__.py
│   │
│   └── __init__.py
│
├── database/
│   ├── supabase_client.py         # Cliente Supabase singleton
│   └── __init__.py
│
└── middleware/
    ├── auth_middleware.py         # Middleware JWT (alternativo)
    └── __init__.py
```

### Frontend

```
frontend-next/
├── package.json                   # Dependências Node.js
├── tsconfig.json                  # Config TypeScript
├── next.config.mjs                # Config Next.js
├── tailwind.config.cjs            # Config Tailwind CSS
├── postcss.config.cjs             # Config PostCSS
├── next-env.d.ts                  # Types do Next.js
│
├── src/
│   ├── app/
│   │   ├── globals.css            # Estilos globais
│   │   ├── layout.js              # Layout raiz
│   │   ├── page.js                # Home page
│   │   │
│   │   ├── (auth)/                # Grupo de rotas autenticadas
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── ...
│   │   │
│   │   └── (dashboard)/           # Dashboard protegido
│   │       ├── página.js
│   │       └── ...
│   │
│   ├── components/                # React Components (UI)
│   │   ├── agenda/                # Componentes de agenda
│   │   ├── auth/                  # Componentes autenticação
│   │   ├── common/                # Componentes genéricos
│   │   ├── frequencia/            # Componentes frequência
│   │   ├── pacientes/             # Componentes pacientes
│   │   ├── prontuarios/           # Componentes prontuários
│   │   └── relatorios/            # Componentes relatórios
│   │
│   ├── context/
│   │   └── AuthContext.jsx        # Context global de autenticação
│   │
│   ├── hooks/
│   │   └── index.ts               # Custom hooks
│   │
│   ├── services/                  # Integração com API Backend
│   │   ├── agendamentoService.js
│   │   ├── dashboardService.js
│   │   ├── frequenciaService.js
│   │   ├── mensalidadeService.js
│   │   ├── pacienteService.js
│   │   ├── profissionalService.js
│   │   ├── prontuarioService.js
│   │   ├── relatorioService.js
│   │   └── usuarioService.js
│   │
│   ├── lib/
│   │   └── api.js                 # Cliente HTTP base (Fetch wrapper)
│   │
│   └── types/                     # Types TypeScript
│       └── ...
│
└── jsconfig.json                  # Config JavaScript (alias paths)
```

### Banco de Dados (Supabase)

```
supabase/
├── SCHEMA_DOCUMENTATION.md        # Documentação de schemas
├── QUERY_EXAMPLES.sql             # Exemplos de queries
├── TRIGGERS_AND_FUNCTIONS.sql     # Triggers e functions PostgreSQL
│
├── migrations/
│   ├── 001_initial_schema.sql          # Schema inicial
│   ├── 002_fix_rls_policies.sql        # Correções de RLS
│   ├── 002_sistema_mensalidades_relatorios_frequencia.sql
│   ├── 003_optimize_performance.sql    # Otimizações
│   ├── 004_create_rpc_functions.sql    # RPC Functions
│   ├── 004_pacientes_profissionais_relacao.sql
│   ├── 005_fix_prontuarios_rpc.sql
│   └── 006_fix_agendamentos_rpc.sql
│
└── scripts/
    └── ...
```

---

## 🔐 Autenticação e Autorização

### Fluxo de Autenticação

```
┌──────────────┐                    ┌──────────────────┐
│   Frontend   │                    │   Backend Flask  │
└──────┬───────┘                    └────────┬─────────┘
       │                                     │
       │  POST /auth/login                   │
       │  { email, password }                │
       ├────────────────────────────────────>│
       │                                     │
       │                              [Auth via Supabase]
       │                              [Busca perfil user]
       │                              [Gera JWT token]
       │                                     │
       │  { token, user }                    │
       │<────────────────────────────────────┤
       │                                     │
  [localStorage]                             │
  [token]                                    │
       │                                     │
       │  GET /api/endpoint                  │
       │  Authorization: Bearer <token>      │
       ├────────────────────────────────────>│
       │                                     │
       │                              [@require_auth]
       │                              [Valida JWT]
       │                              [Extrai user_id]
       │                                     │
       │  { data }                           │
       │<────────────────────────────────────┤
```

### Estrutura do Token JWT

```javascript
{
  "user_id": "uuid-do-usuario",
  "email": "usuario@example.com",
  "clinica_id": "uuid-da-clinica",
  "role": "admin|recepcao|fono|medico|profissional",
  "exp": 1704067200,  // 7 dias
  "iat": 1703462400
}
```

### Roles e Permissões

| Role | Descrição | Permissões |
|------|-----------|-----------|
| `admin` | Administrador da clínica | Todas as operações, gerenciar usuários |
| `recepcao` | Recepcionista | CRUD completo de pacientes, agendamentos, salas |
| `fono` | Fonoaudiólogo | Visualizar pacientes, criar/editar prontuários, registrar frequência |
| `medico` | Médico | Visualizar pacientes, criar/editar prontuários |
| `profissional` | Outro profissional | Visualizar dados, registrar frequência |

### Decoradores de Proteção

```python
@require_auth                           # Valida presença de token JWT
def get_dados():
    user = get_current_user()           # Extrai dados do token
    ...

@require_roles(['admin', 'recepcao'])   # Valida role do usuário
def criar_usuario():
    ...
```

---

## 🔌 API Endpoints

### 1. Autenticação (`/auth`)

| Método | Endpoint | Descrição | Request | Response | Auth |
|--------|----------|-----------|---------|----------|------|
| POST | `/auth/login` | Autentica usuário | `{ email, password }` | `{ token, user }` | ❌ |
| POST | `/auth/signup` | Registra novo usuário | `{ email, password, nome, clinica_nome }` | `{ user }` | ❌ |

**Detalhes do Login:**
```python
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "senha123"
}

Response (200):
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "usuario@example.com",
    "clinica_id": "uuid",
    "role": "admin",
    "nome_completo": "Nome do Usuário"
  }
}
```

---

### 2. Pacientes (`/pacientes`)

**Roles autorizadas:** `admin`, `recepcao`, `fono`, `medico`, `profissional`

| Método | Endpoint | Descrição | Params | Auth |
|--------|----------|-----------|--------|------|
| GET | `/pacientes` | Lista pacientes | `?search=x&ativo=true` | ✅ |
| GET | `/pacientes/<id>` | Busca paciente by ID | - | ✅ |
| POST | `/pacientes` | Cria novo paciente | Body: PacienteCreate | ✅ (admin, recepcao) |
| PUT | `/pacientes/<id>` | Atualiza paciente | Body: PacienteUpdate | ✅ (admin, recepcao) |
| DELETE | `/pacientes/<id>` | Inativa paciente | - | ✅ (admin, recepcao) |

**Schema PacienteCreate/Update:**
```python
{
  "nome_completo": str,          # Obrigatório
  "cpf": str,                    # Único por clínica
  "data_nascimento": date,
  "genero": str,
  "email": str,
  "telefone_principal": str,
  "telefone_secundario": str,
  "endereco": str,
  "numero": str,
  "complemento": str,
  "cidade": str,
  "estado": str,
  "cep": str,
  "responsavel_nome": str,
  "responsavel_telefone": str,
  "responsavel_email": str,
  "responsavel_relacao": str,
  "observacoes": str
}
```

---

### 3. Prontuários (`/prontuarios`)

**Roles autorizadas:** `admin`, `recepcao`, `fono`, `medico`, `profissional`

| Método | Endpoint | Descrição | Params | Notas |
|--------|----------|-----------|--------|-------|
| GET | `/prontuarios` | Lista prontuários | `?paciente_id=x` | Profissionais veem apenas seus pacientes |
| GET | `/prontuarios/<id>` | Busca prontuário | - | Valida acesso por role |
| POST | `/prontuarios` | Cria prontuário | Body: ProntuarioCreate | ✅ |
| PUT | `/prontuarios/<id>` | Atualiza prontuário | Body: ProntuarioUpdate | ✅ |
| DELETE | `/prontuarios/<id>` | Deleta prontuário | - | ✅ |

---

### 4. Agendamentos (`/agendamentos`)

**Roles autorizadas:** `admin`, `recepcao` (criar/editar), todos (visualizar)

| Método | Endpoint | Descrição | Params | Auth |
|--------|----------|-----------|--------|------|
| GET | `/agendamentos` | Lista agendamentos | `?paciente_id=x&profissional_id=x&status=x&data_inicio=x&data_fim=x` | ✅ |
| GET | `/agendamentos/<id>` | Busca agendamento | - | ✅ |
| POST | `/agendamentos` | Cria agendamento | Body: AgendamentoCreate | ✅ |
| PUT | `/agendamentos/<id>` | Atualiza agendamento | Body: AgendamentoUpdate | ✅ |
| PUT | `/agendamentos/<id>/status` | Atualiza status | `{ "status": "confirmada|concluida|faltou|cancelada" }` | ✅ |

**Schema AgendamentoCreate:**
```python
{
  "paciente_id": str,          # Obrigatório
  "profissional_id": str,      # Obrigatório
  "sala_id": str,              # Obrigatório
  "data_agendamento": str,     # YYYY-MM-DD
  "horario_inicio": str,       # HH:MM
  "horario_fim": str,          # HH:MM
  "tipo_atendimento": str,     # "Avaliação", "Acompanhamento", etc
  "observacoes": str
}
```

**Validações de Agendamento:**
- ✅ Valida conflito de horário (mesmo profissional, mesma data)
- ✅ Valida formato de data (YYYY-MM-DD)
- ✅ Valida formato de hora (HH:MM)
- ✅ Valida que início < fim
- ✅ Não permite agendamentos no passado

**Estados de Agendamento:**
```
agendada → confirmada → concluida  (Final)
       ↓                          (Finalizado)
     faltou  (Final)              ↓
       ↓                     cancelada (Final)
     cancelada (Final)
```

---

### 5. Dashboard (`/dashboard`)

**Roles autorizadas:** Todas (autenticado)

| Método | Endpoint | Descrição | Response |
|--------|----------|-----------|----------|
| GET | `/dashboard/stats` | Estatísticas gerais | `{ total_pacientes, agendamentos_hoje, agendamentos_semana, agendamentos: { total, agendados, confirmados, concluidos, cancelados } }` |
| GET | `/dashboard/recent` | Atividades recentes | `{ agendamentos: [], pacientes: [] }` |

**Otimização:** Usa RPC Function `get_dashboard_stats` quando disponível, fallback para método Python.

---

### 6. Usuários (`/usuarios`)

**Roles autorizadas:** `admin`, `recepcao` (visualizar), `admin` (criar/editar)

| Método | Endpoint | Descrição | Params | Auth |
|--------|----------|-----------|--------|------|
| GET | `/usuarios` | Lista usuários | `?ativo=true&role=fono,medico` | ✅ |
| GET | `/usuarios/<id>` | Busca usuário | - | ✅ |
| POST | `/usuarios` | Cria usuário | Body: UsuarioCreate | ✅ (admin) |
| PUT | `/usuarios/<id>` | Atualiza usuário | Body: UsuarioUpdate | ✅ (admin) |
| DELETE | `/usuarios/<id>` | Inativa usuário | - | ✅ (admin) |

---

### 7. Salas (`/salas`)

**Roles autorizadas:** `admin`, `recepcao`, `profissional` (visualizar)

| Método | Endpoint | Descrição | Params | Auth |
|--------|----------|-----------|--------|------|
| GET | `/salas` | Lista salas | `?ativo=true` | ✅ |
| GET | `/salas/<id>` | Busca sala | - | ✅ |
| POST | `/salas` | Cria sala | Body: `{ nome, capacidade, ativo }` | ✅ (admin, recepcao) |
| PUT | `/salas/<id>` | Atualiza sala | Body: `{ nome, capacidade, ativo }` | ✅ (admin, recepcao) |
| DELETE | `/salas/<id>` | Inativa sala | - | ✅ (admin, recepcao) |

---

### 8. Mensalidades (`/mensalidades`)

**Roles autorizadas:** `admin`, `recepcao`

| Método | Endpoint | Descrição | Params | Auth |
|--------|----------|-----------|--------|------|
| GET | `/mensalidades` | Lista mensalidades | `?ativo=true` | ✅ |
| GET | `/mensalidades/<id>` | Busca mensalidade | - | ✅ |
| GET | `/mensalidades/paciente/<paciente_id>` | Mensalidade do paciente | - | ✅ |
| POST | `/mensalidades` | Cria mensalidade | Body: MensalidadeCreate | ✅ |
| PUT | `/mensalidades/<id>` | Atualiza mensalidade | Body: MensalidadeUpdate | ✅ |
| POST | `/mensalidades/<id>/pagamentos` | Registra pagamento | Body: `{ data_pagamento, valor, metodo }` | ✅ |

---

### 9. Frequência (`/frequencia`)

**Descrição:** Registro de frequência de atendimento (comparecimento)

| Método | Endpoint | Descrição | Response | Autenticação |
|--------|----------|-----------|----------|-------------|
| POST | `/frequencia` | Registra frequência | `{ id, paciente_id, profissional_id, data_atendimento, compareceu, ... }` | ✅ Profissionais registram suas próprias |
| GET | `/frequencia/paciente/<paciente_id>` | Lista frequência do paciente | `[{...}, ...]` | ✅ |
| GET | `/frequencia/paciente/<paciente_id>/estatisticas` | Estatísticas de frequência | `{ total_agendamentos, compareceu, nao_compareceu, taxa_frequencia }` | ✅ |

**Schema de Registro:**
```python
{
  "paciente_id": str,           # Obrigatório
  "profissional_id": str,       # Obrigatório (forçado para user_id se não admin)
  "data_atendimento": str,      # YYYY-MM-DD
  "compareceu": bool,           # true/false
  "agendamento_id": str,        # Opcional - vincula ao agendamento
  "observacoes": str            # Opcional
}
```

---

### 10. Relatórios (`/relatorios`)

**Roles autorizadas:** `admin`, `profissional` (criar próprio)

| Método | Endpoint | Descrição | Response | Autenticação |
|--------|----------|-----------|----------|-------------|
| GET | `/relatorios` | Lista relatórios | `[{...}, ...]` | ✅ |
| GET | `/relatorios/<id>` | Busca relatório | Documento | ✅ |
| POST | `/relatorios` | Upload de relatório | `{ id, arquivo, ... }` | ✅ |
| DELETE | `/relatorios/<id>` | Deleta relatório | - | ✅ |
| GET | `/relatorios/<id>/download` | Download arquivo | Binary | ✅ |

**Tipos de arquivo permitidos:** `pdf`, `doc`, `docx`  
**Tamanho máximo:** 16MB

---

### 11. Financeiro (`/financeiro`)

**Roles autorizadas:** `admin`, `recepcao`

Endpoints para relatórios financeiros e análises (detalhes em RELATORIOS_UPLOAD.md)

---

### 12. Verificação (`/verificacao`)

**Roles autorizadas:** Conforme necessário

Endpoints para verificações adicionais (email, dados, etc)

---

### 13. Profissionais (`/profissionais`)

**Roles autorizadas:** `admin`, `recepcao`

Gerenciamento de profissionais (relações com pacientes, especialidades, etc)

---

## 📊 Schemas/Modelos de Dados

### Paciente
```python
class PacienteBase(BaseModel):
    nome_completo: str              # Obrigatório
    cpf: Optional[str]              # Único
    data_nascimento: Optional[date]
    genero: Optional[str]           # M/F/O
    email: Optional[EmailStr]
    telefone_principal: Optional[str]
    telefone_secundario: Optional[str]
    endereco: Optional[str]
    numero: Optional[str]
    complemento: Optional[str]
    cidade: Optional[str]
    estado: Optional[str]
    cep: Optional[str]
    responsavel_nome: Optional[str]
    responsavel_telefone: Optional[str]
    responsavel_email: Optional[EmailStr]
    responsavel_relacao: Optional[str]
    observacoes: Optional[str]
```

### Agendamento
```python
class AgendamentoBase(BaseModel):
    paciente_id: str                # UUID
    profissional_id: str            # UUID
    sala_id: str                    # UUID
    data_agendamento: str           # YYYY-MM-DD
    horario_inicio: str             # HH:MM
    horario_fim: str                # HH:MM (deve ser > inicio)
    tipo_atendimento: str           # "Avaliação", "Acompanhamento"
    observacoes: Optional[str]

class AgendamentoResponse(AgendamentoBase):
    id: str
    clinica_id: str
    status: str                     # agendada|confirmada|concluida|cancelada|faltou
    data_criacao: datetime
    data_atualizacao: datetime
```

### Prontuário
```python
class ProntuarioBase(BaseModel):
    paciente_id: str
    profissional_id: str
    data_consulta: str              # YYYY-MM-DD
    anamnese: Optional[str]
    diagnostico: Optional[str]
    conduta: Optional[str]
    observacoes: Optional[str]
```

### Frequência
```python
class FrequenciaCreate(BaseModel):
    paciente_id: str
    profissional_id: str
    data_atendimento: str           # YYYY-MM-DD
    compareceu: bool                # true/false
    agendamento_id: Optional[str]
    observacoes: Optional[str]
```

### Usuário
```python
class UsuarioCreate(BaseModel):
    nome_completo: str
    email: EmailStr
    role: str                       # admin|recepcao|fono|medico|profissional
    ativo: bool = True
```

---

## 🛠️ Camada de Serviços

### Propósito

A camada de Serviços implementa toda a **lógica de negócio** da aplicação. Cada serviço é independente e testável.

```
Requisição HTTP
    ↓
Route (valida autenticação/autorização)
    ↓
Service (lógica de negócio, validações)
    ↓
Repository (acesso a dados)
    ↓
Banco de Dados
```

### Serviços Disponíveis

#### 1. **PacienteService** (`paciente_service.py`)

```python
class PacienteService:
    async def listar_pacientes(clinica_id, ativo=None, search=None)
    async def buscar_paciente(paciente_id, clinica_id)
    async def criar_paciente(paciente, clinica_id, criado_por)
    async def atualizar_paciente(paciente_id, paciente, clinica_id)
    async def inativar_paciente(paciente_id, clinica_id)
```

**Validações:**
- ✅ CPF único por clínica
- ✅ Email válido (se fornecido)
- ✅ Campos obrigatórios
- ✅ Soft delete (apenas marca como inativo)

---

#### 2. **AgendamentoService** (`agendamento_service.py`)

```python
class AgendamentoService:
    async def validar_conflito(clinica_id, profissional_id, sala_id, 
                               data_agendamento, horario_inicio, horario_fim)
    async def criar_agendamento(clinica_id, user_id, data)
    async def listar_agendamentos(clinica_id, filtros=None)
    async def atualizar_status(agendamento_id, novo_status)
```

**Validações:**
- ✅ Conflito de horário (mesmo profissional, mesma sala, mesma data)
- ✅ Formato de data/hora
- ✅ Horário início < fim
- ✅ Transições de status válidas
- ✅ Não permitir agendamentos no passado

**Lógica de Conflito:**
```python
# Verifica sobreposição de horários
# novo_inicio < ag_fim AND novo_fim > ag_inicio → CONFLITO
```

---

#### 3. **MensalidadeService** (`mensalidade_service.py`)

```python
class MensalidadeService:
    def listar_mensalidades(clinica_id, ativo=None)
    def buscar_mensalidade(mensalidade_id, clinica_id)
    def buscar_mensalidade_por_paciente(paciente_id, clinica_id)
    def criar_mensalidade(clinica_id, mensalidade_data, user_id)
    def registrar_pagamento(clinica_id, mensalidade_id, pagamento_data)
    def marcar_como_pago(mensalidade_id, data_pagamento, clinica_id)
```

---

#### 4. **FrequenciaService** (`frequencia_service.py`)

```python
class FrequenciaService:
    def registrar_frequencia(clinica_id, paciente_id, profissional_id, 
                            data_atendimento, compareceu, registrado_por, 
                            agendamento_id, observacoes)
    def listar_frequencia_paciente(paciente_id, clinica_id, profissional_id=None)
    def calcular_estatisticas(paciente_id, clinica_id, profissional_id=None)
```

---

#### 5. **RelatorioService** (`relatorio_service.py`)

```python
class RelatorioService:
    def listar_relatorios(clinica_id, filtros, user_role, user_id)
    def buscar_relatorio(relatorio_id, clinica_id)
    def criar_relatorio(clinica_id, usuario_id, arquivo, paciente_id)
    def deletar_relatorio(relatorio_id, clinica_id)
```

---

#### 6. **DashboardService** (`dashboard_service.py`)

```python
def get_dashboard_stats(clinica_id)
    # Retorna:
    # - total_pacientes
    # - agendamentos_hoje
    # - agendamentos_semana
    # - agendamentos por status
```

---

#### 7. **PDFService** (`pdf_service.py`)

Geração de PDFs usando ReportLab:
```python
def gerar_pdf_prontuario(prontuario_data)
def gerar_pdf_relatorio(relatorio_data)
def gerar_pdf_agendamentos(agendamentos_data)
```

---

## 🔄 Fluxo de Dados Frontend-Backend

### Exemplo 1: Login

```javascript
// Frontend (pacienteService.js ou form)
const login = async (email, password) => {
  const response = await api.post('/auth/login', {
    email,
    password
  });
  
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  return response;
};
```

```json
Requisição:
POST /auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "fono@example.com",
  "password": "senha123"
}

Resposta:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-usuario",
    "email": "fono@example.com",
    "clinica_id": "uuid-clinica",
    "role": "fono",
    "nome_completo": "Fonoaudiólogo"
  }
}
```

### Exemplo 2: Criar Paciente

```javascript
// Frontend (pacienteService.js)
const create = async (paciente) => {
  return api.post('/pacientes', paciente);
};

// Uso:
const novoPaciente = await pacienteService.create({
  nome_completo: "João Silva",
  cpf: "123.456.789-00",
  email: "joao@example.com",
  telefone_principal: "(11) 98765-4321"
});
```

```python
# Backend (routes/paciente_routes.py)
@paciente_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def create_paciente():
    user = get_current_user()              # Extrai token do header
    clinica_id = user['clinica_id']
    
    data = request.get_json()              # Recebe dados da requisição
    
    if not data.get('nome_completo'):
        return jsonify({'error': 'Campo nome_completo é obrigatório'}), 400
    
    repo = BaseRepository('pacientes', clinica_id)
    
    if data.get('cpf'):
        if repo.check_cpf_exists(data['cpf']):
            return jsonify({'error': 'CPF já cadastrado nesta clínica'}), 409
    
    data['ativo'] = data.get('ativo', True)
    
    paciente = repo.create(data)            # Salva no BD
    
    return jsonify(paciente), 201           # Retorna paciente criado
```

```
Requisição:
POST /pacientes HTTP/1.1
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "nome_completo": "João Silva",
  "cpf": "123.456.789-00",
  "email": "joao@example.com",
  "telefone_principal": "(11) 98765-4321"
}

Resposta (201):
{
  "id": "uuid-gerado",
  "clinica_id": "uuid-clinica",
  "nome_completo": "João Silva",
  "cpf": "123.456.789-00",
  "email": "joao@example.com",
  "telefone_principal": "(11) 98765-4321",
  "ativo": true,
  "created_at": "2026-03-02T10:30:00Z"
}
```

### Exemplo 3: Listar Agendamentos com Filtros

```javascript
// Frontend
const getAgendamentos = async (filtros) => {
  return api.get('/agendamentos', { 
    params: filtros 
  });
};

// Uso:
const agendamentos = await agendamentoService.getAll({
  data_inicio: '2026-03-01',
  data_fim: '2026-03-31',
  profissional_id: 'uuid-prof',
  status: 'agendada'
});
```

```python
# Backend
@agendamento_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_agendamentos():
    user = get_current_user()
    clinica_id = user['clinica_id']
    
    # Parse query params
    paciente_id = request.args.get('paciente_id')
    profissional_id = request.args.get('profissional_id')
    status = request.args.get('status')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    
    filters = {}
    if paciente_id:
        filters['paciente_id'] = paciente_id
    if profissional_id:
        filters['profissional_id'] = profissional_id
    if status:
        filters['status'] = status
    
    repo = BaseRepository('agendamentos', clinica_id)
    agendamentos = repo.get_all(filters=filters, order_by='data_agendamento')
    
    # Filtro de data no Python (se especificado)
    if not (filters and filters.get('data_agendamento')):
        if data_inicio:
            agendamentos = [a for a in agendamentos 
                           if a.get('data_agendamento', '') >= data_inicio]
        if data_fim:
            agendamentos = [a for a in agendamentos 
                           if a.get('data_agendamento', '') <= data_fim]
    
    return jsonify(agendamentos), 200
```

---

## 💾 Acesso ao Banco de Dados

### Arquitetura de Data Access

```
Routes (Controller)
    ↓
Services (Business Logic)
    ↓
BaseRepository (Data Access)
    ↓
Supabase Client (SDK)
    ↓
PostgreSQL (RLS Policy)
    ↓
Database
```

### BaseRepository (`repositories/base_repository.py`)

Repository genérica que implementa **CRUD** e multi-tenant automático:

```python
class BaseRepository:
    def __init__(self, table_name, clinica_id):
        self.client = get_supabase_client()
        self.table_name = table_name
        self.clinica_id = clinica_id  # Auto-filtro
    
    def create(data)          # INSERT + clinica_id automático
    def get_by_id(id)         # SELECT * WHERE id = ? AND clinica_id = ?
    def get_all(filters, ...)  # SELECT * WHERE clinica_id = ? AND filters
    def update(id, data)      # UPDATE WHERE id = ? AND clinica_id = ?
    def delete(id)            # DELETE WHERE id = ? AND clinica_id = ?
    def count(filters)        # COUNT(*) WHERE clinica_id = ? AND filters
```

### Otimizações com RPC Functions

Para queries complexas, o Supabase oferece RPC Functions (PostgreSQL Functions):

```python
# BaseRepository detecta e usa automaticamente
function_map = {
    'pacientes': 'get_pacientes',
    'agendamentos': 'get_agendamentos',
    'prontuarios': 'get_prontuarios',
    'usuarios': 'get_usuarios',
    'salas': 'get_salas'
}

# Uso automático:
agendamentos = repo.get_all(filters={'status': 'agendada'})
# Chama RPC 'get_agendamentos' internamente
```

### Exemplo de Find/Search

```python
# Busca por CPF (com busca genérica)
search = "123.456"

pacientes = [p for p in pacientes
            if search.lower() in p.get('cpf', '').lower() or
               search.lower() in p.get('nome_completo', '').lower()]

# Usando Supabase .or_() para queries avançadas:
client.table('pacientes').select('*')\
    .eq('clinica_id', clinica_id)\
    .or_(f"nome_completo.ilike.%{search}%,"
         f"cpf.ilike.%{search}%,"
         f"email.ilike.%{search}%")\
    .execute()
```

### Multi-tenant com clinica_id

Todas as tabelas possuem:
```sql
- clinica_id UUID NOT NULL  -- FK para clinicas table
- RLS Policies que filtram por clinica_id automaticamente
```

**Garantias:**
- ✅ Usuário só vê dados de sua clínica
- ✅ Isolamento automático no banco
- ✅ BaseRepository força clinica_id em todas operations

---

## 📦 Dependências e Configurações

### Backend Python

**File:** `requirements.txt`

```
Flask==3.0.0                   # Web Framework
Flask-CORS==4.0.0              # CORS support
python-dotenv==1.0.0           # .env loading
supabase==1.0.4                # Supabase SDK
httpx==0.23.3                  # HTTP client (Supabase dependency)
postgrest==0.10.8              # PostgreSQL client (Supabase)
gotrue==1.0.4                  # Auth client (Supabase)
realtime==1.0.0                # Realtime client (Supabase)
storage3==0.5.4                # Storage client (Supabase)
Werkzeug==3.0.1                # WSGI utilities
PyJWT==2.8.0                   # JWT token creation/validation
requests==2.31.0               # HTTP requests
gunicorn==21.2.0               # WSGI HTTP server
reportlab==4.0.7               # PDF generation
```

### Configuração (config.py)

```python
class Config:
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    
    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
    
    # Frontend
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Files
    ALLOWED_FILE_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx']
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
```

**Variáveis de Ambiente Obrigatórias:**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
SECRET_KEY=your-flask-secret-key
```

### Frontend (package.json)

```json
{
  "name": "fonoflow-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "tailwindcss": "^3.0.0"
  }
}
```

**Variáveis de Ambiente Frontend:**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 🔒 Middleware de Segurança

### 1. JWT Authentication Decorator

```python
@require_auth
def minha_rota():
    user = get_current_user()
    # user contém: user_id, email, clinica_id, role, exp, iat
```

**Fluxo:**
1. Extrai token do header `Authorization: Bearer <token>`
2. Decodifica JWT usando `SECRET_KEY`
3. Valida expiração (7 dias)
4. Injeta `request.user` com payload
5. Se inválido, retorna 401

### 2. Role-based Authorization

```python
@require_roles(['admin', 'recepcao'])
def criar_usuario():
    # Apenas admin e recepcao podem acessar
```

**Fluxo:**
1. Valida presença de token (@require_auth)
2. Extrai role do token
3. Verifica se role está na lista permitida
4. Se não, retorna 403 Forbidden

### 3. Multi-tenant Isolation

```python
user = get_current_user()
clinica_id = user['clinica_id']

repo = BaseRepository('pacientes', clinica_id)
# Automaticamente filtra por clinica_id
```

**Garantias:**
- ✅ Cada usuário só pode acessar dados de sua clínica
- ✅ clinica_id forçado em todas as operações
- ✅ Row Level Security (RLS) no banco como segunda camada

### 4. CORS Configuration

```python
CORS(app, 
     origins=CORS_ORIGINS.split(','),
     supports_credentials=True)
```

Permite requisições apenas de origens configuradas.

### 5. Request Validation

```python
from pydantic import BaseModel, EmailStr, ValidationError

class PacienteCreate(BaseModel):
    nome_completo: str          # Obrigatório
    email: Optional[EmailStr]   # Valida email
    cpf: Optional[str]          # Opcional
```

Pydantic valida todos os requests automaticamente.

### 6. Error Handling

```python
@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad Request', 'message': str(error)}), 400

@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized', 'message': 'Token inválido'}), 401

@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden', 'message': 'Sem permissão'}), 403
```

---

## 📝 Exemplo Completo: Criar Agendamento

### Frontend (React + Next.js)

```javascript
// src/services/agendamentoService.js
export const agendamentoService = {
  async create(agendamento) {
    return api.post('/agendamentos', agendamento);
  }
};

// Uso em componente:
const handleCriarAgendamento = async (formData) => {
  try {
    const novoAgendamento = await agendamentoService.create({
      paciente_id: formData.pacienteId,
      profissional_id: formData.profissionalId,
      sala_id: formData.salaId,
      data_agendamento: '2026-03-15',
      horario_inicio: '09:00',
      horario_fim: '10:00',
      tipo_atendimento: 'Avaliação',
      observacoes: 'Primeira consulta'
    });
    
    console.log('Agendamento criado:', novoAgendamento);
    // Atualizar UI
  } catch (error) {
    console.error('Erro:', error.message);
  }
};
```

### HTTP Request

```
POST /agendamentos HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "paciente_id": "550e8400-e29b-41d4-a716-446655440000",
  "profissional_id": "550e8400-e29b-41d4-a716-446655440001",
  "sala_id": "550e8400-e29b-41d4-a716-446655440002",
  "data_agendamento": "2026-03-15",
  "horario_inicio": "09:00",
  "horario_fim": "10:00",
  "tipo_atendimento": "Avaliação",
  "observacoes": "Primeira consulta"
}
```

### Backend (Flask)

```python
# app/routes/agendamento_routes.py
@agendamento_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def create_agendamento():
    """Cria novo agendamento validando conflitos"""
    try:
        # 1. Extrai dados do usuário autenticado
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['id']
        
        # 2. Recebe e valida JSON
        data = request.get_json()
        
        # 3. Valida campos obrigatórios
        required_fields = ['paciente_id', 'profissional_id', 
                          'sala_id', 'data_agendamento', 
                          'horario_inicio', 'horario_fim']
        
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} obrigatório'}), 400
        
        # 4. Instancia service
        service = AgendamentoService()
        
        # 5. Service valida conflitos
        tem_conflito = await service.validar_conflito(
            clinica_id=clinica_id,
            profissional_id=data['profissional_id'],
            sala_id=data['sala_id'],
            data_agendamento=data['data_agendamento'],
            horario_inicio=data['horario_inicio'],
            horario_fim=data['horario_fim']
        )
        
        if tem_conflito:
            return jsonify({
                'error': 'Conflito de horário',
                'message': 'Profissional já tem agendamento neste horário'
            }), 409
        
        # 6. Service cria agendamento
        agendamento_data = AgendamentoCreate(**data)
        agendamento = await service.criar_agendamento(
            clinica_id=clinica_id,
            user_id=user_id,
            data=agendamento_data
        )
        
        # 7. Retorna agendamento criado
        return jsonify(agendamento), 201
        
    except ValidationException as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Erro ao criar agendamento: {str(e)}")
        return jsonify({'error': 'Erro no servidor'}), 500


# app/services/agendamento_service.py
class AgendamentoService:
    async def validar_conflito(self, clinica_id, profissional_id, 
                               sala_id, data_agendamento, 
                               horario_inicio, horario_fim):
        """Verifica se há conflito de horário"""
        client = get_supabase_client()
        
        # Query agendamentos existentes
        response = client.table('agendamentos')\
            .select('*')\
            .eq('clinica_id', clinica_id)\
            .eq('profissional_id', profissional_id)\
            .eq('data_agendamento', data_agendamento)\
            .neq('status', 'cancelada')\
            .execute()
        
        agendamentos = response.data or []
        
        # Verifica sobreposição
        for ag in agendamentos:
            ag_inicio = ag['horario_inicio']  # "09:00"
            ag_fim = ag['horario_fim']        # "10:00"
            
            # Converte para minutos
            novo_inicio = int(horario_inicio.split(':')[0]) * 60 + \
                         int(horario_inicio.split(':')[1])
            novo_fim = int(horario_fim.split(':')[0]) * 60 + \
                      int(horario_fim.split(':')[1])
            
            ag_inicio_min = int(ag_inicio.split(':')[0]) * 60 + \
                           int(ag_inicio.split(':')[1])
            ag_fim_min = int(ag_fim.split(':')[0]) * 60 + \
                        int(ag_fim.split(':')[1])
            
            # Lógica de overlap: novo_inicio < ag_fim AND novo_fim > ag_inicio
            if novo_inicio < ag_fim_min and novo_fim > ag_inicio_min:
                return True  # Conflito encontrado
        
        return False  # Sem conflitos


# app/repositories/base_repository.py
class BaseRepository:
    def create(self, data):
        """Cria novo registro com clinica_id automático"""
        data['clinica_id'] = self.clinica_id
        
        response = self.client.table(self.table_name).insert(data).execute()
        
        return response.data[0] if response.data else data
```

### HTTP Response

```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "clinica_id": "550e8400-e29b-41d4-a716-11111111",
  "paciente_id": "550e8400-e29b-41d4-a716-446655440000",
  "profissional_id": "550e8400-e29b-41d4-a716-446655440001",
  "sala_id": "550e8400-e29b-41d4-a716-446655440002",
  "data_agendamento": "2026-03-15",
  "horario_inicio": "09:00",
  "horario_fim": "10:00",
  "tipo_atendimento": "Avaliação",
  "observacoes": "Primeira consulta",
  "status": "agendada",
  "created_at": "2026-03-02T15:30:00Z",
  "updated_at": "2026-03-02T15:30:00Z"
}
```

---

## 🔗 Relações Entre Entidades

```
Clinica
├── Usuarios (profissionais/admin/recepcao)
├── Pacientes
│   ├── Prontuarios
│   ├── Agendamentos
│   ├── Frequencia (registro de comparecimento)
│   ├── Mensalidades (pagamentos)
│   └── Relatorios (documentos)
├── Sala
└── Agendamentos (agenda da clínica)

Pacientes ↔ Profissionais (relação muitos-para-muitos)
```

---

## 📊 Health Check

```
GET /health

Response:
{
  "status": "ok",
  "environment": "development",
  "version": "1.0.0"
}
```

---

## 🚀 Deployment

### Backend (Vercel/Heroku)

**Arquivo:** `Procfile`
```
web: gunicorn -w 4 -b 0.0.0.0:$PORT backend.app:create_app()
```

**Arquivo:** `runtime.txt`
```
python-3.11.0
```

**Arquivo:** `vercel.json`
```json
{
  "buildCommand": "pip install -r backend/requirements.txt",
  "outputDirectory": "backend/",
  "framework": "flask"
}
```

### Frontend (Vercel)

Deploy automático ao fazer push para a branch principal.

---

## 📚 Referências Adicionais

Ver documentação específica em:
- [docs/RELACAO_PACIENTE_PROFISSIONAL.md](docs/RELACAO_PACIENTE_PROFISSIONAL.md) - Gerenciamento de relações
- [docs/RELATORIOS_UPLOAD.md](docs/RELATORIOS_UPLOAD.md) - Sistema de upload de relatórios
- [supabase/SCHEMA_DOCUMENTATION.md](supabase/SCHEMA_DOCUMENTATION.md) - Schema do banco de dados

---

**Versão:** 1.0.0  
**Última atualização:** 2 de Março de 2026  
**Autor:** Documentação Técnica Automática
