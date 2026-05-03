import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { examsApi, patientsApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Textarea, Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { formatDate } from '../utils/format'
import type { ExamResult, Patient } from '../types'

type TabKey = 'upload' | 'form' | 'texto'

const EXAM_PANELS = [
  {
    key: 'hematologico', label: 'Hematologico',
    fields: [
      { key: 'hemoglobina', label: 'Hemoglobina', unit: 'g/dL' },
      { key: 'hematocrito', label: 'Hematocrito', unit: '%' },
      { key: 'leucocitos', label: 'Leucocitos', unit: '/mm³' },
      { key: 'plaquetas', label: 'Plaquetas', unit: '/mm³' },
    ],
  },
  {
    key: 'metabolico', label: 'Metabolico',
    fields: [
      { key: 'glicemia_jejum', label: 'Glicemia de jejum', unit: 'mg/dL' },
      { key: 'insulina', label: 'Insulina', unit: 'μUI/mL' },
      { key: 'hba1c', label: 'HbA1c', unit: '%' },
    ],
  },
  {
    key: 'lipidico', label: 'Lipidico',
    fields: [
      { key: 'colesterol_total', label: 'Colesterol total', unit: 'mg/dL' },
      { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
      { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
      { key: 'triglicerideos', label: 'Triglicerideos', unit: 'mg/dL' },
    ],
  },
  {
    key: 'hormonal_m', label: 'Hormonal Masculino',
    fields: [
      { key: 'testosterona_total', label: 'Testosterona total', unit: 'ng/dL' },
      { key: 'testosterona_livre', label: 'Testosterona livre', unit: 'pg/mL' },
      { key: 'lh', label: 'LH', unit: 'mUI/mL' },
      { key: 'fsh', label: 'FSH', unit: 'mUI/mL' },
      { key: 'prolactina', label: 'Prolactina', unit: 'ng/mL' },
    ],
  },
  {
    key: 'hormonal_f', label: 'Hormonal Feminino',
    fields: [
      { key: 'estradiol', label: 'Estradiol', unit: 'pg/mL' },
      { key: 'progesterona', label: 'Progesterona', unit: 'ng/mL' },
      { key: 'shbg', label: 'SHBG', unit: 'nmol/L' },
      { key: 'dhea_s', label: 'DHEA-S', unit: 'μg/dL' },
    ],
  },
  {
    key: 'tireoide', label: 'Tireoide',
    fields: [
      { key: 'tsh', label: 'TSH', unit: 'μUI/mL' },
      { key: 't4_livre', label: 'T4 livre', unit: 'ng/dL' },
      { key: 't3_livre', label: 'T3 livre', unit: 'pg/mL' },
    ],
  },
  {
    key: 'vitaminas', label: 'Vitaminas e Minerais',
    fields: [
      { key: 'vitamina_d', label: 'Vitamina D (25-OH)', unit: 'ng/mL' },
      { key: 'vitamina_b12', label: 'Vitamina B12', unit: 'pg/mL' },
      { key: 'ferritina', label: 'Ferritina', unit: 'ng/mL' },
      { key: 'magnesio', label: 'Magnesio', unit: 'mg/dL' },
      { key: 'zinco', label: 'Zinco', unit: 'μg/dL' },
    ],
  },
  {
    key: 'hepatico', label: 'Funcao Hepatica',
    fields: [
      { key: 'tgo', label: 'TGO (AST)', unit: 'U/L' },
      { key: 'tgp', label: 'TGP (ALT)', unit: 'U/L' },
      { key: 'ggt', label: 'GGT', unit: 'U/L' },
      { key: 'bilirrubina', label: 'Bilirrubina total', unit: 'mg/dL' },
    ],
  },
  {
    key: 'renal', label: 'Funcao Renal',
    fields: [
      { key: 'creatinina', label: 'Creatinina', unit: 'mg/dL' },
      { key: 'ureia', label: 'Ureia', unit: 'mg/dL' },
      { key: 'acido_urico', label: 'Acido urico', unit: 'mg/dL' },
    ],
  },
  {
    key: 'inflamacao', label: 'Inflamacao',
    fields: [
      { key: 'pcr', label: 'PCR (ultrassensivel)', unit: 'mg/L' },
      { key: 'vhs', label: 'VHS', unit: 'mm/h' },
      { key: 'homocisteina', label: 'Homocisteina', unit: 'μmol/L' },
    ],
  },
]

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
        active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function UploadTab({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
    if (!ALLOWED.includes(f.type)) {
      toast.error('Formato nao permitido. Use PDF, DOCX, JPG ou PNG.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Maximo 10MB.')
      return
    }
    setFile(f)
    setUploading(true)
    try {
      const res = await examsApi.uploadExamFile(f, patientId)
      setExtractedText(res.extracted_text || '')
      toast.success('Arquivo processado com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleConfirm = async () => {
    if (!extractedText.trim()) {
      toast.error('Nenhum texto para salvar.')
      return
    }
    setSaving(true)
    try {
      await examsApi.confirmExam({
        patient_id: patientId,
        raw_text: extractedText,
        file_type: file?.type,
      })
      toast.success('Exame salvo com sucesso!')
      setFile(null)
      setExtractedText('')
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar exame'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-150',
          dragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50',
          uploading ? 'pointer-events-none opacity-70' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,image/jpeg,image/png"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {uploading ? (
          <LoadingSpinner label="Processando arquivo..." />
        ) : (
          <>
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-600">
              {file ? file.name : 'Arraste e solte ou clique para selecionar'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, JPG, PNG — max. 10MB</p>
          </>
        )}
      </div>

      {extractedText && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Texto extraido — revise antes de salvar:</p>
          <Textarea
            value={extractedText}
            onChange={e => setExtractedText(e.target.value)}
            rows={10}
          />
          <div className="flex justify-end">
            <Button onClick={handleConfirm} loading={saving}>
              Confirmar e salvar exame
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function FormTab({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, { value: string; date: string }>>({})
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const toggle = (key: string) => setOpenPanels(prev => ({ ...prev, [key]: !prev[key] }))

  const setVal = (fieldKey: string, prop: 'value' | 'date', v: string) => {
    setValues(prev => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], value: prev[fieldKey]?.value || '', date: prev[fieldKey]?.date || '', [prop]: v },
    }))
  }

  const handleSave = async () => {
    const structured: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v.value) structured[k] = { value: v.value, date: v.date }
    }
    if (Object.keys(structured).length === 0) {
      toast.error('Preencha pelo menos um campo.')
      return
    }
    setSaving(true)
    try {
      const text = Object.entries(structured)
        .map(([k, v]: [string, unknown]) => {
          const field = EXAM_PANELS.flatMap(p => p.fields).find(f => f.key === k)
          const val = v as { value: string; date: string }
          return `${field?.label || k}: ${val.value}${field?.unit ? ' ' + field.unit : ''}${val.date ? ` (${val.date})` : ''}`
        })
        .join('\n')
      await examsApi.createExam({
        patient_id: patientId,
        input_method: 'form',
        raw_text: text,
        structured_data: structured,
      })
      toast.success('Exame salvo com sucesso!')
      setValues({})
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {EXAM_PANELS.map(panel => (
        <div key={panel.key} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggle(panel.key)}
            className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-gray-200 transition-colors text-left"
          >
            <span className="text-sm font-medium text-gray-800">{panel.label}</span>
            <svg
              className={['w-4 h-4 text-gray-500 transition-transform duration-200', openPanels[panel.key] ? 'rotate-180' : ''].join(' ')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openPanels[panel.key] && (
            <div className="px-4 py-4 space-y-3">
              {panel.fields.map(field => (
                <div key={field.key} className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-xs text-gray-600 font-medium">
                    {field.label} {field.unit && <span className="text-gray-400">({field.unit})</span>}
                  </label>
                  <Input
                    type="number"
                    name={`val_${field.key}`}
                    placeholder="Valor"
                    value={values[field.key]?.value || ''}
                    onChange={e => setVal(field.key, 'value', e.target.value)}
                  />
                  <Input
                    type="date"
                    name={`date_${field.key}`}
                    value={values[field.key]?.date || ''}
                    onChange={e => setVal(field.key, 'date', e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} loading={saving}>
          Salvar exames
        </Button>
      </div>
    </div>
  )
}

function TextTab({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error('Digite o texto dos exames.')
      return
    }
    setSaving(true)
    try {
      await examsApi.createExam({
        patient_id: patientId,
        input_method: 'text',
        raw_text: text,
      })
      toast.success('Exame salvo com sucesso!')
      setText('')
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        label="Resultados dos exames"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Cole aqui os resultados dos exames ou digite os valores..."
        rows={12}
      />
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Salvar exame
        </Button>
      </div>
    </div>
  )
}

export default function Exams() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>('upload')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [exams, setExams] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)

  const loadExams = useCallback(async () => {
    if (!patientId) return
    try {
      const data = await examsApi.getExams(patientId)
      setExams(data)
    } catch {}
  }, [patientId])

  useEffect(() => {
    const load = async () => {
      if (!patientId) return
      setLoading(true)
      try {
        const [pt, exmns] = await Promise.all([
          patientsApi.getPatient(patientId),
          examsApi.getExams(patientId),
        ])
        setPatient(pt)
        setExams(exmns)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados'
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId, toast])

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>

  return (
    <div className="space-y-5 max-w-2xl">
      <button
        onClick={() => navigate(`/pacientes/${patientId}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {patient?.name || 'Paciente'}
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Inserir Exames</h1>

      <Card>
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-5 -mx-4 px-4">
          <div className="flex gap-1">
            <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>Upload</TabButton>
            <TabButton active={tab === 'form'} onClick={() => setTab('form')}>Formulario Estruturado</TabButton>
            <TabButton active={tab === 'texto'} onClick={() => setTab('texto')}>Texto Livre</TabButton>
          </div>
        </div>

        {patientId && tab === 'upload' && <UploadTab patientId={patientId} onSaved={loadExams} />}
        {patientId && tab === 'form' && <FormTab patientId={patientId} onSaved={loadExams} />}
        {patientId && tab === 'texto' && <TextTab patientId={patientId} onSaved={loadExams} />}
      </Card>

      {/* Exam history */}
      {exams.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">Historico de exames</h2>
          {exams.map(exam => (
            <Card key={exam.id}>
              <div className="flex items-start gap-3">
                <Badge variant="info">
                  {exam.input_method === 'upload' ? 'Upload' : exam.input_method === 'form' ? 'Formulario' : 'Texto'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1">{formatDate(exam.created_at)}</p>
                  {exam.raw_text && (
                    <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-line">{exam.raw_text.slice(0, 300)}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
