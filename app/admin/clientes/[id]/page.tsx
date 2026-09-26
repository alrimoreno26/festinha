'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EntitlementBadge,
  Field,
  Input,
  Modal,
  OrderStatusBadge,
  PageHeader,
  QueryState,
  Select,
  useToast,
} from '@/components/ui'
import { expiryText } from '@/lib/entitlements'
import { accessLabel, formatBRL, formatDate } from '@/lib/format'
import { customersService, errorMessage, packagesService, qk } from '@/lib/services'
import type { CustomerEntitlement } from '@/lib/services/customers'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, Gift, Mail, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function GrantModal({ open, onClose, userId, owned }: { open: boolean; onClose: () => void; userId: string; owned: string[] }) {
  const toast = useToast()
  const packages = useQuery({ queryKey: qk.adminPackages, queryFn: packagesService.list, enabled: open })
  const [packageId, setPackageId] = useState('')
  const [mode, setMode] = useState<'package' | 'life' | 'days'>('package')
  const [days, setDays] = useState('30')
  useEffect(() => {
    if (open) {
      setPackageId('')
      setMode('package')
    }
  }, [open])

  const selected = packages.data?.find((p) => p.id === packageId)
  const accessDays = mode === 'life' ? null : mode === 'days' ? Number(days) : selected?.accessDays ?? null

  const grant = useMutation({
    mutationFn: () => customersService.grantAccess(userId, packageId, accessDays),
    onSuccess: () => {
      toast.success('Acesso liberado e cliente avisado por email.')
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={grant.isPending}
      title="Liberar kit"
      description="Concede acesso sem pagamento (brinde, venda por fora, reposição)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => grant.mutate()} loading={grant.isPending} disabled={!packageId || (mode === 'days' && !(Number(days) > 0))}>
            Liberar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Pacote">
          <Select value={packageId} onChange={(e) => setPackageId(e.target.value)} disabled={packages.isPending}>
            <option value="">{packages.isPending ? 'Carregando…' : 'Escolha um pacote'}</option>
            {packages.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {owned.includes(p.id) ? ' (já tem — renova)' : ''}
                {!p.active ? ' (oculto)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duração">
          <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="package">Padrão do pacote{selected ? ` (${accessLabel(selected.accessDays).replace('Acesso ', '')})` : ''}</option>
            <option value="life">Vitalício</option>
            <option value="days">Número de dias</option>
          </Select>
        </Field>
        {mode === 'days' && (
          <Field label="Dias">
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

const waLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`

export default function ClientePage({ params }: { params: { id: string } }) {
  const toast = useToast()
  const query = useQuery({ queryKey: qk.customer(params.id), queryFn: () => customersService.get(params.id) })
  const [granting, setGranting] = useState(false)
  const [resending, setResending] = useState(false)
  const [revoking, setRevoking] = useState<CustomerEntitlement | null>(null)

  const resend = useMutation({
    mutationFn: () => customersService.resendAccess(params.id),
    onSuccess: () => {
      setResending(false)
      toast.success('Nova senha temporária enviada por email.')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => customersService.revokeAccess(id),
    onSuccess: () => {
      setRevoking(null)
      toast.success('Acesso revogado.')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const restore = useMutation({
    mutationFn: (id: string) => customersService.restoreAccess(id),
    onSuccess: () => toast.success('Acesso restaurado.'),
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <QueryState query={query}>
      {({ customer, orders, entitlements, downloadsCount }) => (
        <>
          <PageHeader
            back={
              <Link href="/admin/clientes" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <ChevronLeft size={16} /> Clientes
              </Link>
            }
            title={customer.name}
            description={`Cliente desde ${formatDate(customer.createdAt)}`}
            actions={
              <>
                <Button variant="outline" onClick={() => setResending(true)}>
                  <Mail size={16} /> Reenviar acesso
                </Button>
                <Button onClick={() => setGranting(true)}>
                  <Gift size={16} /> Liberar kit
                </Button>
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
            <Card className="p-5 space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p className="text-gray-900 break-all">{customer.email}</p>
              </div>
              <div>
                <p className="text-gray-500">WhatsApp</p>
                {customer.phone ? (
                  <a href={waLink(customer.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-teal hover:underline">
                    <MessageCircle size={14} /> {customer.phone}
                  </a>
                ) : (
                  <p className="text-gray-900">—</p>
                )}
              </div>
              <div>
                <p className="text-gray-500">Senha</p>
                {customer.mustChangePassword ? <Badge tone="warning">Temporária (ainda não entrou)</Badge> : <Badge tone="success">Definida pelo cliente</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-black/5 pt-3">
                <div>
                  <p className="text-gray-500">Gasto total</p>
                  <p className="font-semibold tabular-nums">{formatBRL(orders.filter((o) => o.status === 'approved').reduce((s, o) => s + o.amountCents, 0))}</p>
                </div>
                <div>
                  <p className="text-gray-500">Downloads</p>
                  <p className="font-semibold tabular-nums">{downloadsCount}</p>
                </div>
              </div>
            </Card>

            <div className="space-y-6 min-w-0">
              <Card className="p-5">
                <h2 className="font-semibold text-gray-900">Kits e acessos</h2>
                {entitlements.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">Nenhum kit liberado.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-black/5">
                    {entitlements.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                        <PackageCover src={e.package.coverUrl} alt="" className="h-10 w-14 rounded-lg shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{e.package.title}</p>
                          <p className="text-xs text-gray-500">
                            {e.grantedBy === 'manual' ? 'Liberado manualmente' : 'Compra'} · {expiryText(e)}
                          </p>
                        </div>
                        <EntitlementBadge status={e.status} />
                        {e.status === 'revoked' ? (
                          <Button size="sm" variant="ghost" onClick={() => restore.mutate(e.id)} loading={restore.isPending && restore.variables === e.id}>
                            Restaurar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setRevoking(e)}>
                            Revogar
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="font-semibold text-gray-900">Pedidos</h2>
                {orders.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">Nenhum pedido.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-black/5">
                    {orders.map((o) => (
                      <li key={o.id}>
                        <Link href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 -mx-2 px-2 rounded-xl hover:bg-brand-sand/40">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{o.packageTitle}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(o.createdAt)} · <span className="font-mono">{o.id}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm tabular-nums">{formatBRL(o.amountCents)}</span>
                            <OrderStatusBadge status={o.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <GrantModal open={granting} onClose={() => setGranting(false)} userId={customer.id} owned={entitlements.map((e) => e.packageId)} />
          <ConfirmDialog
            open={resending}
            onClose={() => setResending(false)}
            onConfirm={() => resend.mutate()}
            loading={resend.isPending}
            tone="primary"
            title="Reenviar dados de acesso?"
            description={`Uma nova senha temporária será gerada e enviada para ${customer.email}. A senha atual deixa de funcionar.`}
            confirmLabel="Reenviar"
          />
          <ConfirmDialog
            open={!!revoking}
            onClose={() => setRevoking(null)}
            onConfirm={() => {
              if (revoking) revoke.mutate(revoking.id)
            }}
            loading={revoke.isPending}
            title={`Revogar acesso ao ${revoking?.package.title}?`}
            description="O cliente deixa de ver e baixar este kit. Você pode restaurar depois."
            confirmLabel="Revogar"
          />
        </>
      )}
    </QueryState>
  )
}
