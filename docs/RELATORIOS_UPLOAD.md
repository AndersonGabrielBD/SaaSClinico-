# Sistema de Relatórios com Upload de Arquivos

## 📋 Visão Geral

O sistema de relatórios foi completamente refatorado para permitir **upload de arquivos** (PDF, DOC, DOCX) ao invés de criar relatórios via formulário.

## 🔄 Mudanças Implementadas

### Backend

#### 1. **RelatorioService** (`backend/app/services/relatorio_service.py`)
- ✅ `criar_relatorio()` - Faz upload do arquivo para Supabase Storage
- ✅ `listar_relatorios()` - Lista com filtros e controle de acesso por role
- ✅ `buscar_relatorio()` - Busca relatório específico com joins
- ✅ `download_arquivo()` - Download do arquivo do Storage
- ✅ `atualizar_relatorio()` - Atualiza título e observações
- ✅ `excluir_relatorio()` - Exclui arquivo do Storage e registro do banco

#### 2. **Rotas** (`backend/app/routes/relatorios_routes.py`)
- `GET /relatorios` - Lista relatórios (com filtros)
- `GET /relatorios/:id` - Busca um relatório
- `POST /relatorios` - Upload de novo relatório (multipart/form-data)
- `GET /relatorios/:id/download` - Download do arquivo
- `PUT /relatorios/:id` - Atualiza informações
- `DELETE /relatorios/:id` - Exclui relatório e arquivo

#### 3. **Controle de Acesso**
- **Admin**: Acesso total
- **Recepção**: Visualiza todos
- **Profissional**: Cria/edita/exclui apenas os seus próprios

### Frontend

#### 1. **RelatoriosList Component** (`frontend-next/src/components/relatorios/RelatoriosList.jsx`)
- ✅ Interface de upload com drag-and-drop
- ✅ Validação de tipo de arquivo (PDF, DOC, DOCX)
- ✅ Validação de tamanho (máx 10MB)
- ✅ Preview de arquivo selecionado
- ✅ Lista de relatórios com ícones por tipo
- ✅ Download de arquivos
- ✅ Exclusão de relatórios
- ✅ Informações de profissional e data

#### 2. **relatorioService** (`frontend-next/src/services/relatorioService.js`)
- ✅ `upload()` - Envia FormData com arquivo
- ✅ `download()` - Faz download e retorna Blob
- ✅ `getAll()` - Lista com filtros
- ✅ `delete()` - Exclui relatório

### Banco de Dados

#### Migration (`supabase/migrations/003_atualizar_relatorios_storage.sql`)
```sql
-- Novos campos na tabela relatorios:
- titulo (VARCHAR) - Título do relatório
- arquivo_url (TEXT) - URL pública do arquivo
- arquivo_path (TEXT) - Caminho no Storage
- tipo_arquivo (VARCHAR) - MIME type
- nome_arquivo_original (VARCHAR) - Nome original
- observacoes (TEXT) - Observações
- data_upload (TIMESTAMP) - Data do upload

-- Índices criados:
- idx_relatorios_paciente_data
- idx_relatorios_profissional_data
- idx_relatorios_clinica_data
```

## 🚀 Como Configurar

### 1. **Criar Bucket no Supabase**

Acesse o Supabase Dashboard → Storage → Create Bucket:

```
Nome: relatorios
Public: false (privado)
```

Ou via SQL:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('relatorios', 'relatorios', false);
```

### 2. **Aplicar Migration**

Execute no SQL Editor do Supabase:
```bash
# Copie e cole o conteúdo do arquivo:
supabase/migrations/003_atualizar_relatorios_storage.sql
```

### 3. **Instalar Dependências Backend**

```bash
cd backend
pip install reportlab==4.0.7
```

### 4. **Testar o Sistema**

1. **Backend**: `python app.py`
2. **Frontend**: `npm run dev`
3. Acesse um prontuário e teste o upload

## 📊 Estrutura de Dados

### Tabela `relatorios`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único |
| clinica_id | UUID | FK para clinicas |
| paciente_id | UUID | FK para pacientes |
| profissional_id | UUID | FK para usuarios (profissional) |
| titulo | VARCHAR | Título do relatório |
| arquivo_url | TEXT | URL no Storage |
| arquivo_path | TEXT | Caminho no bucket |
| tipo_arquivo | VARCHAR | MIME type |
| nome_arquivo_original | VARCHAR | Nome do arquivo |
| observacoes | TEXT | Observações |
| data_upload | TIMESTAMP | Data do upload |

### Relacionamentos

```
relatorios
├─ paciente_id → pacientes (n:1)
│   Um paciente pode ter vários relatórios
│
└─ profissional_id → usuarios (n:1)
    Um profissional pode criar vários relatórios
```

## 🔐 Segurança

### RLS Policies

✅ **SELECT**: Admin/Recepcao veem todos, Profissional vê apenas os seus
✅ **INSERT**: Apenas Admin e Profissionais
✅ **UPDATE**: Apenas Admin e o próprio Profissional
✅ **DELETE**: Apenas Admin e o próprio Profissional

### Storage Policies

✅ **Upload**: Apenas usuários autenticados
✅ **Read**: Apenas da mesma clínica
✅ **Delete**: Apenas Admin ou criador

## 📝 Exemplos de Uso

### Upload via cURL
```bash
curl -X POST http://localhost:5000/relatorios \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "arquivo=@relatorio.pdf" \
  -F "titulo=Exame de Audiometria" \
  -F "paciente_id=uuid-do-paciente" \
  -F "observacoes=Paciente apresentou..."
```

### Download via JavaScript
```javascript
const blob = await relatorioService.download(relatorioId)
const url = URL.createObjectURL(blob)
window.open(url, '_blank')
```

## 🎯 Features

✅ Upload de PDF, DOC, DOCX
✅ Validação de tipo e tamanho
✅ Armazenamento no Supabase Storage
✅ Download de arquivos
✅ Controle de acesso por role
✅ Interface drag-and-drop
✅ Preview de arquivo selecionado
✅ Histórico de uploads
✅ Associação paciente + profissional
✅ Exclusão com remoção do Storage

## 🔄 Migração de Dados Antigos

Se você tinha relatórios criados com o sistema antigo (formulários), eles serão perdidos com a migration. Caso precise manter, faça backup antes de executar a migration.

## 🐛 Troubleshooting

### Erro: "Bucket não encontrado"
- Verifique se criou o bucket "relatorios" no Supabase Storage

### Erro: "Permission denied"
- Verifique as RLS policies da tabela relatorios
- Verifique as Storage policies do bucket

### Erro ao fazer upload
- Verifique se o arquivo tem menos de 10MB
- Verifique se é PDF, DOC ou DOCX
- Verifique as permissões do usuário

### Arquivo não faz download
- Verifique se o arquivo_path está correto no banco
- Verifique as políticas de storage
- Verifique se o bucket é privado (não público)

## 📚 Próximos Passos

- [ ] Adicionar preview de PDF no modal
- [ ] Adicionar conversão de DOC para PDF
- [ ] Implementar assinatura digital
- [ ] Adicionar versionamento de arquivos
- [ ] Adicionar OCR para busca de texto
- [ ] Webhook para notificar novos relatórios
