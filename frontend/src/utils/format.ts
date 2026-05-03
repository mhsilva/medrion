/** Format a date string or Date to dd/mm/yyyy */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Calculate age from birth_date string */
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return null
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

/** Calculate BMI from weight (kg) and height (cm) */
export function calcBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm === 0) return null
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'

export function getBmiCategory(bmi: number | null): BmiCategory | null {
  if (bmi === null) return null
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

export function getBmiLabel(bmi: number | null): string {
  const cat = getBmiCategory(bmi)
  if (!cat) return '—'
  const labels: Record<BmiCategory, string> = {
    underweight: 'Abaixo do peso',
    normal: 'Peso normal',
    overweight: 'Sobrepeso',
    obese: 'Obesidade',
  }
  return labels[cat]
}

export function getBmiColorClasses(bmi: number | null): string {
  const cat = getBmiCategory(bmi)
  if (!cat) return 'bg-gray-100 text-gray-600'
  const colors: Record<BmiCategory, string> = {
    underweight: 'bg-blue-100 text-blue-700',
    normal: 'bg-green-100 text-green-700',
    overweight: 'bg-yellow-100 text-yellow-700',
    obese: 'bg-red-100 text-red-700',
  }
  return colors[cat]
}

/** Get greeting based on hour */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Difference in days between two dates */
export function differenceInDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

/** Truncate string to n chars */
export function truncate(str: string | null | undefined, n: number): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '...' : str
}

/** Brazilian state UFs */
export const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

/** Format date to yyyy-mm-dd (for input[type=date] value) */
export function toInputDate(date: string | null | undefined): string {
  if (!date) return ''
  return date.split('T')[0]
}
