import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { patientsApi, prescriptionsApi, examsApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import { calcAge, calcBmi, formatDate } from '../utils/format'
import type { Patient, ExamResult, Prescription, ChatMessage } from '../types'

type Step = 1 | 2 | 3

const LOADING_TEXTS = [
  'Analisando o perfil do paciente...',
  'Verificando interacoes entre ativos...',
  'Consultando protocolos clinicos...',
  'Montando as 11 secoes da prescricao...',
  'Aplicando alertas de seguranca...',
]

function extractAlertas(text: string): string[] {
  const regex = /\[ALERTA\][^\n]*/gi
  return (text.match(regex) || []).map(a => a.replace(/\[ALERTA\]\s*/i, '').trim())
}

function bold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function renderPrescriptionHtml(text: string): string {
  if (!text) return ''
  // Already HTML — pass through directly (e.g. saved via Tiptap)
  if (text.trimStart().startsWith('<')) return text
  return text
    .split('\n')
    .map(line => {
      if (/\[ALERTA\]/i.test(line)) {
        const content = bold(line.replace(/\[ALERTA\]\s*/i, '').trim())
        return `<div class="alerta-block">[ALERTA] ${content}</div>`
      }
      if (line.startsWith('### ')) return `<h3>${bold(line.slice(4))}</h3>`
      if (line.startsWith('## ')) return `<h2>${bold(line.slice(3))}</h2>`
      if (line.startsWith('# ')) return `<h1>${bold(line.slice(2))}</h1>`
      // Whole-line **bold** → section heading
      if (/^\*\*[^*]+\*\*$/.test(line.trim())) return `<h3>${line.trim().slice(2, -2)}</h3>`
      if (line.trim() === '---') return '<hr>'
      if (line.trim() === '') return '<p></p>'
      return `<p>${bold(line)}</p>`
    })
    .join('')
}

// ─── Step 1: Contexto ─────────────────────────────────────────────────────────

function Step1View({
  patient,
  lastExam,
  lastPrescriptions,
  onGenerate,
}: {
  patient: Patient
  lastExam: ExamResult | null
  lastPrescriptions: Prescription[]
  onGenerate: (context: string) => Promise<void>
}) {
  const [extraContext, setExtraContext] = useState('')
  const [loading, setLoading] = useState(false)
  const age = calcAge(patient.birth_date)
  const bmi = calcBmi(patient.weight_kg, patient.height_cm)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      await onGenerate(extraContext)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900">Nova Prescricao</h2>

      {/* Patient summary */}
      <Card>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Paciente</h3>
        <p className="text-base font-semibold text-gray-900">{patient.name}</p>
        <p className="text-sm text-gray-500">
          {age !== null ? `${age} anos` : '—'}
          {bmi !== null ? ` · IMC ${bmi}` : ''}
        </p>
        {patient.therapeutic_objective && (
          <p className="text-sm text-gray-600 mt-2 italic">{patient.therapeutic_objective}</p>
        )}
      </Card>

      {/* Last exam */}
      <Card>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ultimo exame</h3>
        {lastExam ? (
          <div>
            <p className="text-sm font-medium text-gray-800">{formatDate(lastExam.created_at)}</p>
            {lastExam.raw_text && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{lastExam.raw_text.slice(0, 100)}...</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nenhum exame registrado</p>
        )}
      </Card>

      {/* History */}
      <Card>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historico</h3>
        {lastPrescriptions.length === 0 ? (
          <p className="text-sm text-gray-400">Primeira prescricao para este paciente</p>
        ) : (
          <div className="space-y-2">
            {lastPrescriptions.map(rx => (
              <div key={rx.id} className="flex items-center gap-2">
                <Badge variant={rx.status === 'final' ? 'success' : 'warning'}>
                  {rx.status === 'final' ? 'Finalizada' : 'Rascunho'}
                </Badge>
                <span className="text-xs text-gray-500">{formatDate(rx.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
        <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-700">A IA usara todos estes dados automaticamente na geracao da prescricao.</p>
      </div>

      {/* Extra context */}
      <Textarea
        label="Contexto adicional (opcional)"
        value={extraContext}
        onChange={e => setExtraContext(e.target.value)}
        placeholder="Adicione observacoes especificas para esta prescricao (ex: aumentar dose de testosterona, focar em emagrecimento...)"
        rows={3}
      />

      <Button size="lg" onClick={handleGenerate} loading={loading} fullWidth>
        Gerar prescricao
      </Button>
    </div>
  )
}

// ─── Step 2: Loading ──────────────────────────────────────────────────────────

function Step2View() {
  const [textIdx, setTextIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIdx(i => (i + 1) % LOADING_TEXTS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Medrion</h1>
        <p className="text-sm text-gray-400">Gerando sua prescricao</p>
      </div>

      <div className="relative">
        <svg className="w-16 h-16 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <div className="h-6 flex items-center">
        <p
          key={textIdx}
          className="text-sm text-gray-600 text-center transition-all duration-500 animate-pulse"
        >
          {LOADING_TEXTS[textIdx]}
        </p>
      </div>
    </div>
  )
}

// ─── Step 3: Result ───────────────────────────────────────────────────────────

interface Step3Props {
  prescription: Prescription
  patient: Patient
  onUpdate: (rx: Prescription) => void
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
        >
          <svg
            className={['w-7 h-7 transition-colors', star <= value ? 'text-yellow-400' : 'text-gray-300'].join(' ')}
            fill={star <= value ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export function Step3View({ prescription, patient, onUpdate }: Step3Props) {
  const toast = useToast()
  const [content, setContent] = useState(prescription.edited_output || prescription.output_text || '')
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [rating, setRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const isFinalized = prescription.status === 'final'

  const alertas = extractAlertas(content)

  const editor = useEditor({
    extensions: [StarterKit],
    content: renderPrescriptionHtml(content),
    editable: !isFinalized,
    onUpdate: ({ editor }) => {
      setContent(editor.getText({ blockSeparator: '\n' }))
    },
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      const updated = await prescriptionsApi.updatePrescription(prescription.id, {
        edited_output: editor?.getHTML() || content,
      })
      onUpdate(updated)
      toast.success('Rascunho salvo!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      await prescriptionsApi.updatePrescription(prescription.id, {
        edited_output: editor?.getHTML() || content,
      })
      const updated = await prescriptionsApi.finalizePrescription(prescription.id)
      onUpdate(updated)
      editor?.setEditable(false)
      toast.success('Prescricao finalizada!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao finalizar'
      toast.error(msg)
    } finally {
      setFinalizing(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await prescriptionsApi.downloadPrescription(prescription.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prescricao_${patient.name.replace(/\s+/g, '_')}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao baixar'
      toast.error(msg)
    } finally {
      setDownloading(false)
    }
  }

  const handleFeedback = async () => {
    if (rating === 0) {
      toast.error('Selecione uma avaliacao.')
      return
    }
    try {
      await prescriptionsApi.submitFeedback(prescription.id, { rating, comment: feedbackComment })
      setFeedbackSent(true)
      toast.success('Avaliacao enviada. Obrigado!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar avaliacao'
      toast.error(msg)
    }
  }

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return
    const msg = chatMessage.trim()
    setChatMessage('')
    setChatHistory(prev => [...prev, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const currentText = editor?.getHTML() || content
      const res = await prescriptionsApi.sendChat(prescription.id, msg, currentText)
      if (res.new_text && editor) {
        editor.commands.setContent(renderPrescriptionHtml(res.new_text))
        setChatHistory(prev => [...prev, { role: 'assistant', content: 'Prescricao atualizada!' }])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no chat'
      toast.error(msg)
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Disclaimer banner */}
      <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-gray-600">
          O Medrion e um assistente de prescricao. A decisao clinica final e a responsabilidade legal sao do medico prescritor.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        {/* LEFT: Editor */}
        <div className="space-y-3">
          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Prescricao</h2>
              {isFinalized && <Badge variant="success">Finalizada</Badge>}
            </div>
            <div className="relative overflow-auto max-h-[60vh]">
              <EditorContent editor={editor} />
              {chatLoading && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-b-lg">
                  <svg className="animate-spin w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-sm font-medium text-primary">Atualizando prescricao...</p>
                </div>
              )}
            </div>
            {!isFinalized && (
              <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                <Button variant="secondary" size="sm" onClick={handleSaveDraft} loading={saving}>
                  Salvar rascunho
                </Button>
                <Button size="sm" onClick={handleFinalize} loading={finalizing}>
                  Finalizar prescricao
                </Button>
              </div>
            )}
          </Card>

          {/* Chat MODO ATUALIZAÇÃO */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Modo Atualizacao (Chat)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {chatHistory.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Use o chat para solicitar ajustes na prescricao gerada.
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={[
                    'rounded-lg px-3 py-2 text-xs max-w-[85%]',
                    msg.role === 'user'
                      ? 'bg-primary text-white ml-auto'
                      : 'bg-bg-secondary text-gray-700',
                  ].join(' ')}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="bg-bg-secondary rounded-lg px-3 py-2 text-xs text-gray-400 max-w-[85%] animate-pulse">
                  Processando...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                placeholder="Ex: Adicione magnesio 400mg na secao 3"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={chatLoading}
              />
              <Button size="sm" onClick={handleSendChat} loading={chatLoading} disabled={!chatMessage.trim()}>
                Enviar
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT: Handoff panel */}
        <div className="space-y-4">
          {/* Alertas */}
          {alertas.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-danger uppercase tracking-wide">
                  Alertas de Seguranca
                </h3>
                <span className="text-xs font-semibold text-white bg-danger rounded-full px-2 py-0.5">
                  {alertas.length}
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {alertas.map((a, i) => (
                  <div key={i} className="alerta-block text-sm">
                    {a}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Retorno */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Retorno Recomendado
            </h3>
            <p className="text-2xl font-bold text-primary">60 dias</p>
          </Card>

          {/* Download */}
          <Button fullWidth onClick={handleDownload} loading={downloading} size="lg">
            Baixar .docx
          </Button>

          {/* Feedback */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Avalie esta prescricao
            </h3>
            {feedbackSent ? (
              <p className="text-sm text-success font-medium">Avaliacao enviada. Obrigado!</p>
            ) : (
              <div className="space-y-3">
                <StarRating value={rating} onChange={setRating} />
                <Textarea
                  placeholder="Comentario opcional..."
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  rows={2}
                />
                <Button variant="secondary" size="sm" fullWidth onClick={handleFeedback}>
                  Enviar avaliacao
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewPrescription() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState<Step>(1)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [lastExam, setLastExam] = useState<ExamResult | null>(null)
  const [lastPrescriptions, setLastPrescriptions] = useState<Prescription[]>([])
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!patientId) return
      setLoading(true)
      try {
        const [pt, exmns, prscrs] = await Promise.all([
          patientsApi.getPatient(patientId),
          examsApi.getExams(patientId),
          prescriptionsApi.getPrescriptions(patientId),
        ])
        setPatient(pt)
        setLastExam(exmns[0] || null)
        setLastPrescriptions(prscrs.slice(0, 2))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados'
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  const handleGenerate = useCallback(async (extraContext: string) => {
    if (!patientId) return
    setStep(2)
    try {
      const rx = await prescriptionsApi.generatePrescription({
        patient_id: patientId,
        extra_context: extraContext || undefined,
      })
      setPrescription(rx)
      setStep(3)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar prescricao'
      toast.error(msg)
      setStep(1)
    }
  }, [patientId])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500">Paciente nao encontrado.</p>
        <Button className="mt-4" onClick={() => navigate('/pacientes')}>Voltar</Button>
      </div>
    )
  }

  return (
    <div>
      {/* Back button (only in step 1) */}
      {step === 1 && (
        <button
          onClick={() => navigate(`/pacientes/${patientId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {patient.name}
        </button>
      )}

      {step === 1 && (
        <Step1View
          patient={patient}
          lastExam={lastExam}
          lastPrescriptions={lastPrescriptions}
          onGenerate={handleGenerate}
        />
      )}

      {step === 2 && <Step2View />}

      {step === 3 && prescription && (
        <Step3View
          prescription={prescription}
          patient={patient}
          onUpdate={updated => setPrescription(updated)}
        />
      )}
    </div>
  )
}
