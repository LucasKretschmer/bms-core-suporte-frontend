import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoginForm } from './components/LoginForm'

/**
 * Página de login — tela cheia, sem AppLayout.
 * Redireciona para / se já autenticado.
 */
export default function LoginPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const appName = import.meta.env.VITE_APP_NAME ?? 'BMS Core Suporte'

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/' })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl px-7 py-8">
        {/* Logo / título */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{appName}</h1>
          <p className="text-sm text-foreground/60 mt-1">Acesso restrito a colaboradores</p>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
