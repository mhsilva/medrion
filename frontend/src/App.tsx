import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import PharmacyOnboarding from './pages/PharmacyOnboarding'
import PharmacyDashboard from './pages/PharmacyDashboard'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import NewPatient from './pages/NewPatient'
import PatientDetail from './pages/PatientDetail'
import Exams from './pages/Exams'
import NewPrescription from './pages/NewPrescription'
import PrescriptionDetail from './pages/PrescriptionDetail'
import Profile from './pages/Profile'
import Checkout from './pages/Checkout'
import PaymentPending from './pages/PaymentPending'
import VerifyOtp from './pages/VerifyOtp'
import Admin from './pages/Admin'

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['doctor', 'admin']}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/verificar-codigo" element={<VerifyOtp />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/onboarding/farmacia" element={<PharmacyOnboarding />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pagamento-pendente"
            element={
              <ProtectedRoute allowedRoles={['doctor', 'pharmacy_admin', 'admin']}>
                <PaymentPending />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pacientes"
            element={
              <ProtectedLayout>
                <Patients />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pacientes/novo"
            element={
              <ProtectedLayout>
                <NewPatient />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pacientes/:id"
            element={
              <ProtectedLayout>
                <PatientDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pacientes/:patientId/exames"
            element={
              <ProtectedLayout>
                <Exams />
              </ProtectedLayout>
            }
          />
          <Route
            path="/prescricoes/nova/:patientId"
            element={
              <ProtectedLayout>
                <NewPrescription />
              </ProtectedLayout>
            }
          />
          <Route
            path="/prescricoes/:id"
            element={
              <ProtectedLayout>
                <PrescriptionDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedLayout>
                <Profile />
              </ProtectedLayout>
            }
          />

          {/* Admin */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Admin />
              </ProtectedRoute>
            }
          />

          {/* Pharmacy protected route */}
          <Route
            path="/farmacia/dashboard"
            element={
              <ProtectedRoute allowedRoles={['pharmacy_admin', 'admin']}>
                <PharmacyDashboard />
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
