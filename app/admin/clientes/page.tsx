'use client'

import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, QueryState, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui'
import { formatBRL, formatDate, formatPhoneBR } from '@/lib/format'
import { customersService, errorMessage, qk, ServiceError } from '@/lib/services'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search, UserPlus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  useEffect(() => {
    if (open) setForm({ name: '', email: '', phone: '' })
  }, [open])

  const create = useMutation({
    mutationFn: () => customersService.create(form),
    onSuccess: (user) => {
      toast.success('Cliente criado. A senha temporária foi enviada por email.')
      onClose()
      router.push(`/admin/clientes/${user.id}`)
    },
  })
  const errors = create.error instanceof ServiceError ? create.error.details ?? {} : {}

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={create.isPending}
      title="Novo cliente"
      description="Para vendas feitas fora do site (ex.: WhatsApp). Depois você libera os kits no perfil do cliente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-customer" loading={create.isPending}>
            Criar cliente
          </Button>
        </>
      }
    >
      <form
        id="new-customer"
        className="space-y-4"
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Field label="Nome" error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="WhatsApp (opcional)">
          <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneBR(e.target.value) })} />
        </Field>
        {create.isError && !Object.keys(errors).length && <p className="text-sm text-red-600">{errorMessage(create.error)}</p>}
      </form>
    </Modal>
  )
}

export default function ClientesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const query = useQuery({ queryKey: qk.customers(debounced), queryFn: () => customersService.list(debounced), placeholderData: (prev) => prev })

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Contas criadas por compras ou manualmente."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus size={16} /> Novo cliente
          </Button>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email ou telefone" className="pl-10" />
      </div>
      <QueryState
        query={query}
        empty={
          <Card>
            <EmptyState icon={Users} title={debounced ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'} description={debounced ? 'Tente outra busca.' : 'Os clientes aparecem aqui após a primeira compra.'} />
          </Card>
        }
      >
        {(customers) => (
          <Table>
            <THead>
              <tr>
                <TH>Cliente</TH>
                <TH>WhatsApp</TH>
                <TH className="text-right">Pedidos</TH>
                <TH className="text-right">Total gasto</TH>
                <TH>Kits ativos</TH>
                <TH>Último pedido</TH>
              </tr>
            </THead>
            <TBody>
              {customers.map((c) => (
                <TR key={c.id} onClick={() => router.push(`/admin/clientes/${c.id}`)}>
                  <TD>
                    <p className="font-medium text-gray-900 whitespace-nowrap">
                      {c.name} {c.mustChangePassword && <Badge tone="warning">1º acesso pendente</Badge>}
                    </p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </TD>
                  <TD className="whitespace-nowrap">{c.phone ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{c.ordersCount}</TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">{formatBRL(c.totalSpentCents)}</TD>
                  <TD>{c.activeKits}</TD>
                  <TD className="whitespace-nowrap">{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryState>
      <NewCustomerModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
