import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from './ui/Toast'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

function IconDashboard() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Painel', icon: <IconDashboard /> },
  { to: '/pacientes', label: 'Pacientes', icon: <IconUsers /> },
  { to: '/perfil', label: 'Perfil', icon: <IconUser /> },
]

const adminNavItems: NavItem[] = [
  { to: '/admin', label: 'Admin', icon: <IconShield />, adminOnly: true },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { error } = useToast()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch {
      error('Erro ao sair. Tente novamente.')
    }
  }

  const items = profile?.role === 'admin'
    ? [...navItems, ...adminNavItems]
    : navItems

  return (
    <div className="flex flex-col h-full bg-primary text-white">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-primary-light">
        <span className="text-xl font-bold tracking-tight">Medrion</span>
        {onClose && (
          <button onClick={onClose} className="text-white/70 hover:text-white lg:hidden">
            <IconClose />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary-light text-white'
                  : 'text-white/70 hover:bg-primary-light hover:text-white',
              ].join(' ')
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Doctor info + logout */}
      <div className="border-t border-primary-light px-4 py-4">
        {profile && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">{profile.name}</p>
            <p className="text-xs text-white/60 truncate">
              CRM {profile.crm}/{profile.crm_state}
            </p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors duration-150 w-full"
        >
          <IconLogout />
          Sair
        </button>
      </div>
    </div>
  )
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent onClose={onMobileClose} />
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      aria-label="Abrir menu"
    >
      <IconMenu />
    </button>
  )
}
