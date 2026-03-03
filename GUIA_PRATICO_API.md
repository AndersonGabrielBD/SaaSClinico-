# SaaSClinico - Guia Prático de API

**Versão:** 1.0.0  
**Data:** 2 de Março de 2026

---

## 📌 Índice

1. [Autenticação - Exemplos](#autenticação---exemplos)
2. [Pacientes - Operações Completas](#pacientes---operações-completas)
3. [Agendamentos - Casos de Uso](#agendamentos---casos-de-uso)
4. [Prontuários - CRUD](#prontuários---crud)
5. [Frequência - Registros](#frequência---registros)
6. [Mensalidades - Pagamentos](#mensalidades---pagamentos)
7. [Dashboard - Relatórios](#dashboard---relatórios)
8. [Filtros e Buscas](#filtros-e-buscas)
9. [Tratamento de Erros](#tratamento-de-erros)

---

## 🔐 Autenticação - Exemplos

### 1. Login (Obter Token)

```bash
# cURL
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fono@example.com",
    "password": "senha123"
  }'
```

```javascript
// JavaScript/Frontend
async function login(email, password) {
  const response = await fetch('http://localhost:5000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    // Armazenar token
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  } else {
    throw new Error(data.error || 'Erro no login');
  }
}

// Uso
const { token, user } = await login('fono@example.com', 'senha123');
console.log('Logado como:', user.nome_completo);
console.log('Clínica:', user.clinica_id);
console.log('Role:', user.role);
```

**Resposta (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2QzN2Y5YmEtNzJmMy00ZWM4LTk1M2UtNzQ5YmYwNjU3YTQ3IiwiZW1haWwiOiJmb25vQGV4YW1wbGUuY29tIiwiY2xpbmljYV9pZCI6ImMxZTY4NGJhLWEyZjItNDFlOC05ZTk5LWU4YTY2ZjQxMGM0YyIsInJvbGUiOiJmb25vIiwiZXhwIjoxNzA0MDY3MjAwLCJpYXQiOjE3MDM0NjI0MDB9.R2Zxz5Kv0...",
  "user": {
    "id": "cd37f9ba-72f3-4ec8-953e-749bf06557a47",
    "email": "fono@example.com",
    "clinica_id": "c1e684ba-a2f2-41e8-9e99-e8a66f410c4c",
    "role": "fono",
    "nome_completo": "Maria Silva"
  }
}
```

### 2. Signup (Registrar Novo Usuário)

```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@nova-clinica.com",
    "password": "senha-forte-123",
    "nome": "João Silva",
    "clinica_nome": "Clínica Fono Silva"
  }'
```

**Resposta (201 Created):**
```json
{
  "user": {
    "id": "novo-uuid",
    "email": "admin@nova-clinica.com",
    "clinica_id": "clinica-uuid",
    "role": "admin",
    "nome_completo": "João Silva"
  }
}
```

### 3. Usar Token em Requisições

```javascript
// Helper para adicionar token automaticamente
const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };
    
    const response = await fetch(`http://localhost:5000${endpoint}`, config);
    
    // Se 401, token expirou
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return response.json();
  },
  
  get: (endpoint, options) => this.request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, data, options) => this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data, options) => this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) })
};
```

---

## 👥 Pacientes - Operações Completas

### 1. Listar Todos os Pacientes

```bash
# Sem filtros
curl -X GET http://localhost:5000/pacientes \
  -H "Authorization: Bearer TOKEN"

# Com filtros
curl -X GET "http://localhost:5000/pacientes?search=João&ativo=true" \
  -H "Authorization: Bearer TOKEN"
```

```javascript
// Frontend
async function listarPacientes(search = '', ativo = null) {
  const params = new URLSearchParams();
  
  if (search) params.append('search', search);
  if (ativo !== null) params.append('ativo', ativo);
  
  return api.get(`/pacientes?${params.toString()}`);
}

// Uso
const todos = await listarPacientes();
const ativos = await listarPacientes('', true);
const resultado = await listarPacientes('João');
```

**Resposta:**
```json
[
  {
    "id": "uuid-1",
    "clinica_id": "uuid-clinica",
    "nome_completo": "João Silva",
    "cpf": "123.456.789-00",
    "email": "joao@example.com",
    "telefone_principal": "(11) 98765-4321",
    "endereco": "Rua A, 123",
    "cidade": "São Paulo",
    "estado": "SP",
    "ativo": true,
    "created_at": "2026-01-15T10:30:00Z"
  },
  ...
]
```

### 2. Buscar Paciente Específico

```bash
curl -X GET http://localhost:5000/pacientes/uuid-1 \
  -H "Authorization: Bearer TOKEN"
```

```javascript
const paciente = await api.get('/pacientes/uuid-1');
console.log(paciente);
```

### 3. Criar Novo Paciente

```bash
curl -X POST http://localhost:5000/pacientes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_completo": "Maria Santos",
    "cpf": "987.654.321-00",
    "data_nascimento": "1990-05-15",
    "genero": "F",
    "email": "maria@example.com",
    "telefone_principal": "(11) 91234-5678",
    "endereco": "Rua B, 456",
    "numero": "456",
    "cidade": "São Paulo",
    "estado": "SP",
    "cep": "01234-567",
    "responsavel_nome": "João Santos",
    "responsavel_telefone": "(11) 98765-4321",
    "observacoes": "Paciente com histórico de gagueira"
  }'
```

```javascript
// Frontend
async function criarPaciente(dados) {
  return api.post('/pacientes', {
    nome_completo: dados.nome,
    cpf: dados.cpf,
    data_nascimento: dados.dataNascimento,
    genero: dados.genero,
    email: dados.email,
    telefone_principal: dados.telefone,
    endereco: dados.endereco,
    numero: dados.numero,
    cidade: dados.cidade,
    estado: dados.estado,
    cep: dados.cep,
    responsavel_nome: dados.responsavelNome,
    responsavel_telefone: dados.responsavelTelefone,
    observacoes: dados.observacoes
  });
}

// Uso
const novoPaciente = await criarPaciente({
  nome: 'Maria Santos',
  cpf: '987.654.321-00',
  dataNascimento: '1990-05-15',
  genero: 'F',
  email: 'maria@example.com',
  telefone: '(11) 91234-5678',
  endereco: 'Rua B',
  numero: '456',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01234-567',
  responsavelNome: 'João Santos',
  responsavelTelefone: '(11) 98765-4321',
  observacoes: 'Histórico de gagueira'
});

console.log('Paciente criado:', novoPaciente.id);
```

**Resposta (201 Created):**
```json
{
  "id": "novo-uuid",
  "clinica_id": "uuid-clinica",
  "nome_completo": "Maria Santos",
  "cpf": "987.654.321-00",
  "email": "maria@example.com",
  "telefone_principal": "(11) 91234-5678",
  "ativo": true,
  "created_at": "2026-03-02T15:30:00Z"
}
```

### 4. Atualizar Paciente

```bash
curl -X PUT http://localhost:5000/pacientes/uuid-1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telefone_principal": "(11) 99999-8888",
    "observacoes": "Atualizado em março"
  }'
```

```javascript
// Atualizar alguns campos
const pacienteAtualizado = await api.put('/pacientes/uuid-1', {
  telefone_principal: '(11) 99999-8888',
  observacoes: 'Atualizado em março'
});
```

### 5. Desativar Paciente

```bash
curl -X DELETE http://localhost:5000/pacientes/uuid-1 \
  -H "Authorization: Bearer TOKEN"
```

```javascript
// Desativa (soft delete)
await api.delete('/pacientes/uuid-1');

// Ou via PUT (reativar)
await api.put('/pacientes/uuid-1', { ativo: true });
```

---

## 📅 Agendamentos - Casos de Uso

### 1. Listar Agendamentos do Mês

```bash
# Todos os agendamentos (com filtro de data)
curl -X GET "http://localhost:5000/agendamentos?data_inicio=2026-03-01&data_fim=2026-03-31" \
  -H "Authorization: Bearer TOKEN"

# De um paciente específico
curl -X GET "http://localhost:5000/agendamentos?paciente_id=uuid" \
  -H "Authorization: Bearer TOKEN"

# De um profissional
curl -X GET "http://localhost:5000/agendamentos?profissional_id=uuid" \
  -H "Authorization: Bearer TOKEN"

# Com status
curl -X GET "http://localhost:5000/agendamentos?status=agendada" \
  -H "Authorization: Bearer TOKEN"
```

```javascript
// Frontend
async function listarAgendamentosMes(ano, mes) {
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-31`;
  
  return api.get('/agendamentos', {
    params: { data_inicio: dataInicio, data_fim: dataFim }
  });
}

async function agendamentosPaciente(pacienteId) {
  return api.get('/agendamentos', {
    params: { paciente_id: pacienteId }
  });
}

// Uso
const março = await listarAgendamentosMes(2026, 3);
const agendamentosJoao = await agendamentosPaciente('uuid-joao');
```

### 2. Criar Agendamento (Com Validação de Conflito)

```bash
curl -X POST http://localhost:5000/agendamentos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paciente_id": "uuid-paciente",
    "profissional_id": "uuid-fono",
    "sala_id": "uuid-sala",
    "data_agendamento": "2026-03-15",
    "horario_inicio": "09:00",
    "horario_fim": "10:00",
    "tipo_atendimento": "Avaliação",
    "observacoes": "Primeira consulta"
  }'
```

```javascript
async function criarAgendamento(dados) {
  try {
    const agendamento = await api.post('/agendamentos', {
      paciente_id: dados.pacienteId,
      profissional_id: dados.profissionalId,
      sala_id: dados.salaId,
      data_agendamento: dados.data,  // "2026-03-15"
      horario_inicio: dados.horaInicio,  // "09:00"
      horario_fim: dados.horaFim,  // "10:00"
      tipo_atendimento: dados.tipo || 'Avaliação',
      observacoes: dados.observacoes
    });
    
    return agendamento;
  } catch (error) {
    // Se retorna 409: conflito de horário
    if (error.message.includes('Conflito')) {
      throw new Error('Horário indisponível. Escolha outro horário.');
    }
    throw error;
  }
}

// Uso
try {
  const novo = await criarAgendamento({
    pacienteId: 'uuid-joao',
    profissionalId: 'uuid-fono-1',
    salaId: 'uuid-sala-a',
    data: '2026-03-15',
    horaInicio: '09:00',
    horaFim: '10:00'
  });
  
  console.log('✅ Agendamento criado:', novo.id);
} catch (error) {
  console.error('❌ Erro:', error.message);
}
```

**Resposta (201):**
```json
{
  "id": "uuid-agendamento",
  "clinica_id": "uuid-clinica",
  "paciente_id": "uuid-paciente",
  "profissional_id": "uuid-fono",
  "sala_id": "uuid-sala",
  "data_agendamento": "2026-03-15",
  "horario_inicio": "09:00",
  "horario_fim": "10:00",
  "tipo_atendimento": "Avaliação",
  "status": "agendada",
  "created_at": "2026-03-02T15:30:00Z"
}
```

**Erro (409 Conflito):**
```json
{
  "error": "Conflito de horário",
  "message": "Profissional já tem agendamento neste horário"
}
```

### 3. Confirmar Agendamento

```bash
curl -X PUT http://localhost:5000/agendamentos/uuid-1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmada"}'
```

```javascript
async function confirmarAgendamento(agendamentoId) {
  return api.put(`/agendamentos/${agendamentoId}`, {
    status: 'confirmada'
  });
}

// Uso
const confirmado = await confirmarAgendamento('uuid-agendamento');
console.log('Status:', confirmado.status);  // "confirmada"
```

### 4. Marcar Agendamento como Concluído

```bash
curl -X PUT http://localhost:5000/agendamentos/uuid-1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "concluida"}'
```

```javascript
async function concluirAgendamento(agendamentoId) {
  return api.put(`/agendamentos/${agendamentoId}`, {
    status: 'concluida'
  });
}
```

### 5. Cancelar Agendamento

```bash
curl -X PUT http://localhost:5000/agendamentos/uuid-1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "cancelada"}'
```

```javascript
async function cancelarAgendamento(agendamentoId) {
  return api.put(`/agendamentos/${agendamentoId}`, {
    status: 'cancelada'
  });
}
```

### 6. Marcar como "Faltou"

```javascript
async function marcarFaltou(agendamentoId) {
  return api.put(`/agendamentos/${agendamentoId}`, {
    status: 'faltou'
  });
}
```

---

## 📝 Prontuários - CRUD

### 1. Listar Prontuários de um Paciente

```bash
curl -X GET "http://localhost:5000/prontuarios?paciente_id=uuid" \
  -H "Authorization: Bearer TOKEN"
```

```javascript
async function prontuariosPaciente(pacienteId) {
  return api.get('/prontuarios', {
    params: { paciente_id: pacienteId }
  });
}

const prontuarios = await prontuariosPaciente('uuid-joao');
console.log('Total de prontuários:', prontuarios.length);
```

### 2. Criar Prontuário

```bash
curl -X POST http://localhost:5000/prontuarios \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paciente_id": "uuid-paciente",
    "data_consulta": "2026-03-15",
    "anamnese": "Paciente relata dificuldade na articulação de sons...",
    "diagnostico": "Desvio fonológico",
    "conduta": "Terapia de linguagem, 2x/semana",
    "observacoes": "Paciente motivado, família engajada"
  }'
```

```javascript
async function criarProntuario(dados) {
  return api.post('/prontuarios', {
    paciente_id: dados.pacienteId,
    data_consulta: dados.data,  // "2026-03-15"
    anamnese: dados.anamnese,
    diagnostico: dados.diagnostico,
    conduta: dados.conduta,
    observacoes: dados.observacoes
  });
}

// Uso
const novo = await criarProntuario({
  pacienteId: 'uuid-joao',
  data: '2026-03-15',
  anamnese: 'Paciente relata dificuldade...',
  diagnostico: 'Desvio fonológico',
  conduta: 'Terapia 2x/semana',
  observacoes: 'Paciente motivado'
});
```

### 3. Atualizar Prontuário

```bash
curl -X PUT http://localhost:5000/prontuarios/uuid-1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conduta": "Terapia de linguagem, agora 3x/semana"
  }'
```

```javascript
async function atualizarProntuario(prontuarioId, dados) {
  return api.put(`/prontuarios/${prontuarioId}`, dados);
}

// Uso
const atualizado = await atualizarProntuario('uuid-prontuario', {
  conduta: 'Terapia 3x/semana'
});
```

---

## 📊 Frequência - Registros

### 1. Registrar Frequência (Presença)

```bash
curl -X POST http://localhost:5000/frequencia \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paciente_id": "uuid-paciente",
    "profissional_id": "uuid-fono",
    "data_atendimento": "2026-03-15",
    "compareceu": true,
    "agendamento_id": "uuid-agendamento",
    "observacoes": "Paciente progredindo bem"
  }'
```

```javascript
async function registrarFrequencia(dados) {
  return api.post('/frequencia', {
    paciente_id: dados.pacienteId,
    profissional_id: dados.profissionalId,
    data_atendimento: dados.data,
    compareceu: dados.compareceu,  // true ou false
    agendamento_id: dados.agendamentoId,
    observacoes: dados.observacoes
  });
}

// Uso
// Paciente compareceu
const freq1 = await registrarFrequencia({
  pacienteId: 'uuid-joao',
  profissionalId: 'uuid-fono-1',
  data: '2026-03-15',
  compareceu: true,
  agendamentoId: 'uuid-agendamento',
  observacoes: 'Paciente progredindo bem'
});

// Paciente faltou
const freq2 = await registrarFrequencia({
  pacienteId: 'uuid-joao',
  profissionalId: 'uuid-fono-1',
  data: '2026-03-22',
  compareceu: false,
  observacoes: 'Chuva, paciente não conseguiu sair de casa'
});
```

**Resposta (201):**
```json
{
  "id": "uuid-frequencia",
  "paciente_id": "uuid-paciente",
  "profissional_id": "uuid-fono",
  "data_atendimento": "2026-03-15",
  "compareceu": true,
  "agendamento_id": "uuid-agendamento",
  "observacoes": "Paciente progredindo bem",
  "created_at": "2026-03-15T10:30:00Z"
}
```

### 2. Listar Frequência do Paciente

```bash
curl -X GET "http://localhost:5000/frequencia/paciente/uuid-paciente" \
  -H "Authorization: Bearer TOKEN"
```

```javascript
async function frequenciaPaciente(pacienteId) {
  return api.get(`/frequencia/paciente/${pacienteId}`);
}

const historico = await frequenciaPaciente('uuid-joao');
console.log('Total de registros:', historico.length);

// Filtrar por profissional
const semFiltro = await api.get(`/frequencia/paciente/uuid-joao`, {
  params: { profissional_id: 'uuid-fono-1' }
});
```

### 3. Obter Estatísticas de Frequência

```bash
curl -X GET "http://localhost:5000/frequencia/paciente/uuid-paciente/estatisticas" \
  -H "Authorization: Bearer TOKEN"
```

```javascript
async function estatisticasFrequencia(pacienteId, profissionalId = null) {
  const params = {};
  if (profissionalId) params.profissional_id = profissionalId;
  
  return api.get(`/frequencia/paciente/${pacienteId}/estatisticas`, { params });
}

const stats = await estatisticasFrequencia('uuid-joao');
console.log('Total de atendimentos:', stats.total_agendamentos);
console.log('Compareceu:', stats.compareceu);
console.log('Faltou:', stats.nao_compareceu);
console.log('Taxa de frequência:', stats.taxa_frequencia);  // ex: 80%
```

**Resposta:**
```json
{
  "paciente_id": "uuid-paciente",
  "total_agendamentos": 10,
  "compareceu": 8,
  "nao_compareceu": 2,
  "taxa_frequencia": "80%"
}
```

---

## 💰 Mensalidades - Pagamentos

### 1. Criar Mensalidade para Paciente

```bash
curl -X POST http://localhost:5000/mensalidades \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paciente_id": "uuid-paciente",
    "valor_mensal": 150.00,
    "data_vencimento": "15",
    "ativa": true
  }'
```

```javascript
async function criarMensalidade(pacienteId, valorMensal, diaVencimento = '15') {
  return api.post('/mensalidades', {
    paciente_id: pacienteId,
    valor_mensal: valorMensal,
    data_vencimento: diaVencimento,
    ativa: true
  });
}

// Uso
const mens = await criarMensalidade('uuid-joao', 150.00, '15');
console.log('Mensalidade criada:', mens.id);
```

### 2. Buscar Mensalidade do Paciente

```bash
curl -X GET "http://localhost:5000/mensalidades/paciente/uuid-paciente" \
  -H "Authorization: Bearer TOKEN"
```

```javascript
async function mensalidadePaciente(pacienteId) {
  return api.get(`/mensalidades/paciente/${pacienteId}`);
}

const mensalidade = await mensalidadePaciente('uuid-joao');
console.log('Valor mensal:', mensalidade.valor_mensal);
console.log('Status:', mensalidade.status);  // ativa, paga, vencida
```

### 3. Registrar Pagamento

```bash
curl -X POST http://localhost:5000/mensalidades/uuid-mensalidade/pagamentos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data_pagamento": "2026-03-15",
    "valor": 150.00,
    "metodo": "PIX"
  }'
```

```javascript
async function registrarPagamento(mensalidadeId, data, valor, metodo) {
  return api.post(`/mensalidades/${mensalidadeId}/pagamentos`, {
    data_pagamento: data,
    valor: valor,
    metodo: metodo  // PIX, Dinheiro, Cartão, Transferência
  });
}

// Uso
const pagto = await registrarPagamento('uuid-mensalidade', '2026-03-15', 150.00, 'PIX');
console.log('Pagamento registrado:', pagto.id);
```

### 4. Marcar Mensalidade como Paga

```bash
curl -X PUT http://localhost:5000/mensalidades/uuid-mensalidade \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "paga"}'
```

```javascript
async function marcarComoPago(mensalidadeId) {
  return api.put(`/mensalidades/${mensalidadeId}`, {
    status: 'paga'
  });
}
```

---

## 📊 Dashboard - Relatórios

### 1. Obter Estatísticas do Dashboard

```bash
curl -X GET http://localhost:5000/dashboard/stats \
  -H "Authorization: Bearer TOKEN"
```

```javascript
async function obterStats() {
  return api.get('/dashboard/stats');
}

const stats = await obterStats();
console.log('Pacientes ativos:', stats.total_pacientes);
console.log('Agendamentos hoje:', stats.agendamentos_hoje);
console.log('Agendamentos semana:', stats.agendamentos_semana);
console.log('Por status:', stats.agendamentos);
```

**Resposta:**
```json
{
  "total_pacientes": 45,
  "agendamentos_hoje": 8,
  "agendamentos_semana": 32,
  "agendamentos": {
    "total": 150,
    "agendados": 45,
    "confirmados": 52,
    "concluidos": 40,
    "cancelados": 13
  }
}
```

### 2. Atividades Recentes

```bash
curl -X GET http://localhost:5000/dashboard/recent \
  -H "Authorization: Bearer TOKEN"
```

```javascript
async function atividadesRecentes() {
  return api.get('/dashboard/recent');
}

const atividades = await atividadesRecentes();
console.log('Últimos agendamentos:', atividades.agendamentos);
console.log('Últimos pacientes:', atividades.pacientes);
```

---

## 🔍 Filtros e Buscas

### 1. Busca por Texto (Search)

```javascript
// Busca em qualquer campo (nome, email, cpf, telefone)
const resultados = await api.get('/pacientes', {
  params: { search: 'João' }
});

const resultados2 = await api.get('/pacientes', {
  params: { search: '123.456' }  // Por CPF
});
```

### 2. Filtros Booleanos

```javascript
// Apenas pacientes ativos
const ativos = await api.get('/pacientes', {
  params: { ativo: 'true' }
});

// Apenas inativos
const inativos = await api.get('/pacientes', {
  params: { ativo: 'false' }
});

// Combinar filtros
const resultado = await api.get('/pacientes', {
  params: { 
    search: 'João',
    ativo: 'true'
  }
});
```

### 3. Filtros de Data

```javascript
// Agendamentos de um período
const agendamentos = await api.get('/agendamentos', {
  params: { 
    data_inicio: '2026-03-01',
    data_fim: '2026-03-31'
  }
});

// Agendamentos de uma data específica
const hoje = await api.get('/agendamentos', {
  params: { data_agendamento: '2026-03-02' }
});
```

### 4. Filtros Múltiplos

```javascript
// Combinar vários filtros
const filtrados = await api.get('/agendamentos', {
  params: {
    paciente_id: 'uuid-joao',
    profissional_id: 'uuid-fono-1',
    status: 'agendada',
    data_inicio: '2026-03-01',
    data_fim: '2026-03-31'
  }
});

// Ou usar query string manual
const resultado = await fetch(`
  http://localhost:5000/agendamentos?
  paciente_id=uuid-joao
  &profissional_id=uuid-fono-1
  &status=agendada
  &data_inicio=2026-03-01
  &data_fim=2026-03-31
`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 5. Filtro por Role

```javascript
// Listar apenas profissionais (fonoaudiólogos)
const fonos = await api.get('/usuarios', {
  params: { role: 'fono' }
});

// Múltiplos roles
const pessoal = await api.get('/usuarios', {
  params: { role: 'fono,medico' }
});
```

---

## ⚠️ Tratamento de Erros

### 1. Padrão de Error Handling

```javascript
async function hacerAlgum() {
  try {
    const resultado = await api.get('/algum-endpoint');
    return resultado;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    // Treatr erro do usuário
  }
}
```

### 2. Erros Comuns

```javascript
async function criarAgendamento(dados) {
  try {
    return await api.post('/agendamentos', dados);
  } catch (error) {
    if (error.message.includes('Conflito')) {
      return {
        erro: 'CONFLITO',
        mensagem: 'Horário indisponível. Escolha outro.',
        httpStatus: 409
      };
    }
    
    if (error.message.includes('obrigatório')) {
      return {
        erro: 'VALIDACAO',
        mensagem: 'Faltam campos obrigatórios.',
        httpStatus: 400
      };
    }
    
    if (error.message.includes('Unauthorized')) {
      return {
        erro: 'AUTH',
        mensagem: 'Token ausente ou expirado. Faça login novamente.',
        httpStatus: 401
      };
    }
    
    if (error.message.includes('Forbidden')) {
      return {
        erro: 'PERMISSAO',
        mensagem: 'Você não tem permissão para esta ação.',
        httpStatus: 403
      };
    }
    
    // Erro genérico
    return {
      erro: 'DESCONHECIDO',
      mensagem: 'Erro no servidor. Tente novamente mais tarde.',
      httpStatus: 500
    };
  }
}
```

### 3. Retry com Exponential Backoff

```javascript
async function requisicaoComRetry(endpoint, options = {}, tentativa = 1, maxTentativas = 3) {
  try {
    return await api.get(endpoint, options);
  } catch (error) {
    if (tentativa < maxTentativas && [500, 502, 503].includes(error.status)) {
      const delay = Math.pow(2, tentativa) * 1000;  // 2s, 4s, 8s
      console.log(`Tentando novamente em ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return requisicaoComRetry(endpoint, options, tentativa + 1, maxTentativas);
    }
    
    throw error;
  }
}

// Uso
const dados = await requisicaoComRetry('/agendamentos');
```

### 4. Response Completa com Status

```javascript
async function requisicaoSafert(endpoint, options = {}) {
  try {
    const data = await api.get(endpoint, options);
    return {
      status: 'sucesso',
      dados: data
    };
  } catch (error) {
    return {
      status: 'erro',
      mensagem: error.message,
      codigo: error.code
    };
  }
}

// Uso
const { status, dados, mensagem } = await requisicaoSafe('/pacientes');

if (status === 'sucesso') {
  console.log('Pacientes:', dados);
} else {
  console.error('Erro:', mensagem);
}
```

---

## 📋 Exemplo Completo: Sistema de Agendamentos

```javascript
// Frontend: Componente para agendar
import React, { useState, useEffect } from 'react';

function FormAgendamento() {
  const [pacientes, setPacientes] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [salas, setSalas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  
  const [form, setForm] = useState({
    pacienteId: '',
    profissionalId: '',
    salaId: '',
    data: '',
    horaInicio: '',
    horaFim: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const [pac, prof, sal] = await Promise.all([
        api.get('/pacientes'),
        api.get('/usuarios', { params: { role: 'fono,medico' } }),
        api.get('/salas')
      ]);
      
      setPacientes(pac);
      setProfissionais(prof);
      setSalas(sal);
    } catch (err) {
      setErro('Erro ao carregar dados: ' + err.message);
    }
  }

  async function agendar(e) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    try {
      const agendamento = await api.post('/agendamentos', {
        paciente_id: form.pacienteId,
        profissional_id: form.profissionalId,
        sala_id: form.salaId,
        data_agendamento: form.data,
        horario_inicio: form.horaInicio,
        horario_fim: form.horaFim
      });

      alert('✅ Agendamento criado com sucesso!');
      setForm({
        pacienteId: '',
        profissionalId: '',
        salaId: '',
        data: '',
        horaInicio: '',
        horaFim: ''
      });
      
      // Atualizar lista (se houver)
      window.location.reload();
    } catch (err) {
      if (err.message.includes('Conflito')) {
        setErro('❌ Horário indisponível. Escolha outro horário.');
      } else {
        setErro('❌ Erro: ' + err.message);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={agendar}>
      {erro && <div className="alert alert-error">{erro}</div>}
      
      <select
        value={form.pacienteId}
        onChange={(e) => setForm({...form, pacienteId: e.target.value})}
        required
      >
        <option value="">Selecione paciente</option>
        {pacientes.map(p => (
          <option key={p.id} value={p.id}>{p.nome_completo}</option>
        ))}
      </select>

      <select
        value={form.profissionalId}
        onChange={(e) => setForm({...form, profissionalId: e.target.value})}
        required
      >
        <option value="">Selecione profissional</option>
        {profissionais.map(p => (
          <option key={p.id} value={p.id}>{p.nome_completo}</option>
        ))}
      </select>

      <select
        value={form.salaId}
        onChange={(e) => setForm({...form, salaId: e.target.value})}
        required
      >
        <option value="">Selecione sala</option>
        {salas.map(s => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>

      <input
        type="date"
        value={form.data}
        onChange={(e) => setForm({...form, data: e.target.value})}
        required
      />

      <input
        type="time"
        value={form.horaInicio}
        onChange={(e) => setForm({...form, horaInicio: e.target.value})}
        required
      />

      <input
        type="time"
        value={form.horaFim}
        onChange={(e) => setForm({...form, horaFim: e.target.value})}
        required
      />

      <button type="submit" disabled={carregando}>
        {carregando ? '⏳ Agendando...' : '📅 Agendar'}
      </button>
    </form>
  );
}

export default FormAgendamento;
```

---

## 🎯 Dicas Práticas

1. **Sempre use token:**
   ```javascript
   const token = localStorage.getItem('token');
   // Adicionar em Authorization header
   ```

2. **Trate 401 e redirecione para login:**
   ```javascript
   if (response.status === 401) {
     localStorage.removeItem('token');
     window.location.href = '/login';
   }
   ```

3. **Use filtros para apenas dados relevantes:**
   ```javascript
   // ❌ Evitar: Listar tudo
   const todos = await api.get('/agendamentos');
   
   // ✅ Preferir: Com filtros
   const agendum = await api.get('/agendamentos', {
     params: { data_inicio: hoje, data_fim: hoje }
   });
   ```

4. **Valide formato de data/hora:**
   ```javascript
   // Formato esperado  
   const data = '2026-03-15';  // YYYY-MM-DD
   const hora = '09:00';  // HH:MM
   ```

5. **CPF deve ser único por clínica:**
   ```javascript
   // Validar antes de criar/atualizar
   if (cpf && !validarCPF(cpf)) {
     throw new Error('CPF inválido');
   }
   ```

---

**Versão:** 1.0.0  
**Data:** 2 de Março de 2026  
**Status:** ✅ Pronto para usar em desenvolvimento
