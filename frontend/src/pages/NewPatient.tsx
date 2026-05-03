import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import { calcAge, calcBmi, getBmiColorClasses, getBmiLabel, toInputDate } from '../utils/format'

interface FormData {
  name: string
  birth_date: string
  gender: string
  weight_kg: string
  height_cm: string
  main_complaints: string
  therapeutic_objective: string
  current_medications: string
  lifestyle: string
  doctor_notes: string
}

interface FormErrors {
  name?: string
  birth_date?: string
  gender?: string
}

function BmiChip({ weight, height }: { weight: string; height: string }) {
  const bmi = calcBmi(
    weight ? parseFloat(weight) : null,
    height ? parseFloat(height) : null
  )
  if (bmi === null) return null
  const label = getBmiLabel(bmi)
  const colorClass = getBmiColorClasses(bmi)
  return (
    <span className={['inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', colorClass].join(' ')}>
      IMC: {bmi} — {label}
    </span>
  )
}

export default function NewPatient() {
  const [form, setForm] = useState<FormData>({
    name: '',
    birth_date: '',
    gender: '',
    weight_kg: '',
    height_cm: '',
    main_complaints: '',
    therapeutic_objective: '',
    current_medications: '',
    lifestyle: '',
    doctor_notes: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Nome obrigatório'
    if (!form.birth_date) errs.birth_date = 'Data de nascimento obrigatória'
    if (!form.gender) errs.gender = 'Gênero obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const patient = await patientsApi.createPatient({
        name: form.name.trim(),
        birth_date: form.birth_date,
        gender: form.gender as 'Masculino' | 'Feminino' | 'Outro',
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        main_complaints: form.main_complaints || null,
        therapeutic_objective: form.therapeutic_objective || null,
        current_medications: form.current_medications || null,
        lifestyle: form.lifestyle || null,
        doctor_notes: form.doctor_notes || null,
      })
      toast.success('Paciente cadastrado com sucesso!')
      navigate(`/pacientes/${patient.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar paciente'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const age = form.birth_date ? calcAge(form.birth_date) : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/pacientes')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Voltar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Novo paciente</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Bloco A */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            A — Identificacao do Paciente
          </h2>
          <div className="space-y-4">
            <Input
              label="Nome completo"
              name="name"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              required
              placeholder="Nome do paciente"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Data de nascimento"
                  type="date"
                  name="birth_date"
                  value={toInputDate(form.birth_date)}
                  onChange={set('birth_date')}
                  error={errors.birth_date}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
                {age !== null && (
                  <p className="text-xs text-gray-500 mt-1">{age} anos</p>
                )}
              </div>
              <Select
                label="Genero"
                name="gender"
                value={form.gender}
                onChange={set('gender')}
                error={errors.gender}
                required
              >
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="outro">Outro</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Peso (kg)"
                type="number"
                name="weight_kg"
                value={form.weight_kg}
                onChange={set('weight_kg')}
                placeholder="Ex: 75"
                min="1"
                max="500"
                step="0.1"
              />
              <Input
                label="Altura (cm)"
                type="number"
                name="height_cm"
                value={form.height_cm}
                onChange={set('height_cm')}
                placeholder="Ex: 175"
                min="50"
                max="250"
              />
            </div>

            {form.weight_kg && form.height_cm && (
              <div>
                <BmiChip weight={form.weight_kg} height={form.height_cm} />
              </div>
            )}
          </div>
        </Card>

        {/* Bloco B */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            B — Contexto Clinico
          </h2>
          <div className="space-y-4">
            <Textarea
              label="Queixas principais"
              name="main_complaints"
              value={form.main_complaints}
              onChange={set('main_complaints')}
              placeholder="Descreva as queixas e sintomas relatados pelo paciente..."
              rows={3}
            />
            <Textarea
              label="Objetivo terapeutico"
              name="therapeutic_objective"
              value={form.therapeutic_objective}
              onChange={set('therapeutic_objective')}
              placeholder="Qual o objetivo principal do tratamento?"
              rows={2}
            />
            <Textarea
              label="Medicamentos em uso"
              name="current_medications"
              value={form.current_medications}
              onChange={set('current_medications')}
              placeholder="Liste os medicamentos atuais com doses..."
              rows={3}
            />
            <Textarea
              label="Estilo de vida"
              name="lifestyle"
              value={form.lifestyle}
              onChange={set('lifestyle')}
              placeholder="Atividade fisica, alimentacao, sono, habitos..."
              rows={2}
            />
          </div>
        </Card>

        {/* Bloco C */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            C — Notas Internas
          </h2>
          <Textarea
            label="Anotacoes do medico"
            name="doctor_notes"
            value={form.doctor_notes}
            onChange={set('doctor_notes')}
            placeholder="Observacoes privadas, contexto adicional..."
            rows={3}
            hint="Este campo nao aparece na prescricao gerada."
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/pacientes')}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} size="lg">
            Salvar paciente
          </Button>
        </div>
      </form>
    </div>
  )
}
