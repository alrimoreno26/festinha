'use client'

// Painel de desenvolvimento para validar cenários: simulador de pagamento, rede, contas de teste,
// dados de exemplo e emails "enviados". Some quando NEXT_PUBLIC_DEVTOOLS=false (e a API de
// simulação só existe em desenvolvimento ou com DEV_TOOLS=true).

import { Badge, Button, Switch, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getDevSettings, setDevSettings, subscribeDevSettings, type Latency, type PaymentOutcome } from '@/lib/dev/settings'
import { formatDateTime } from '@/lib/format'
import { useSession } from '@/lib/hooks/useSession'
import { devService, errorMessage, qk } from '@/lib/services'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, RotateCcw, Trash2, Wrench, X } from 'lucide-react'
import { hardNavigate } from '@/lib/navigation'
import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

type Tab = 'cenario' | 'sessao' | 'dados' | 'emails'

const OPEN_KEY = 'festinhas:devtoolbar:open'
const SEEN_KEY = 'festinhas:devtoolbar:seen-emails'

// Contas do seed (lib/server/seed-data.ts). Só os emails: o atalho entra sem senha.
const TEST_ACCOUNTS = {
  // Qualquer administrador existente (o de exemplo ou o seu real).
  admin: 'admin',
  maria: 'maria@festinhas.test',
  ana: 'ana@festinhas.test',
}

function useDevSettings() {
  return useSyncExternalStore(subscribeDevSettings, getDevSettings, getDevSettings)
}

function useOutbox() {
  // Consulta leve a cada 5 s para o contador de emails novos.
  return useQuery({ queryKey: qk.devOutbox, queryFn: devService.outbox, refetchInterval: 5000, staleTime: 0 })
}

export function DevToolbar() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('cenario')
  const [seenIds, setSeenIds] = useState<string[]>([])
  const outbox = useOutbox()

  useEffect(() => {
    setMounted(true)
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === '1')
      setSeenIds(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
    } catch {}
  }, [])

  if (!mounted) return null

  const emails = outbox.data ?? []
  const unread = emails.filter((e) => !seenIds.includes(e.id)).length

  const toggle = (value: boolean) => {
    setOpen(value)
    try {
      localStorage.setItem(OPEN_KEY, value ? '1' : '0')
    } catch {}
  }
  const selectTab = (t: Tab) => {
    setTab(t)
    if (t === 'emails') {
      const ids = emails.map((e) => e.id)
      setSeenIds(ids)
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(ids))
      } catch {}
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => toggle(true)}
        className="fixed bottom-24 sm:bottom-4 left-3 sm:left-auto sm:right-4 z-[80] flex items-center gap-2 rounded-full bg-gray-900/90 sm:bg-gray-900 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
      >
        <Wrench size={16} /> Dev
        {unread > 0 && <span className="rounded-full bg-brand-coral px-1.5 text-xs">{unread}</span>}
      </button>
    )
  }

  return (
    <div className="fixed z-[80] inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[380px] max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 text-gray-800">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Wrench size={16} /> Modo de simulação
        </p>
        <button onClick={() => toggle(false)} className="rounded-full p-1.5 hover:bg-black/5" aria-label="Fechar painel">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-1 px-3 border-b border-black/5">
        {(
          [
            ['cenario', 'Cenário'],
            ['sessao', 'Sessão'],
            ['dados', 'Dados'],
            ['emails', `Emails${unread ? ` (${unread})` : ''}`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
            className={cn(
              'px-3 py-2 text-sm border-b-2 -mb-px',
              tab === key ? 'border-brand-coral text-brand-coral font-medium' : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto p-4 space-y-5 text-sm">
        {tab === 'cenario' && <ScenarioTab />}
        {tab === 'sessao' && <SessionTab />}
        {tab === 'dados' && <DataTab />}
        {tab === 'emails' && <EmailsTab />}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-2xl bg-gray-100 p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn('rounded-xl px-2 py-1.5 text-xs font-medium', value === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ScenarioTab() {
  const s = useDevSettings()
  return (
    <>
      <Section title="Resultado do próximo pagamento">
        <Segmented<PaymentOutcome>
          value={s.paymentOutcome}
          onChange={(paymentOutcome) => setDevSettings({ paymentOutcome })}
          options={[
            ['approved', '✅ Aprovado'],
            ['pending', '⏳ Pix pendente'],
            ['rejected', '❌ Recusado'],
          ]}
        />
        {s.paymentOutcome === 'pending' && (
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-gray-600">Confirmar Pix sozinho após</span>
            <select
              value={s.pixAutoConfirmSeconds}
              onChange={(e) => setDevSettings({ pixAutoConfirmSeconds: Number(e.target.value) })}
              className="rounded-xl border border-gray-200 px-2 py-1"
            >
              <option value={5}>5 s</option>
              <option value={8}>8 s</option>
              <option value={20}>20 s</option>
              <option value={0}>nunca</option>
            </select>
          </label>
        )}
        <p className="mt-2 text-xs text-gray-500">&quot;Pix pendente&quot; só se aplica quando o cliente escolhe Pix; cartão é aprovado.</p>
      </Section>
      <Section title="Rede">
        <Segmented<Latency>
          value={s.latency}
          onChange={(latency) => setDevSettings({ latency })}
          options={[
            ['real', 'Real'],
            ['slow', 'Lenta (+2 s)'],
          ]}
        />
        <div className="mt-3">
          <Switch checked={s.networkError} onChange={(networkError) => setDevSettings({ networkError })} label="Simular erro de conexão" />
        </div>
      </Section>
    </>
  )
}

function SessionTab() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()

  const loginAs = useMutation({
    mutationFn: ({ email }: { email: string | null; go: string }) => devService.loginAs(email),
    onSuccess: (session, { go }) => {
      queryClient.setQueryData(qk.session, session)
      queryClient.removeQueries({ queryKey: ['me'] })
      queryClient.removeQueries({ queryKey: ['admin'] })
      hardNavigate(go)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const go = (email: string | null, path: string) => loginAs.mutate({ email, go: path })

  return (
    <>
      <Section title="Sessão atual">
        {user ? (
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="font-medium">{user.name}</p>
            <p className="text-gray-500">{user.email}</p>
            <div className="mt-2 flex gap-1.5">
              <Badge tone={user.role === 'admin' ? 'brand' : 'info'}>{user.role === 'admin' ? 'Admin' : 'Cliente'}</Badge>
              {user.mustChangePassword && <Badge tone="warning">Senha temporária</Badge>}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Visitante (sem login)</p>
        )}
      </Section>
      <Section title="Entrar como">
        <div className="grid gap-2">
          <Button size="sm" variant="outline" disabled={loginAs.isPending} onClick={() => go(TEST_ACCOUNTS.admin, '/admin')}>
            Admin
          </Button>
          <Button size="sm" variant="outline" disabled={loginAs.isPending} onClick={() => go(TEST_ACCOUNTS.maria, '/conta')}>
            Cliente com kits (Maria)
          </Button>
          <Button size="sm" variant="outline" disabled={loginAs.isPending} onClick={() => go(TEST_ACCOUNTS.ana, '/conta')}>
            Cliente no 1º acesso (Ana)
          </Button>
          <Button size="sm" variant="ghost" disabled={loginAs.isPending} onClick={() => go(null, '/')}>
            Sair (visitante)
          </Button>
        </div>
      </Section>
      <Section title="Atalhos">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-brand-teal">
          <Link href="/">Landing</Link>
          <Link href="/pacotes">Catálogo</Link>
          <Link href="/conta">Área do cliente</Link>
          <Link href="/admin">Backoffice</Link>
          <Link href="/dev">Componentes</Link>
        </div>
      </Section>
    </>
  )
}

function DataTab() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const counts = useQuery({ queryKey: qk.devCounts, queryFn: devService.counts, staleTime: 0 })
  const reset = useMutation({
    mutationFn: devService.resetData,
    onSuccess: (_, kind) => {
      // As sessões foram apagadas junto com os dados: volta a ser visitante.
      queryClient.setQueryData(qk.session, null)
      toast.success(kind === 'seed' ? 'Dados de exemplo restaurados. Entre de novo.' : 'Dados esvaziados (usuários mantidos). Entre de novo.')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const rows: [string, number | undefined][] = [
    ['Pacotes', counts.data?.packages],
    ['Arquivos', counts.data?.files],
    ['Pedidos', counts.data?.orders],
    ['Clientes', counts.data?.customers],
    ['Acessos', counts.data?.entitlements],
  ]
  return (
    <>
      <Section title="Banco de desenvolvimento (Neon)">
        <div className="grid grid-cols-3 gap-2">
          {rows.map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-gray-50 p-2 text-center">
              <p className="text-lg font-semibold tabular-nums">{n ?? '…'}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Ações">
        <div className="grid gap-2">
          <Button size="sm" variant="outline" loading={reset.isPending && reset.variables === 'seed'} disabled={reset.isPending} onClick={() => reset.mutate('seed')}>
            <RotateCcw size={14} /> Restaurar dados de exemplo
          </Button>
          <Button size="sm" variant="ghost" loading={reset.isPending && reset.variables === 'empty'} disabled={reset.isPending} onClick={() => reset.mutate('empty')}>
            <Trash2 size={14} /> Esvaziar (testar telas vazias)
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Apaga tudo no banco de desenvolvimento. Esvaziar mantém os usuários de teste.</p>
      </Section>
    </>
  )
}

function EmailsTab() {
  const outbox = useOutbox()
  const clear = useMutation({ mutationFn: devService.clearOutbox })
  const emails = outbox.data ?? []

  if (outbox.isPending) return <p className="py-8 text-center text-gray-500">Carregando…</p>
  if (!emails.length)
    return (
      <div className="py-8 text-center text-gray-500">
        <Mail className="mx-auto mb-2" size={24} />
        Nenhum email enviado ainda. Faça uma compra ou peça para redefinir a senha.
      </div>
    )
  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => clear.mutate()} disabled={clear.isPending} className="text-xs text-gray-500 hover:text-gray-800">
          Limpar caixa de saída
        </button>
      </div>
      {emails.map((email) => (
        <div key={email.id} className="rounded-2xl border border-black/5 p-3">
          <p className="font-medium">{email.subject}</p>
          <p className="text-xs text-gray-500">
            para {email.to} · {formatDateTime(email.createdAt)}
          </p>
          <p className="mt-2 whitespace-pre-line text-gray-700">{email.body}</p>
          {email.actionUrl && (
            <Link href={email.actionUrl} className="mt-2 inline-block font-medium text-brand-teal">
              {email.actionLabel ?? 'Abrir'} →
            </Link>
          )}
        </div>
      ))}
    </>
  )
}
