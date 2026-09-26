'use client'

import { PackageCover } from '@/components/catalog/PackageCard'
import { ButtonLink, Card, EmptyState, PageHeader, QueryState, Switch, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui'
import { accessLabel, formatBRL } from '@/lib/format'
import { errorMessage, packagesService, qk } from '@/lib/services'
import type { AdminPackageRow } from '@/lib/services/packages'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Package, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function ActiveToggle({ pkg }: { pkg: AdminPackageRow }) {
  const toast = useToast()
  const toggle = useMutation({
    mutationFn: (active: boolean) => packagesService.setActive(pkg.id, active),
    onSuccess: (p) => toast.success(p.active ? `${p.title} está no catálogo.` : `${p.title} foi ocultado do catálogo.`),
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Switch checked={toggle.isPending ? !!toggle.variables : pkg.active} onChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} />
    </span>
  )
}

export default function PacotesAdminPage() {
  const router = useRouter()
  const query = useQuery({ queryKey: qk.adminPackages, queryFn: packagesService.list })

  return (
    <>
      <PageHeader
        title="Pacotes"
        description="Kits à venda no catálogo."
        actions={
          <ButtonLink href="/admin/pacotes/novo">
            <Plus size={16} /> Novo pacote
          </ButtonLink>
        }
      />
      <QueryState
        query={query}
        empty={
          <Card>
            <EmptyState
              icon={Package}
              title="Nenhum pacote ainda"
              description="Crie um pacote, escolha os arquivos do bucket e defina o preço."
              action={<ButtonLink href="/admin/pacotes/novo">Criar primeiro pacote</ButtonLink>}
            />
          </Card>
        }
      >
        {(packages) => (
          <Table>
            <THead>
              <tr>
                <TH>Pacote</TH>
                <TH className="text-right">Preço</TH>
                <TH>Arquivos</TH>
                <TH>Acesso</TH>
                <TH className="text-right">Vendas</TH>
                <TH>No catálogo</TH>
              </tr>
            </THead>
            <TBody>
              {packages.map((p) => (
                <TR key={p.id} onClick={() => router.push(`/admin/pacotes/${p.id}`)}>
                  <TD>
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <PackageCover src={p.coverUrl} alt="" className="h-12 w-16 rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <Link href={`/admin/pacotes/${p.id}`} className="font-medium text-gray-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {p.title}
                        </Link>
                        <p className="text-xs text-gray-400">/{p.slug}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">{formatBRL(p.priceCents)}</TD>
                  <TD>{p.fileIds.length}</TD>
                  <TD className="whitespace-nowrap">{accessLabel(p.accessDays).replace('Acesso ', '')}</TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">
                    {p.salesCount}
                    <p className="text-xs text-gray-400">{formatBRL(p.revenueCents)}</p>
                  </TD>
                  <TD>
                    <ActiveToggle pkg={p} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryState>
    </>
  )
}
