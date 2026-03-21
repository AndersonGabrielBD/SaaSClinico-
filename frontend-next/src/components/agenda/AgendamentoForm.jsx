'use client'

import { useState, useEffect, useCallback } from 'react'
import { agendamentoService } from '@/services/agendamentoService'
import { frequenciaService } from '@/services/frequenciaService'
import { pacoteService } from '@/services/pacoteService'
import { pacienteService } from '@/services/pacienteService'
import { profissionalService } from '@/services/profissionalService'
import { getUserRole } from '@/utils/auth'
import * as api from '@/lib/api'
import Button from '@/components/common/Button'
import { getTodayBrazil } from '@/lib/dateUtils'
import { RefreshCw, Package } from 'lucide-react'

const TIPOS_PADRAO = ['Avaliação', 'Reavaliação', 'Seguimento', 'Terapia', 'Retorno']

const STATUS_OPCOES = [
  { value: 'agendada',        label: 'Agendada' },
  { value: 'confirmada',      label: 'Confirmada' },
  { value: 'em_atendimento',  label: 'Em Atendimento' },
  { value: 'concluida',       label: 'Concluída' },
  { value: 'cancelada',       label: 'Cancelada' },
  { value: 'faltou',          label: 'Faltou' },
]

export default function AgendamentoForm({ agendamento, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [salas, setSalas] = useState([])
  const [tiposAtendimento, setTiposAtendimento] = useState(TIPOS_PADRAO)

  // Feature 1 — Recorrência
  const [recorrente, setRecorrente] = useState(false)
  const [recorrenciaConfig, setRecorrenciaConfig] = useState({
    frequencia: 'semanal',
    modoFim: 'ocorrencias', // 'ocorrencias' | 'data'
    totalOcorrencias: 4,
    dataFim: '',
  })

  // Feature 2 — Pacote ativo
  const [pacoteAtivo, setPacoteAtivo] = useState(null)
  const [pacoteItemSelecionado, setPacoteItemSelecionado] = useState('')
  const [loadingPacote, setLoadingPacote] = useState(false)

  const [formData, setFormData] = useState({
    paciente_id: agendamento?.paciente_id || '',
    profissional_id: agendamento?.profissional_id || '',
    sala_id: agendamento?.sala_id || '',
    data_agendamento: agendamento?.data_agendamento || getTodayBrazil(),
    horario_inicio: agendamento?.horario_inicio || '',
    horario_fim: agendamento?.horario_fim || '',
    tipo_atendimento: agendamento?.tipo_atendimento || 'Avaliação',
    observacoes: agendamento?.observacoes || '',
    // Feature 4 — status + cancelamento
    status: agendamento?.status || 'agendada',
    motivo_cancelamento: agendamento?.motivo_cancelamento || '',
  })

  useEffect(() => {
    loadOptions()
  }, [])

  // Busca pacote ativo quando paciente + profissional estão preenchidos (apenas ao criar)
  const buscarPacoteAtivo = useCallback(async (paciente_id, profissional_id) => {
    if (!paciente_id || !profissional_id || agendamento) return
    setLoadingPacote(true)
    setPacoteAtivo(null)
    setPacoteItemSelecionado('')
    try {
      const pacote = await pacoteService.getPacoteAtivoByPacienteEProfissional(
        paciente_id,
        profissional_id
      )
      if (pacote && pacote.itens?.length > 0) {
        const itensComSaldo = pacote.itens.filter(i => i.sessoes_restantes > 0)
        setPacoteAtivo({ ...pacote, itens: itensComSaldo })
      }
    } catch {
      // silencioso
    } finally {
      setLoadingPacote(false)
    }
  }, [agendamento])

  useEffect(() => {
    if (formData.paciente_id && formData.profissional_id) {
      buscarPacoteAtivo(formData.paciente_id, formData.profissional_id)
    } else {
      setPacoteAtivo(null)
      setPacoteItemSelecionado('')
    }
  }, [formData.paciente_id, formData.profissional_id, buscarPacoteAtivo])

  const loadOptions = async () => {
    try {
      const userRole = getUserRole()
      const isProfissional = ['fono', 'medico', 'profissional'].includes(userRole)

      let pacientesData
      if (isProfissional) {
        pacientesData = await profissionalService.getMyPacientes({ ativo: true })
      } else {
        pacientesData = await pacienteService.getAll({ ativo: true })
      }
      setPacientes(pacientesData)

      let profData = await api.getProfissionais({ ativo: true })
      profData = profData?.data || profData || []

      if (isProfissional) {
        const userInfo = localStorage.getItem('user_info')
        if (userInfo) {
          try {
            const user = JSON.parse(userInfo)
            profData = profData.filter(p => p.id === user.id)
          } catch (e) {
            console.error('Erro ao parsear user_info:', e)
          }
        }
      }
      setProfissionais(profData)

      const salasData = await api.getSalas({ ativo: true })
      setSalas(salasData?.data || salasData || [])

      try {
        const tiposData = await api.getTiposAtendimento({ ativo: true })
        const tiposArr = tiposData?.data || tiposData || []
        if (tiposArr.length > 0) {
          setTiposAtendimento(tiposArr.map(t => t.nome || t))
        }
      } catch {
        // mantém os tipos padrão
      }
    } catch (error) {
      console.error('Erro ao carregar opções:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.paciente_id || !formData.profissional_id || !formData.data_agendamento ||
        !formData.horario_inicio || !formData.horario_fim) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    if (formData.horario_inicio >= formData.horario_fim) {
      setError('Horário de término deve ser maior que o horário de início')
      return
    }

    // Validar data (somente ao criar)
    if (!agendamento) {
      const hoje = getTodayBrazil()
      if (formData.data_agendamento < hoje) {
        setError('Não é possível agendar em datas passadas')
        return
      }
    }

    // Feature 4 — motivo obrigatório ao cancelar
    if (formData.status === 'cancelada' && !formData.motivo_cancelamento.trim()) {
      setError('Informe o motivo do cancelamento')
      return
    }

    try {
      setLoading(true)

      const payload = {
        ...formData,
        sala_id: formData.sala_id || null,
        pacote_item_id: pacoteItemSelecionado || null,
      }

      if (agendamento && agendamento.id) {
        // Edição — salva status + motivo junto
        await agendamentoService.update(agendamento.id, payload)
        // Se status mudou para concluida ou faltou, registrar frequência vinculada ao agendamento
        if ((formData.status === 'concluida' || formData.status === 'faltou') && formData.profissional_id) {
          try {
            await frequenciaService.registrar({
              paciente_id: formData.paciente_id,
              profissional_id: formData.profissional_id,
              agendamento_id: agendamento.id,
              data_atendimento: formData.data_agendamento,
              compareceu: formData.status === 'concluida',
              observacoes: null
            })
          } catch (freqErr) {
            // Ignora se já existe frequência para este agendamento
            if (!freqErr?.message?.includes('já registrada')) {
              console.warn('Frequência não registrada:', freqErr)
            }
          }
        }
      } else if (recorrente) {
        // Feature 1 — criação recorrente
        const config = {
          frequencia: recorrenciaConfig.frequencia,
          totalOcorrencias: recorrenciaConfig.modoFim === 'ocorrencias'
            ? Number(recorrenciaConfig.totalOcorrencias)
            : undefined,
          dataFim: recorrenciaConfig.modoFim === 'data'
            ? recorrenciaConfig.dataFim
            : undefined,
        }

        // Fix 5 — Validar limite de sessões antes de criar recorrente com pacote
        if (pacoteItemSelecionado && pacoteAtivo) {
          const item = pacoteAtivo.itens.find(i => i.id === pacoteItemSelecionado)
          if (item) {
            // Calcula quantas datas serão geradas
            const { default: gerarDatas } = { default: null } // evita import circular; usa lógica inline
            let sessoesNecessarias = 0
            if (recorrenciaConfig.modoFim === 'ocorrencias') {
              sessoesNecessarias = Number(recorrenciaConfig.totalOcorrencias) || 0
            } else if (recorrenciaConfig.modoFim === 'data' && recorrenciaConfig.dataFim) {
              // Conta quantas datas são geradas pelo mesmo algoritmo do service
              const [ano, mes, dia] = payload.data_agendamento.split('-').map(Number)
              let atual = new Date(ano, mes - 1, dia)
              const limite = new Date(recorrenciaConfig.dataFim)
              let count = 0
              const freq = recorrenciaConfig.frequencia
              while (atual <= limite && count < 52) {
                count++
                if (freq === 'semanal') atual.setDate(atual.getDate() + 7)
                else if (freq === 'quinzenal') atual.setDate(atual.getDate() + 14)
                else if (freq === 'mensal') atual.setMonth(atual.getMonth() + 1)
                else break
              }
              sessoesNecessarias = count
            }
            if (sessoesNecessarias > item.sessoes_restantes) {
              setError(
                `O pacote só possui ${item.sessoes_restantes} sessão(ões) disponível(eis), ` +
                `mas você está tentando criar ${sessoesNecessarias} agendamento(s). ` +
                `Reduza o número de repetições ou escolha uma data de término anterior.`
              )
              setLoading(false)
              return
            }
          }
        }

        const { criados, erros } = await agendamentoService.createRecorrente(payload, config)
        if (erros.length > 0 && criados.length === 0) {
          setError(`Nenhum agendamento criado. Erros: ${erros.map(e => e.data).join(', ')}`)
          return
        }
        if (erros.length > 0) {
          // avisa mas continua
          console.warn('Alguns agendamentos não foram criados:', erros)
        }
      } else {
        await agendamentoService.create(payload)
      }

      onSuccess()
    } catch (err) {
      let mensagem = 'Erro ao salvar agendamento'
      if (err.code === '23514' || err.message?.includes('data_futura') || err.message?.includes('check constraint')) {
        mensagem = 'Data inválida. Não é possível agendar em datas passadas'
      } else if (err.status === 400 || err.message?.includes('inválido') || err.message?.includes('obrigat')) {
        mensagem = err.message || 'Por favor, preencha todos os campos obrigatórios'
      } else if (err.message?.includes('conflict') || err.message?.includes('Há conflito')) {
        mensagem = 'Conflito de horário. Escolha outro horário'
      } else {
        mensagem = err.message || mensagem
      }
      setError(mensagem)
    } finally {
      setLoading(false)
    }
  }

  const isEditing = Boolean(agendamento)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Paciente */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Paciente *
          </label>
          <select
            value={formData.paciente_id}
            onChange={(e) => setFormData({ ...formData, paciente_id: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          >
            <option value="">Selecione um paciente</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>{p.nome_completo}</option>
            ))}
          </select>
        </div>

        {/* Profissional */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Profissional *
          </label>
          <select
            value={formData.profissional_id}
            onChange={(e) => setFormData({ ...formData, profissional_id: e.target.value })}
            disabled={['fono', 'medico', 'profissional'].includes(getUserRole())}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none disabled:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-75"
            required
          >
            <option value="">Selecione um profissional</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_completo} {p.especialidade && `- ${p.especialidade}`}
              </option>
            ))}
          </select>
          {['fono', 'medico', 'profissional'].includes(getUserRole()) && (
            <p className="text-xs text-neutral-500 mt-1">Profissionais criam agendamentos apenas para si mesmos</p>
          )}
        </div>

        {/* Sala */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Sala (opcional)
          </label>
          <select
            value={formData.sala_id}
            onChange={(e) => setFormData({ ...formData, sala_id: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">Sem sala definida</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">Você pode criar o agendamento sem informar sala.</p>
        </div>

        {/* Tipo de Atendimento */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Tipo de Atendimento
          </label>
          <select
            value={formData.tipo_atendimento}
            onChange={(e) => setFormData({ ...formData, tipo_atendimento: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            {tiposAtendimento.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Data *
          </label>
          <input
            type="date"
            value={formData.data_agendamento}
            onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>

        {/* Horário Início */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Horário Início *
          </label>
          <input
            type="time"
            value={formData.horario_inicio}
            onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>

        {/* Horário Fim */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Horário Fim *
          </label>
          <input
            type="time"
            value={formData.horario_fim}
            onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>

        {/* Feature 4 — Status (somente ao editar) */}
        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value, motivo_cancelamento: '' })}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Feature 4 — Motivo de cancelamento (somente ao editar com status cancelada) */}
      {isEditing && formData.status === 'cancelada' && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Motivo do Cancelamento *
          </label>
          <textarea
            value={formData.motivo_cancelamento}
            onChange={(e) => setFormData({ ...formData, motivo_cancelamento: e.target.value })}
            rows={2}
            className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
            placeholder="Descreva o motivo do cancelamento..."
            required
          />
        </div>
      )}

      {/* Observações */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Observações
        </label>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="Observações adicionais..."
        />
      </div>

      {/* Feature 2 — Pacote ativo (somente ao criar) */}
      {!isEditing && (
        <div>
          {loadingPacote && (
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Verificando pacote ativo...
            </p>
          )}
          {!loadingPacote && pacoteAtivo && pacoteAtivo.itens?.length > 0 && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                <Package className="w-4 h-4" />
                Pacote ativo com sessões disponíveis
              </div>
              <div className="space-y-1">
                {pacoteAtivo.itens.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="pacote_item"
                      value={item.id}
                      checked={pacoteItemSelecionado === item.id}
                      onChange={() => setPacoteItemSelecionado(item.id)}
                      className="accent-emerald-600"
                    />
                    <span className="text-neutral-700">
                      {item.tipo_nome || 'Sessão'}
                      {item.profissional_nome && ` — ${item.profissional_nome}`}
                    </span>
                    <span className="ml-auto text-emerald-700 font-semibold text-xs">
                      {item.sessoes_restantes} sessão(ões) restante(s)
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-500">
                  <input
                    type="radio"
                    name="pacote_item"
                    value=""
                    checked={pacoteItemSelecionado === ''}
                    onChange={() => setPacoteItemSelecionado('')}
                  />
                  Não vincular ao pacote
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feature 1 — Repetição (somente ao criar) */}
      {!isEditing && (
        <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              className="accent-primary-600 w-4 h-4"
            />
            <span className="text-sm font-medium text-neutral-700 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-neutral-400" />
              Repetir agendamento
            </span>
          </label>

          {recorrente && (
            <div className="space-y-3 pl-6">
              {/* Frequência */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Frequência</label>
                <div className="flex gap-2">
                  {[
                    { value: 'semanal', label: 'Semanal' },
                    { value: 'quinzenal', label: 'Quinzenal' },
                    { value: 'mensal', label: 'Mensal' },
                  ].map((op) => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setRecorrenciaConfig(prev => ({ ...prev, frequencia: op.value }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${recorrenciaConfig.frequencia === op.value
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-neutral-600 border-neutral-300 hover:border-primary-400'
                        }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo de encerramento */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Encerrar após</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="modoFim"
                      value="ocorrencias"
                      checked={recorrenciaConfig.modoFim === 'ocorrencias'}
                      onChange={() => setRecorrenciaConfig(prev => ({ ...prev, modoFim: 'ocorrencias' }))}
                    />
                    Nº de ocorrências
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="modoFim"
                      value="data"
                      checked={recorrenciaConfig.modoFim === 'data'}
                      onChange={() => setRecorrenciaConfig(prev => ({ ...prev, modoFim: 'data' }))}
                    />
                    Data final
                  </label>
                </div>
              </div>

              {recorrenciaConfig.modoFim === 'ocorrencias' ? (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Número de repetições
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={recorrenciaConfig.totalOcorrencias}
                    onChange={(e) => setRecorrenciaConfig(prev => ({
                      ...prev,
                      totalOcorrencias: Math.max(2, Math.min(52, Number(e.target.value)))
                    }))}
                    className="w-24 px-3 py-1.5 text-sm border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    Serão criados {recorrenciaConfig.totalOcorrencias} agendamentos ({recorrenciaConfig.frequencia === 'semanal' ? 'toda semana' : recorrenciaConfig.frequencia === 'quinzenal' ? 'a cada 2 semanas' : 'todo mês'})
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Data de encerramento
                  </label>
                  <input
                    type="date"
                    value={recorrenciaConfig.dataFim}
                    min={formData.data_agendamento}
                    onChange={(e) => setRecorrenciaConfig(prev => ({ ...prev, dataFim: e.target.value }))}
                    className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading} className="flex-1">
          {isEditing ? 'Atualizar' : recorrente ? 'Criar Agendamentos Recorrentes' : 'Criar'} Agendamento
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
