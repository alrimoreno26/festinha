'use client'

// Painel de desenvolvimento para validar cenários visuais sem integrações reais.
// Some quando NEXT_PUBLIC_DEVTOOLS=false.

import { Badge, Button, Switch } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { useSession } from '@/lib/hooks/useSession'
import {
  getDevSettings,
  setDevSettings,
  subscribeDevSettings,
  type Latency,
  type PaymentOutcome,
} from '@/lib/mock/dev-settings'
import { SEED_ACCOUNTS } from '@/lib/mock/seed'
import { setSessionUserId } from '@/lib/mock/session'
import { getDb, getDbVersion, mutate, resetDb, subscribeDb } from '@/lib/mock/store'
import { Mail, RotateCcw, Trash2, Wrench, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

type Tab = 'cenario' | 'sessao' | 'dados' | 'emails'

const OPEN_KEY = 'festinhas:devtoolbar:open'
const SEEN_KEY = 'festinhas:devtoolbar:seen-emails'

function useDevSettings() {
  return useSyncExternalStore(subscribeDevSettings, getDevSettings, getDevSettings)
}

function useDbVersion() {
  return useSyncExternalStore(subscribeDb, getDbVersion, () => 0)
}

export function DevToolbar() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('cenario')
  const [seenEmails, setSeenEmails] = useState(0)
  useDbVersion()

  useEffect(() => {
    setMounted(true)
    setOpen(localStorage.getItem(OPEN_KEY) === '1')
    setSeenEmails(Number(localStorage.getItem(SEEN_KEY) ?? 0))
  }, [])

  if (!mounted) return null

  const outboxCount = getDb().outbox.length
  const unread = Math.max(0, outboxCount - seenEmails)

  const toggle = (value: boolean) => {
    setOpen(value)
    localStorage.setItem(OPEN_KEY, value ? '1' : '0')
  }
  const selectTab = (t: Tab) => {
    setTab(t)
    if (t === 'emails') {
      setSeenEmails(outboxCount)
      localStorage.setItem(SEEN_KEY, String(outboxCount))
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
            ['none', 'Instantânea'],
            ['normal', 'Normal'],
            ['slow', 'Lenta'],
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
  const router = useRouter()

  const loginAs = (email: string, go: string) => {
    const target = getDb().users.find((u) => u.email === email)
    if (!target) return
    mutate(() => setSessionUserId(target.id))
    router.push(go)
  }

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
          <Button size="sm" variant="outline" onClick={() => loginAs(SEED_ACCOUNTS.admin.email, '/admin')}>
            Admin
          </Button>
          <Button size="sm" variant="outline" onClick={() => loginAs(SEED_ACCOUNTS.maria.email, '/conta')}>
            Cliente com kits (Maria)
          </Button>
          <Button size="sm" variant="outline" onClick={() => loginAs(SEED_ACCOUNTS.ana.email, '/conta')}>
            Cliente no 1º acesso (Ana)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              mutate(() => setSessionUserId(null))
              router.push('/')
            }}
          >
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
  const db = getDb()
  const counts: [string, number][] = [
    ['Pacotes', db.packages.length],
    ['Arquivos', db.files.length],
    ['Pedidos', db.orders.length],
    ['Clientes', db.users.filter((u) => u.role === 'customer').length],
    ['Acessos', db.entitlements.length],
  ]
  return (
    <>
      <Section title="Banco simulado (localStorage)">
        <div className="grid grid-cols-3 gap-2">
          {counts.map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-gray-50 p-2 text-center">
              <p className="text-lg font-semibold tabular-nums">{n}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Ações">
        <div className="grid gap-2">
          <Button size="sm" variant="outline" onClick={() => resetDb('seed')}>
            <RotateCcw size={14} /> Restaurar dados de exemplo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => resetDb('empty')}>
            <Trash2 size={14} /> Esvaziar (testar telas vazias)
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Esvaziar mantém os usuários para você continuar logado.</p>
      </Section>
    </>
  )
}

function EmailsTab() {
  const outbox = getDb().outbox
  if (!outbox.length)
    return (
      <div className="py-8 text-center text-gray-500">
        <Mail className="mx-auto mb-2" size={24} />
        Nenhum email enviado ainda. Faça uma compra ou peça para redefinir a senha.
      </div>
    )
  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => mutate((db) => (db.outbox = []))} className="text-xs text-gray-500 hover:text-gray-800">
          Limpar caixa de saída
        </button>
      </div>
      {outbox.map((email) => (
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
