'use client'

import { useState, useEffect } from 'react'
import { pacienteService } from '@/services/pacienteService'
import { usuarioService } from '@/services/usuarioService'
import { ROLE_NAMES } from '@/utils/roles'
import { AlertCircle } from 'lucide-react'
import Button from '@/components/common/Button'

export default function PacienteForm({ paciente, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profissionais, setProfissionais] = useState([])
  const [loadingProfissionais, setLoadingProfissionais] = useState(true)

  const [formData, setFormData] = useState({
    nome_completo: paciente?.nome_completo || '',
    cpf: paciente?.cpf || '',
    data_nascimento: paciente?.data_nascimento || '',
    genero: paciente?.genero || undefined,
    email: paciente?.email || '',
    telefone_principal: paciente?.telefone_principal || '',
    telefone_secundario: paciente?.telefone_secundario || '',
    endereco: paciente?.endereco || '',
    numero: paciente?.numero || '',
    complemento: paciente?.complemento || '',
    cidade: paciente?.cidade || '',
    estado: paciente?.estado || '',
    cep: paciente?.cep || '',
    responsavel_nome: paciente?.responsavel_nome || '',
    responsavel_telefone: paciente?.responsavel_telefone || '',
    responsavel_email: paciente?.responsavel_email || '',
    responsavel_relacao: paciente?.responsavel_relacao || '',
    observacoes: paciente?.observacoes || ''
  })

  const [selectedProfissionais, setSelectedProfissionais] = useState([])

  useEffect(() => {
    loadProfissionais()
    if (paciente?.id) {
      loadPacienteProfissionais()
    }
  }, [paciente])

  const loadProfissionais = async () => {
    try {
      setLoadingProfissionais(true)
      const data = await usuarioService.getProfissionais()
      setProfissionais(data)
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error)
    } finally {
      setLoadingProfissionais(false)
    }
  }

  const loadPacienteProfissionais = async () => {
    try {
      const vinculos = await pacienteService.getProfissionais(paciente.id)
      const ids = vinculos.map(v => v.id)
      setSelectedProfissionais(ids)
    } catch (error) {
      console.error('Erro ao carregar profissionais do paciente:', error)
    }
  }

  const handleProfissionalToggle = (profId) => {
    setSelectedProfissionais(prev => {
      if (prev.includes(profId)) {
        return prev.filter(id => id !== profId)
      } else {
        return [...prev, profId]
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.nome_completo) {
      setError('Nome é obrigatório')
      return
    }

    try {
      setLoading(true)

      let pacienteId

      if (paciente) {
        await pacienteService.update(paciente.id, formData)
        pacienteId = paciente.id
      } else {
        const novoPaciente = await pacienteService.create(formData)
        pacienteId = novoPaciente.id
      }

      if (selectedProfissionais.length > 0) {
        await pacienteService.syncProfissionais(pacienteId, selectedProfissionais)
      }

      onSuccess()
    } catch (err) {
      const errorMessage = err.message || 'Erro ao salvar paciente'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "input-field"
  const labelClass = "block text-sm font-semibold text-neutral-700 mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Dados Pessoais */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">Dados Pessoais</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>Nome Completo *</label>
            <input type="text" value={formData.nome_completo} onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>CPF</label>
            <input type="text" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} className={inputClass} placeholder="000.000.000-00" maxLength={14} />
            <p className="text-xs text-neutral-400 mt-1.5">Cada CPF pode ser cadastrado apenas uma vez</p>
          </div>
          <div>
            <label className={labelClass}>Data de Nascimento</label>
            <input type="date" value={formData.data_nascimento} onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Gênero</label>
            <select value={formData.genero} onChange={(e) => setFormData({ ...formData, genero: e.target.value })} className="select-field">
              <option value="">Selecione</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className={labelClass}>Profissionais Responsáveis</label>
            {loadingProfissionais ? (
              <div className="text-sm text-neutral-400 py-3">Carregando profissionais...</div>
            ) : profissionais.length === 0 ? (
              <div className="text-sm text-neutral-400 py-3">Nenhum profissional cadastrado</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-neutral-200 rounded-xl p-2">
                {profissionais.map((prof) => (
                  <label key={prof.id} className="flex items-center gap-3 p-2.5 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedProfissionais.includes(prof.id)}
                      onChange={() => handleProfissionalToggle(prof.id)}
                      className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-800">{prof.nome_completo}</p>
                      <p className="text-xs text-neutral-400">
                        {prof.role === 'fono' ? 'Fonoaudiólogo' : 'Profissional'}
                        {prof.especialidade && ` - ${prof.especialidade}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-400 mt-1.5">Selecione um ou mais profissionais que atenderão este paciente</p>
            {selectedProfissionais.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedProfissionais.map((profId) => {
                  const prof = profissionais.find(p => p.id === profId)
                  return prof ? (
                    <span key={profId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold">
                      {prof.nome_completo}
                      <button type="button" onClick={() => handleProfissionalToggle(profId)} className="hover:text-primary-900 ml-0.5">×</button>
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contato */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">Contato</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone Principal</label>
            <input type="tel" value={formData.telefone_principal} onChange={(e) => setFormData({ ...formData, telefone_principal: e.target.value })} className={inputClass} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className={labelClass}>Telefone Secundário</label>
            <input type="tel" value={formData.telefone_secundario} onChange={(e) => setFormData({ ...formData, telefone_secundario: e.target.value })} className={inputClass} />
          </div>
          <div className="lg:col-span-2">
            <label className={labelClass}>E-mail</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">Endereço</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>Logradouro</label>
            <input type="text" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Número</label>
            <input type="text" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} className={inputClass} />
          </div>
          <div className="lg:col-span-3">
            <label className={labelClass}>Complemento</label>
            <input type="text" value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Cidade</label>
            <input type="text" value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <input type="text" value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} className={inputClass} maxLength={2} placeholder="UF" />
          </div>
          <div>
            <label className={labelClass}>CEP</label>
            <input type="text" value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} className={inputClass} placeholder="00000-000" />
          </div>
        </div>
      </div>

      {/* Responsável */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">Responsável (se menor de idade)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome do Responsável</label>
            <input type="text" value={formData.responsavel_nome} onChange={(e) => setFormData({ ...formData, responsavel_nome: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Relação</label>
            <input type="text" value={formData.responsavel_relacao} onChange={(e) => setFormData({ ...formData, responsavel_relacao: e.target.value })} className={inputClass} placeholder="Pai, Mãe, Avó, etc." />
          </div>
          <div>
            <label className={labelClass}>Telefone do Responsável</label>
            <input type="tel" value={formData.responsavel_telefone} onChange={(e) => setFormData({ ...formData, responsavel_telefone: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>E-mail do Responsável</label>
            <input type="email" value={formData.responsavel_email} onChange={(e) => setFormData({ ...formData, responsavel_email: e.target.value })} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className={labelClass}>Observações</label>
        <textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={4} className={inputClass} placeholder="Informações adicionais sobre o paciente..." />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-neutral-100">
        <Button type="submit" loading={loading} className="flex-1">
          {paciente ? 'Atualizar' : 'Cadastrar'} Paciente
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
