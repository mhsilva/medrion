import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import NewPatient from './pages/NewPatient'
import PatientDetail from './pages/PatientDetail'
import Exams from './pages/Exams'
import NewPrescription from './pages/NewPrescription'
import PrescriptionDetail from './pages/PrescriptionDetail'
import Profile from './pages/Profile'

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
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
          <Route path="/onboarding" element={<Onboarding />} />

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

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
