import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { getCategoryMutationErrorMessage } from '../utils/categoryErrorMessage'
import {
  editCategorySchema,
  type EditCategoryFormValues,
  type ServiceCategoryDto,
} from '../types/serviceCategory'

type EditCategoryModalProps = {
  /** Categoria em edição — `null` mantém o modal fechado. */
  category: ServiceCategoryDto | null
  /**
   * Renomeia e **rejeita** em caso de falha (use `mutateAsync`). A rejeição é o que
   * mantém o modal aberto com o erro inline — sem ela o 409 fecharia o modal como se
   * tivesse dado certo.
   *
   * Recebe a `category` de volta (em vez de o pai ler o próprio estado) para que o `id`
   * venha do MESMO valor já estreitado para não-nulo aqui — sem fallback tipo `?? 0`,
   * que viraria um PUT em id inexistente.
   */
  onRename: (category: ServiceCategoryDto, nome: string) => Promise<unknown>
  onClose: () => void
}

/**
 * Modal de renomear categoria (123/FE-2 · D6/A6). RHF + Zod (`editCategorySchema`);
 * o backend é a fonte definitiva.
 *
 * Contrato de erro: o toast é disparado por `useCategoryMutations.update.onError`; aqui
 * o mesmo texto aparece **inline**, e o modal **continua aberto** — é o que permite ao
 * usuário corrigir o nome sem reabrir e reescrever tudo.
 *
 * A reidratação (abrir a linha B depois da linha A) é **estrutural**: o formulário vive
 * num componente interno remontado por `key={category.id}`, então `defaultValues` e o
 * erro de API nascem certos. Um `useEffect` com `reset()` + `setApiError(null)` faria o
 * mesmo, mas reprova em `react-hooks/set-state-in-effect` e depende de a lista de
 * dependências continuar correta — a remontagem não tem lista de dependências para
 * envelhecer.
 */
export function EditCategoryModal({ category, onRename, onClose }: EditCategoryModalProps) {
  if (!category) return null
  return (
    <EditCategoryForm
      key={category.id}
      category={category}
      onRename={onRename}
      onClose={onClose}
    />
  )
}

type EditCategoryFormProps = {
  category: ServiceCategoryDto
  onRename: (category: ServiceCategoryDto, nome: string) => Promise<unknown>
  onClose: () => void
}

function EditCategoryForm({ category, onRename, onClose }: EditCategoryFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: { nome: category.nome },
  })

  async function onValid(values: EditCategoryFormValues) {
    setApiError(null)
    try {
      await onRename(category, values.nome)
      onClose()
    } catch (error) {
      setApiError(getCategoryMutationErrorMessage(error))
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title="Renomear categoria">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <Input
          id="editar-categoria-nome"
          label="Nome da categoria"
          required
          autoComplete="off"
          error={errors.nome?.message}
          {...register('nome')}
        />

        {apiError && (
          <p className="text-sm text-error-fg" role="alert">
            {apiError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
