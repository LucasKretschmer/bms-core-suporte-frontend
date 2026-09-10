import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Switch } from '../../../components/ui/Switch'
import { getCategoryMutationErrorMessage } from '../utils/categoryErrorMessage'
import {
  editCategorySchema,
  forcaCobrancaForaDoPlano,
  type EditCategoryFormValues,
  type ServiceCategoryDto,
} from '../types/serviceCategory'

/**
 * id do texto de apoio da flag (133). Constante para que o `<p>` e o `aria-describedby`
 * do switch venham da MESMA fonte — id digitado duas vezes é como o `aria-describedby`
 * fica órfão em silêncio (o atributo existe, aponta para o nada, e nenhum teste de
 * presença de texto percebe).
 */
const ID_APOIO_FORCA = 'editar-categoria-forca-apoio'

type EditCategoryModalProps = {
  /** Categoria em edição — `null` mantém o modal fechado. */
  category: ServiceCategoryDto | null
  /**
   * Salva (nome + flag 133) e **rejeita** em caso de falha (use `mutateAsync`). A rejeição
   * é o que mantém o modal aberto com o erro inline — sem ela o 409 fecharia o modal como
   * se tivesse dado certo.
   *
   * Recebe a `category` de volta (em vez de o pai ler o próprio estado) para que o `id`
   * venha do MESMO valor já estreitado para não-nulo aqui — sem fallback tipo `?? 0`,
   * que viraria um PUT em id inexistente.
   *
   * 133: recebe os **valores do formulário inteiro**, não só a string do nome — o form
   * passou a ter dois campos e passar só o nome mentiria sobre o contrato.
   */
  onSave: (category: ServiceCategoryDto, values: EditCategoryFormValues) => Promise<unknown>
  onClose: () => void
}

/**
 * Modal de editar categoria (123/FE-2 · D6/A6 · 133). RHF + Zod (`editCategorySchema`);
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
export function EditCategoryModal({ category, onSave, onClose }: EditCategoryModalProps) {
  if (!category) return null
  return (
    <EditCategoryForm key={category.id} category={category} onSave={onSave} onClose={onClose} />
  )
}

type EditCategoryFormProps = {
  category: ServiceCategoryDto
  onSave: (category: ServiceCategoryDto, values: EditCategoryFormValues) => Promise<unknown>
  onClose: () => void
}

function EditCategoryForm({ category, onSave, onClose }: EditCategoryFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
    // 133: a flag nasce com o valor ATUAL da linha. É este ponto que impede que editar só
    // o nome desligue a flag em silêncio — o form reenvia o valor carregado, e o PUT o
    // leva explícito.
    defaultValues: {
      nome: category.nome,
      forcesBillableOutsidePlan: forcaCobrancaForaDoPlano(category),
    },
  })

  const forcaCobranca = watch('forcesBillableOutsidePlan')

  async function onValid(values: EditCategoryFormValues) {
    setApiError(null)
    try {
      await onSave(category, values)
      onClose()
    } catch (error) {
      setApiError(getCategoryMutationErrorMessage(error))
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title="Editar categoria">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <Input
          id="editar-categoria-nome"
          label="Nome da categoria"
          required
          autoComplete="off"
          error={errors.nome?.message}
          {...register('nome')}
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Cobrar sempre fora do plano de suporte
            </p>
            <p id={ID_APOIO_FORCA} className="text-xs text-foreground/70">
              Apontamentos com esta categoria serão sempre marcados como cobrados fora do plano;
              o atendente não poderá desmarcar.
            </p>
          </div>
          <Switch
            label="Cobrar sempre fora do plano de suporte"
            checked={forcaCobranca}
            onChange={(checked) =>
              setValue('forcesBillableOutsidePlan', checked, { shouldDirty: true })
            }
            describedById={ID_APOIO_FORCA}
          />
        </div>

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
