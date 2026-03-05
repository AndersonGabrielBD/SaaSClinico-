'use client'

import { useState, useEffect } from 'react'
import { frequenciaService } from '@/services/frequenciaService'
import { useAuth } from '@/context/AuthContext'
import { 
  Calendar, 
  Check, 
  X, 
  Trash2, 
  AlertCircle,
  User
} from 'lucide-react'
import Toast from '@/components/common/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseDateSafe } from '@/lib/dateUtils'

export default function FrequenciaLista({ pacienteId, pacienteNome, user: userProp }) {
  const { user: userContext } = useAuth()
  const user = userProp || userContext
  const [frequencias, setFrequencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [frequenciaToDelete, setFrequenciaToDelete] = useState(null)

  // Verificar se é admin ou recepcionista
  const isAdminOrRecepcao = user?.role === 'admin' || user?.role === 'recepcao'

  useEffect(() => {
    loadFrequencias()
  }, [pacienteId])

  const loadFrequencias = async () => {
    try {
      setLoading(true)
      const data = await frequenciaService.getByPacienteId(pacienteId)
      setFrequencias(data)
    } catch (error) {
      console.error('Erro ao carregar frequências:', error)
      setToast({ 
        show: true, 
        message: 'Erro ao carregar frequências', 
        type: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (frequencia) => {
    setFrequenciaToDelete(frequencia)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!frequenciaToDelete) return

    try {
      await frequenciaService.delete(frequenciaToDelete.id)
      setToast({ 
        show: true, 
        message: 'Frequência deletada com sucesso!', 
        type: 'success' 
      })
      setDeleteModalOpen(false)
      setFrequenciaToDelete(null)
      loadFrequencias()
    } catch (error) {
      console.error('Erro ao deletar frequência:', error)
      setToast({ 
        show: true, 
        message: 'Erro ao deletar frequência', 
        type: 'error' 
      })
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-neutral-600">Carregando frequências...</div>
  }

  if (frequencias.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center border border-neutral-200">
        <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-600">Nenhuma frequência registrada para este paciente</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Histórico de Frequências</h3>
        <span className="text-sm text-neutral-600">
          {frequencias.length} registros
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Profissional</th>
              <th className="px-4 py-3 text-center">Comparecimento</th>
              <th className="px-4 py-3 text-left">Observações</th>
              <th className="px-4 py-3 text-left">Registrado por</th>
              {isAdminOrRecepcao && <th className="px-4 py-3 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {frequencias.map((freq) => (
              <tr 
                key={freq.id} 
                className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-neutral-400" />
                    {(() => {
                      const date = parseDateSafe(freq.data_atendimento)
                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida'
                    })()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-neutral-400" />
                    {freq.profissional_nome || 'Profissional desconhecido'}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {freq.compareceu ? (
                    <div className="flex items-center justify-center gap-1">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 font-medium">Presente</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <X className="w-4 h-4 text-red-600" />
                      <span className="text-red-600 font-medium">Ausente</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {freq.observacoes ? (
                    <span className="text-xs bg-neutral-100 px-2 py-1 rounded">
                      {freq.observacoes.substring(0, 30)}{freq.observacoes.length > 30 ? '...' : ''}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600 text-xs">
                  {freq.registrado_por_nome || freq.usuario_nome || 'Desconhecido'}
                </td>
                {isAdminOrRecepcao && (
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDeleteClick(freq)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Deletar frequência"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs">Deletar</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmação de Deleção */}
      {deleteModalOpen && frequenciaToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h2 className="text-lg font-bold">Confirmar Exclusão</h2>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm text-neutral-700">
                Tem certeza que deseja <strong>deletar</strong> a frequência registrada em{' '}
                <strong>
                  {(() => {
                    const date = parseDateSafe(frequenciaToDelete.data_atendimento)
                    return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inválida'
                  })()}
                </strong>
                {frequenciaToDelete.profissional_nome && (
                  <> com <strong>{frequenciaToDelete.profissional_nome}</strong></>
                )}
                ?
              </p>
              <p className="text-xs text-neutral-600 mt-2">
                Esta ação é <strong>irreversível</strong>.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setFrequenciaToDelete(null)
                }}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  )
}
