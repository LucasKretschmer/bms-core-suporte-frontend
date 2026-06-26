import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { useLogin } from '../hooks/useLogin'
import { loginSchema, type LoginFormData } from '../types/authSchema'

/**
 * Formulário de login com React Hook Form + Zod.
 * Erros de campo → inline. Erros de API → toast (nunca inline — anti-enumeração).
 */
export function LoginForm() {
  const { mutate: submitLogin, isPending } = useLogin()
  const emailRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Foca o primeiro campo ao montar
  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  function onSubmit(data: LoginFormData) {
    submitLogin({ email: data.email, password: data.password })
  }

  const isDisabled = isSubmitting || isPending

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <Input
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
        ref={(el) => {
          // Combina o ref do register com o nosso emailRef para autofocus
          register('email').ref(el)
          ;(emailRef as React.MutableRefObject<HTMLInputElement | null>).current = el
        }}
      />
      <Input
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <Button
        type="submit"
        isLoading={isDisabled}
        disabled={isDisabled}
        className="w-full mt-2"
      >
        Entrar
      </Button>
    </form>
  )
}
