'use client'

import { useState, useEffect } from 'react'
import { relatorioService } from '@/services/relatorioService'
import { FileText, Download, Plus, Trash2, Upload, AlertTriangle } from 'lucide-react'
import { parseDateSafe } from '@/lib/dateUtils'
import Toast from '@/components/common/Toast'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'

export default function RelatoriosList({ pacienteId }) {
  const [relatorios, setRelatorios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    titulo: '',
    observacoes: '',
    arquivo: null
  })
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  useEffect(() => {
    if (pacienteId) {
      loadRelatorios()
    }
  }, [pacienteId])

  const loadRelatorios = async () => {
    try {
      setLoading(true)
      const data = await relatorioService.getAll({ paciente_id: pacienteId })
      console.log('Relatórios carregados:', data)
      setRelatorios(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error)
      setRelatorios([])
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Verificar tipo de arquivo
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        showToast('Tipo de arquivo não permitido. Use PDF, DOC ou DOCX', 'error')
        e.target.value = ''
        return
      }
      
      // Verificar tamanho (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast('Arquivo muito grande. Tamanho máximo: 10MB', 'error')
        e.target.value = ''
        return
      }
      
      setFormData({...formData, arquivo: file})
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.arquivo) {
      showToast('Selecione um arquivo', 'error')
      return
    }
    
    if (!formData.titulo.trim()) {
      showToast('Digite um título para o relatório', 'error')
      return
    }
    
    try {
      setUploading(true)
      
      const uploadData = new FormData()
      uploadData.append('arquivo', formData.arquivo)
      uploadData.append('titulo', formData.titulo)
      uploadData.append('paciente_id', pacienteId)
      if (formData.observacoes) {
        uploadData.append('observacoes', formData.observacoes)
      }
      
      await relatorioService.upload(uploadData)
      
      showToast('Relatório enviado com sucesso!')
      setShowModal(false)
      setFormData({ titulo: '', observacoes: '', arquivo: null })
      loadRelatorios()
    } catch (error) {
      console.error('Erro ao enviar relatório:', error)
      showToast('Erro ao enviar relatório: ' + (error.message || 'Erro desconhecido'), 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (relatorioId, nomeArquivo) => {
    try {
      const blob = await relatorioService.download(relatorioId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomeArquivo
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Erro ao baixar relatório:', error)
      showToast('Erro ao baixar relatório', 'error')
    }
  }

  const handleDelete = (relatorioId) => {
    setDeleteConfirm({ open: true, id: relatorioId })
  }

  const confirmDelete = async () => {
    try {
      await relatorioService.delete(deleteConfirm.id)
      setDeleteConfirm({ open: false, id: null })
      showToast('Relatório excluído com sucesso!')
      loadRelatorios()
    } catch (error) {
      console.error('Erro ao excluir relatório:', error)
      showToast('Erro ao excluir relatório', 'error')
    }
  }

  const getFileIcon = (tipo) => {
    if (tipo?.includes('pdf')) return '📄'
    if (tipo?.includes('word') || tipo?.includes('doc')) return '📝'
    return '📎'
  }

  if (loading) {
    return <div className="text-center py-4">Carregando relatórios...</div>
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold leading-snug text-neutral-900 sm:text-lg">
          Relatórios do paciente
        </h3>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 sm:w-auto sm:px-4 sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Upload relatório
        </button>
      </div>

      {relatorios.length === 0 ? (
        <div className="text-center py-8 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
          <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
          <p className="text-neutral-600">Nenhum relatório cadastrado</p>
          <p className="text-sm text-neutral-500 mt-1">
            Clique em &quot;Upload Relatório&quot; para adicionar documentos
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3">
          {relatorios.map((relatorio) => (
            <div
              key={relatorio.id}
              className="rounded-lg border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-md sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
                  <div className="text-2xl leading-none sm:text-3xl">{getFileIcon(relatorio.tipo_arquivo)}</div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-neutral-900 sm:text-base">{relatorio.titulo}</h4>
                    <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
                      Profissional: {relatorio.profissional_nome || 'Não informado'}
                    </p>
                    {relatorio.observacoes && (
                      <p className="mt-1 text-xs italic text-neutral-500 sm:text-sm">
                        {relatorio.observacoes}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-neutral-500 sm:text-xs">
                      Enviado em{' '}
                      {(() => {
                        const date = parseDateSafe(relatorio.data_upload)
                        if (!date) return 'Data inválida'
                        return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      })()}
                    </p>
                    <p className="text-[11px] text-neutral-500 break-all sm:text-xs">
                      {relatorio.nome_arquivo_original}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 justify-end gap-1 border-t border-neutral-100 pt-2 sm:border-0 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(relatorio.id, relatorio.nome_arquivo_original)}
                    className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                    title="Download"
                  >
                    <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(relatorio.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Upload */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-lg sm:p-6">
            <h2 className="mb-3 text-lg font-bold sm:mb-4 sm:text-xl">Upload de relatório</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Título do Relatório *
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                  required
                  placeholder="Ex: Exame de Audiometria"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                  rows={3}
                  placeholder="Observações adicionais sobre o relatório..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Arquivo (PDF, DOC ou DOCX) *
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-neutral-300 border-dashed rounded-lg hover:border-primary-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-neutral-400" />
                    <div className="flex text-sm text-neutral-600">
                      <label className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500">
                        <span>Selecione um arquivo</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          required
                          className="sr-only"
                        />
                      </label>
                      <p className="pl-1">ou arraste aqui</p>
                    </div>
                    <p className="text-xs text-neutral-500">
                      PDF, DOC ou DOCX até 10MB
                    </p>
                    {formData.arquivo && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ {formData.arquivo.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setFormData({ titulo: '', observacoes: '', arquivo: null })
                  }}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Enviar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        title="Excluir Relatório"
        size="sm"
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">Tem certeza que deseja excluir este relatório?</p>
            <p className="text-sm text-neutral-500 mt-1">Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDeleteConfirm({ open: false, id: null })}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
