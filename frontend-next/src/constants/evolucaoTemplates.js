/** Templates estáticos para evolução clínica (sem IA). */

export const HUMOR_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'eufórico', label: 'Eufórico' },
  { value: 'estável', label: 'Estável' },
  { value: 'ansioso', label: 'Ansioso' },
  { value: 'triste', label: 'Triste' },
  { value: 'irritado', label: 'Irritado' },
  { value: 'apatia', label: 'Apatia' },
]

export const COMPORTAMENTO_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'colaborativo', label: 'Colaborativo' },
  { value: 'resistência_leve', label: 'Resistência leve' },
  { value: 'desafiador', label: 'Desafiador' },
  { value: 'agitado', label: 'Agitado' },
  { value: 'hipoativo', label: 'Hipoativo' },
]

export const EVOLUCAO_TEMPLATES = [
  {
    id: 'fono',
    label: 'Sessão padrão fono',
    values: {
      titulo_resumo: 'Sessão de fonoaudiologia',
      conteudo:
        'Objetivos trabalhados:\nProcedimentos / exercícios:\nDesempenho do paciente:\nOrientações à família:\nPróximos passos:',
      humor: '',
      comportamento: '',
      observacoes: '',
    },
  },
  {
    id: 'psicologia',
    label: 'Sessão psicologia',
    values: {
      titulo_resumo: 'Sessão de psicologia',
      conteudo:
        'Demanda apresentada:\nIntervenções realizadas:\nObservações clínicas:\nTarefas / acordos:\nPlanejamento:',
      humor: '',
      comportamento: '',
      observacoes: '',
    },
  },
  {
    id: 'to',
    label: 'Sessão TO',
    values: {
      titulo_resumo: 'Sessão de terapia ocupacional',
      conteudo:
        'Atividades propostas:\nParticipação e engajamento:\nAjustes / adaptações:\nMetas trabalhadas:\nEncaminhamentos:',
      humor: '',
      comportamento: '',
      observacoes: '',
    },
  },
]
