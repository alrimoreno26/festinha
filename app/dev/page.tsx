'use client'

// Vitrine dos componentes base (só em modo de simulação).

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  Dropzone,
  EmptyState,
  ENTITLEMENT_STATUS,
  EntitlementBadge,
  ErrorState,
  Field,
  Input,
  Modal,
  ORDER_STATUS,
  OrderStatusBadge,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  StatCard,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
} from '@/components/ui'
import { formatBRL, formatBytes } from '@/lib/format'
import { devToolsEnabled } from '@/lib/dev/settings'
import { ServiceError } from '@/lib/services'
import type { EntitlementStatus, OrderStatus } from '@/lib/types'
import { Package } from 'lucide-react'
import { notFound } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  )
}

export default function DevPage() {
  if (!devToolsEnabled) notFound()
  return <Showcase />
}

function Showcase() {
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [active, setActive] = useState(true)
  const [progress, setProgress] = useState(35)
  const [dropped, setDropped] = useState<File[]>([])

  useEffect(() => {
    const t = setInterval(() => setProgress((p) => (p >= 100 ? 0 : p + 5)), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <PageHeader
        title="Componentes"
        description="Base visual do backoffice e da área do cliente."
        actions={<ButtonLink href="/" variant="ghost">← Voltar ao site</ButtonLink>}
      />

      <Block title="Botões">
        <div className="flex flex-wrap gap-2">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger">Excluir</Button>
          <Button loading>Salvando</Button>
          <Button disabled>Desabilitado</Button>
          <Button size="sm">Pequeno</Button>
          <Button size="lg">Grande</Button>
        </div>
      </Block>

      <Block title="Formulário">
        <Card className="p-6 grid gap-4 sm:grid-cols-2">
          <Field label="Nome do pacote" hint="Aparece no catálogo.">
            <Input placeholder="Kit Safári" />
          </Field>
          <Field label="Preço" error="O preço mínimo é R$ 1,00.">
            <Input defaultValue="0,50" inputMode="decimal" />
          </Field>
          <Field label="Duração do acesso">
            <Select defaultValue="life">
              <option value="life">Vitalício</option>
              <option value="30">30 dias</option>
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Switch checked={active} onChange={setActive} label={active ? 'Ativo no catálogo' : 'Oculto'} />
          </div>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea placeholder="O que vem no kit…" />
          </Field>
        </Card>
      </Block>

      <Block title="Badges de estado">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
            <OrderStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ENTITLEMENT_STATUS) as EntitlementStatus[]).map((s) => (
            <EntitlementBadge key={s} status={s} />
          ))}
          <Badge tone="brand">Novo</Badge>
          <Badge tone="info">Pix</Badge>
        </div>
      </Block>

      <Block title="Métricas">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Receita (30 dias)" value={formatBRL(128_540)} hint="+12% vs. período anterior" />
          <StatCard label="Pedidos pagos" value="27" />
          <StatCard label="Pix pendentes" value="3" />
        </div>
      </Block>

      <Block title="Tabela">
        <Table>
          <THead>
            <tr>
              <TH>Pedido</TH>
              <TH>Cliente</TH>
              <TH>Pacote</TH>
              <TH className="text-right">Valor</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {[
              ['ord_1001', 'Maria Souza', 'Kit Safári', 4990, 'approved'],
              ['ord_1008', 'Lucia Rocha', 'Kit Princesas', 6990, 'pending'],
              ['ord_1005', 'Pedro Alves', 'Kit Safári', 4990, 'rejected'],
            ].map(([id, name, pkg, amount, status]) => (
              <TR key={id as string} onClick={() => toast.info(`Abrir ${id}`)}>
                <TD className="font-mono text-xs">{id}</TD>
                <TD>{name}</TD>
                <TD>{pkg}</TD>
                <TD className="text-right tabular-nums">{formatBRL(amount as number)}</TD>
                <TD>
                  <OrderStatusBadge status={status as OrderStatus} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Block>

      <Block title="Upload">
        <Dropzone onFiles={setDropped} hint="PDF, PNG ou ZIP até 500 MB" />
        {dropped.length > 0 && (
          <ul className="text-sm text-gray-600">
            {dropped.map((f) => (
              <li key={f.name}>
                {f.name} · {formatBytes(f.size)}
              </li>
            ))}
          </ul>
        )}
        <ProgressBar value={progress} />
      </Block>

      <Block title="Carregando, vazio e erro">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 space-y-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </Card>
          <Card>
            <EmptyState icon={Package} title="Nenhum pacote ainda" description="Crie o primeiro pacote para aparecer no catálogo." action={<Button size="sm">Novo pacote</Button>} />
          </Card>
          <Card>
            <ErrorState error={new ServiceError('NETWORK', 'Não foi possível conectar. Tente novamente.')} onRetry={() => toast.info('Tentando de novo…')} />
          </Card>
        </div>
      </Block>

      <Block title="Diálogos e avisos">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModal(true)}>
            Abrir modal
          </Button>
          <Button variant="outline" onClick={() => setConfirm(true)}>
            Confirmar exclusão
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Pacote salvo!')}>
            Toast sucesso
          </Button>
          <Button variant="ghost" onClick={() => toast.error('Não foi possível salvar.')}>
            Toast erro
          </Button>
        </div>
      </Block>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Conceder acesso"
        description="Libera um pacote para este cliente sem pagamento."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModal(false)}>Conceder</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Pacote">
            <Select>
              <option>Kit Safári</option>
              <option>Kit Fundo do Mar</option>
            </Select>
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        loading={confirming}
        title="Excluir arquivo?"
        description="O arquivo será removido do bucket e dos pacotes que o usam."
        confirmLabel="Excluir"
        onConfirm={async () => {
          setConfirming(true)
          await new Promise((r) => setTimeout(r, 900))
          setConfirming(false)
          setConfirm(false)
          toast.success('Arquivo excluído.')
        }}
      />
    </main>
  )
}
