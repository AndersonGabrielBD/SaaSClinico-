'use client'

import { useState } from 'react'
import { LifeBuoy, Send, Mail } from 'lucide-react'
import { api } from '@/lib/api'

const SUPPORT_EMAIL = 'emailclinicasaas655@gmail.com'

export default function SuportePage() {
  const [assunto, setAssunto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const mailtoHref = () => {
    const subj = encodeURIComponent(assunto.trim() || 'Problema no clinnext')
    const body = encodeURIComponent(descricao.trim() || '')
    return `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${body}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFeedback(null)
    if (descricao.trim().length < 10) {
      setFeedback({ type: 'error', text: 'Descreva o problema com pelo menos 10 caracteres.' })
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/suporte/report', {
        assunto: assunto.trim() || undefined,
        descricao: descricao.trim(),
      })
      setFeedback({
        type: 'success',
        text: res?.message || 'Recebemos seu relatório e vamos resolver o mais rápido possível.',
      })
      setAssunto('')
      setDescricao('')
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Não foi possível enviar. Tente novamente ou use o e-mail abaixo.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suporte</h1>
          <p className="page-subtitle">
            Encontrou um problema? Descreva o que aconteceu — enviamos para nossa equipe e
            responderemos o mais rápido possível.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <LifeBuoy className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Reportar um problema</h2>
              <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                O relatório é enviado automaticamente para o nosso time de suporte. Inclua o máximo de detalhes (tela, horário, o que você esperava).
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="suporte-assunto" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Assunto <span className="text-neutral-400 font-normal">(opcional)</span>
              </label>
              <input
                id="suporte-assunto"
                type="text"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex.: Erro ao salvar agendamento"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-shadow"
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="suporte-desc" className="block text-sm font-medium text-neutral-700 mb-1.5">
                O que aconteceu? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="suporte-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o passo a passo, mensagens de erro e o que você tentou fazer..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-shadow resize-y min-h-[140px]"
                maxLength={8000}
              />
              <p className="text-xs text-neutral-400 mt-1">{descricao.length} / 8000</p>
            </div>

            {feedback && (
              <div
                role="alert"
                className={`rounded-xl px-4 py-3 text-sm ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                    : 'bg-amber-50 text-amber-900 border border-amber-100'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:pointer-events-none transition-colors"
              >
                {loading ? (
                  'Enviando…'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar relatório
                  </>
                )}
              </button>
              <a
                href={mailtoHref()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Abrir no meu e-mail
              </a>
            </div>
          </form>
        </div>

        <div className="border-t border-neutral-100 px-6 py-4 bg-neutral-50/80">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Nossa equipe agradece o feedback — priorizamos correções que afetam o seu dia a dia na
            clínica.
          </p>
        </div>
      </div>
    </div>
  )
}
