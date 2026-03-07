'use client'

import { useState, useEffect } from 'react'
import { relatorioService } from '@/services/relatorioService'
import { FileText, Download, Plus, Trash2, Upload } from 'lucide-react'
import { parseDateSafe } from '@/lib/dateUtils'
import Toast from '@/components/common/Toast'

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

  const handleDelete = async (relatorioId) => {
    if (!confirm('Deseja realmente excluir este relatório?')) return
    
    try {
      await relatorioService.delete(relatorioId)
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Relatórios do Paciente</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Upload Relatório
        </button>
      </div>

      {relatorios.length === 0 ? (
        <div className="text-center py-8 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
          <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
          <p className="text-neutral-600">Nenhum relatório cadastrado</p>
          <p className="text-sm text-neutral-500 mt-1">
            Clique em "Upload Relatório" para adicionar documentos
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {relatorios.map((relatorio) => (
            <div key={relatorio.id} className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-3xl">{getFileIcon(relatorio.tipo_arquivo)}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-neutral-900">{relatorio.titulo}</h4>
                    <p className="text-sm text-neutral-600 mt-1">
                      Profissional: {relatorio.profissional_nome || 'Não informado'}
                    </p>
                    {relatorio.observacoes && (
                      <p className="text-sm text-neutral-500 mt-1 italic">
                        {relatorio.observacoes}
                      </p>
                    )}
                    <p className="text-xs text-neutral-400 mt-2">
                      Enviado em {(() => {
                        const date = parseDateSafe(relatorio.data_upload)
                        if (!date) return 'Data inválida'
                        return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      })()}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Arquivo: {relatorio.nome_arquivo_original}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(relatorio.id, relatorio.nome_arquivo_original)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(relatorio.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Upload */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Upload de Relatório</h2>
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

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
