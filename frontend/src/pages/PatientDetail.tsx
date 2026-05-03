import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { patientsApi, prescriptionsApi, examsApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Badge, PrescriptionStatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { calcAge, calcBmi, getBmiColorClasses, getBmiLabel, formatDate, toInputDate } from '../utils/format'
import type { Patient, Prescription, ExamResult } from '../types'

type TabKey = 'dados' | 'exames' | 'prescricoes'

function ExamModal({ exam, onClose }: { exam: ExamResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">
              {exam.input_method === 'upload' ? 'Upload' : exam.input_method === 'form' ? 'Formulario' : 'Texto livre'}
            </span>
            <span className="text-xs text-gray-400">{formatDate(exam.created_at)}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {exam.raw_text ? (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{exam.raw_text}</pre>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sem texto disponivel.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function BmiChip({ bmi }: { bmi: number | null }) {
  if (bmi === null) return null
  return (
    <span className={['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', getBmiColorClasses(bmi)].join(' ')}>
      IMC: {bmi} — {getBmiLabel(bmi)}
    </span>
  )
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [exams, setExams] = useState<ExamResult[]>([])
  const [tab, setTab] = useState<TabKey>('dados')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Patient>>({})
  const [selectedExam, setSelectedExam] = useState<ExamResult | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [pt, prescrs, exmns] = await Promise.all([
        patientsApi.getPatient(id),
        prescriptionsApi.getPrescriptions(id),
        examsApi.getExams(id),
      ])
      setPatient(pt)
      setEditForm(pt)
      setPrescriptions(prescrs)
      setExams(exmns)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar paciente'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [id]) // toast excluído intencionalmente — referência instável causava loop

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!id || !patient) return
    setSaving(true)
    try {
      const updated = await patientsApi.updatePatient(id, {
        name: editForm.name,
        birth_date: editForm.birth_date,
        gender: editForm.gender,
        weight_kg: editForm.weight_kg,
        height_cm: editForm.height_cm,
        main_complaints: editForm.main_complaints,
        therapeutic_objective: editForm.therapeutic_objective,
        current_medications: editForm.current_medications,
        lifestyle: editForm.lifestyle,
        doctor_notes: editForm.doctor_notes,
      })
      setPatient(updated)
      setEditForm(updated)
      setEditing(false)
      toast.success('Dados atualizados com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await patientsApi.deletePatient(id)
      toast.success('Paciente removido.')
      navigate('/pacientes')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao deletar paciente'
      toast.error(msg)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner label="Carregando paciente..." />
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

  const age = calcAge(patient.birth_date)
  const bmi = calcBmi(patient.weight_kg, patient.height_cm)

  const setField = (field: keyof Patient) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setEditForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate('/pacientes')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Pacientes
      </button>

      {/* Patient header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {age !== null && (
                <Badge>{age} anos</Badge>
              )}
              {patient.gender && (
                <Badge variant="info">{patient.gender}</Badge>
              )}
              {bmi !== null && (
                <BmiChip bmi={bmi} />
              )}
            </div>
            {patient.therapeutic_objective && (
              <p className="text-sm text-gray-600 mt-2 max-w-lg">{patient.therapeutic_objective}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
            <Button onClick={() => navigate(`/prescricoes/nova/${patient.id}`)}>
              + Nova prescricao
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de confirmacao de delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Deletar paciente?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Isso vai remover <strong>{patient.name}</strong> e todos os exames e prescricoes vinculados. Essa acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                size="sm"
                loading={deleting}
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
              >
                Deletar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 -mb-1">
        <div className="flex gap-1">
          <TabButton active={tab === 'dados'} onClick={() => setTab('dados')}>Dados</TabButton>
          <TabButton active={tab === 'exames'} onClick={() => setTab('exames')}>
            Exames {exams.length > 0 && `(${exams.length})`}
          </TabButton>
          <TabButton active={tab === 'prescricoes'} onClick={() => setTab('prescricoes')}>
            Prescricoes {prescriptions.length > 0 && `(${prescriptions.length})`}
          </TabButton>
        </div>
      </div>

      {/* Tab: Dados */}
      {tab === 'dados' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dados do Paciente</h2>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditForm(patient) }}>
                  Cancelar
                </Button>
                <Button size="sm" loading={saving} onClick={handleSave}>
                  Salvar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {editing ? (
              <>
                <Input label="Nome" name="name" value={editForm.name || ''} onChange={setField('name')} required />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input label="Data de nascimento" type="date" name="birth_date"
                      value={toInputDate(editForm.birth_date)} onChange={setField('birth_date')} />
                    {editForm.birth_date && (
                      <p className="text-xs text-gray-500 mt-1">{calcAge(editForm.birth_date)} anos</p>
                    )}
                  </div>
                  <Select label="Genero" name="gender" value={editForm.gender || ''} onChange={setField('gender')}>
                    <option value="">Selecione</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="outro">Outro</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Peso (kg)" type="number" name="weight_kg"
                    value={editForm.weight_kg?.toString() || ''} onChange={setField('weight_kg')} />
                  <Input label="Altura (cm)" type="number" name="height_cm"
                    value={editForm.height_cm?.toString() || ''} onChange={setField('height_cm')} />
                </div>
                <Textarea label="Queixas principais" name="main_complaints"
                  value={editForm.main_complaints || ''} onChange={setField('main_complaints')} rows={3} />
                <Textarea label="Objetivo terapeutico" name="therapeutic_objective"
                  value={editForm.therapeutic_objective || ''} onChange={setField('therapeutic_objective')} rows={2} />
                <Textarea label="Medicamentos em uso" name="current_medications"
                  value={editForm.current_medications || ''} onChange={setField('current_medications')} rows={3} />
                <Textarea label="Estilo de vida" name="lifestyle"
                  value={editForm.lifestyle || ''} onChange={setField('lifestyle')} rows={2} />
                <Textarea label="Notas internas" name="doctor_notes"
                  value={editForm.doctor_notes || ''} onChange={setField('doctor_notes')} rows={2}
                  hint="Este campo nao aparece na prescricao gerada." />
              </>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Data de nascimento', value: `${formatDate(patient.birth_date)}${age !== null ? ` (${age} anos)` : ''}` },
                  { label: 'Genero', value: patient.gender || '—' },
                  { label: 'Peso', value: patient.weight_kg ? `${patient.weight_kg} kg` : '—' },
                  { label: 'Altura', value: patient.height_cm ? `${patient.height_cm} cm` : '—' },
                  { label: 'IMC', value: bmi ? `${bmi} — ${getBmiLabel(bmi)}` : '—' },
                  { label: 'Queixas principais', value: patient.main_complaints || '—' },
                  { label: 'Objetivo terapeutico', value: patient.therapeutic_objective || '—' },
                  { label: 'Medicamentos em uso', value: patient.current_medications || '—' },
                  { label: 'Estilo de vida', value: patient.lifestyle || '—' },
                  { label: 'Notas internas', value: patient.doctor_notes || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-3 gap-2">
                    <dt className="text-xs font-medium text-gray-500">{label}</dt>
                    <dd className="col-span-2 text-sm text-gray-800 whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab: Exames */}
      {tab === 'exames' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => navigate(`/pacientes/${patient.id}/exames`)}>
              Inserir exame
            </Button>
          </div>
          {exams.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-gray-500 py-6">
                Nenhum exame registrado para este paciente.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {exams.map(exam => (
                <Card
                  key={exam.id}
                  className="cursor-pointer hover:shadow-card-hover transition-shadow"
                  onClick={() => setSelectedExam(exam)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">
                          {exam.input_method === 'upload' ? 'Upload' : exam.input_method === 'form' ? 'Formulario' : 'Texto livre'}
                        </Badge>
                        <span className="text-xs text-gray-400">{formatDate(exam.created_at)}</span>
                      </div>
                      {exam.raw_text && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{exam.raw_text.slice(0, 180)}…</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-300 ml-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {selectedExam && <ExamModal exam={selectedExam} onClose={() => setSelectedExam(null)} />}
        </div>
      )}

      {/* Tab: Prescricoes */}
      {tab === 'prescricoes' && (
        <div className="space-y-3">
          {prescriptions.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-gray-500">Nenhuma prescricao gerada ainda.</p>
                <Button onClick={() => navigate(`/prescricoes/nova/${patient.id}`)}>
                  + Nova prescricao
                </Button>
              </div>
            </Card>
          ) : (
            prescriptions.map(rx => (
              <Card key={rx.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <PrescriptionStatusBadge status={rx.status} />
                      <span className="text-xs text-gray-400">{formatDate(rx.created_at)}</span>
                    </div>
                    {rx.output_text && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                        {rx.output_text.slice(0, 100)}...
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/prescricoes/${rx.id}`)}
                  >
                    Ver
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
