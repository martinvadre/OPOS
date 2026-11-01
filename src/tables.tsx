import { useState, type FormEvent } from 'react'
import { Clock3, Plus, RefreshCw, SquarePen, Trash2, UsersRound } from 'lucide-react'
import { DiningTableIcon } from '@/table-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type TableItem = { id: number; quantity: number; addons: number[] }
export type DiningTable = { id: number; name: string; seats: number; guests: number; openedAt: string | null; order: TableItem[]; version: number }
type Props = {
  tables: DiningTable[]
  request: <T>(route: string, method?: string, payload?: unknown) => Promise<T>
  refresh: () => Promise<void>
  openOrder: (table: DiningTable) => void
  itemName: (id: number) => string
  lineTotal: (item: TableItem) => number
  onError: (error: unknown) => void
}
const money = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount / 100)

export function TablesPage({ tables, request, refresh, openOrder, itemName, lineTotal, onError }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<DiningTable | null>(null)
  const [name, setName] = useState('')
  const [seats, setSeats] = useState('4')
  const [guests, setGuests] = useState('1')
  const [removing, setRemoving] = useState<DiningTable | null>(null)
  const [busy, setBusy] = useState(false)
  const selected = tables.find(table => table.id === selectedId)
  const occupied = tables.filter(table => table.openedAt).length

  function editTable(table: DiningTable | null) {
    setEditing(table); setName(table?.name || `Table ${Math.max(0, ...tables.map(table => table.id)) + 1}`); setSeats(String(table?.seats || 4)); setDialog(true)
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true)
    try {
      const table = await request<DiningTable>(editing ? `tables/${editing.id}` : 'tables', editing ? 'PATCH' : 'POST', { name: name.trim(), seats: Number(seats), ...(editing ? { action: 'details', version: editing.version } : {}) })
      await refresh(); setSelectedId(table.id); setDialog(false)
    } catch (cause) { onError(cause) } finally { setBusy(false) }
  }
  async function visit(action: 'open' | 'close') {
    if (!selected) return
    setBusy(true)
    try {
      const table = await request<DiningTable>(`tables/${selected.id}`, 'PATCH', { action, guests: Number(guests), version: selected.version })
      await refresh(); if (action === 'open') openOrder(table)
    } catch (cause) { onError(cause); await refresh().catch(() => {}) } finally { setBusy(false) }
  }
  async function remove() {
    if (!removing) return
    setBusy(true)
    try { await request(`tables/${removing.id}`, 'DELETE'); setRemoving(null); await refresh() }
    catch (cause) { onError(cause) } finally { setBusy(false) }
  }

  return <>
    <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] items-center justify-between gap-3"><h1 className="text-[21pt] font-bold leading-tight tracking-tight">Tables</h1><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="rounded-full border-input" aria-label="Refresh tables" disabled={busy} onClick={async () => { setBusy(true); try { await refresh() } catch (cause) { onError(cause) } finally { setBusy(false) } }}><RefreshCw /></Button><Button className="h-[calc(var(--radius-card)*2)] rounded-full has-[>svg]:px-inset" onClick={() => editTable(null)}><Plus />Add table</Button></div></div>
    <div className="mb-inset flex items-center gap-4 text-sm"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-slate-400" />Available {tables.length - occupied}</span><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-orange-500" />Occupied {occupied}</span></div>
    <div className="grid items-start gap-inset xl:grid-cols-[minmax(0,1fr)_255pt]">
      <Card className="gap-0 border-0 bg-background p-inset shadow-sm"><CardContent className="px-0">{tables.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">{tables.map(table => <button key={table.id} type="button" aria-label={`${table.name}, ${table.openedAt ? 'Occupied' : 'Available'}, ${table.seats} seats`} aria-pressed={table.id === selectedId} onClick={() => { setSelectedId(table.id); setGuests('1') }} className={`min-w-0 rounded-xl border-[0.75pt] p-inset text-center transition-colors ${table.id === selectedId ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-transparent hover:bg-muted'}`}>
        <span className={`relative mx-auto my-2 flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-[0.75pt] ${table.openedAt ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><span aria-hidden="true" className={`absolute -top-2 h-1.5 w-9 rounded-t-md ${table.openedAt ? 'bg-orange-400' : 'bg-slate-300'}`} /><span aria-hidden="true" className={`absolute -bottom-2 h-1.5 w-9 rounded-b-md ${table.openedAt ? 'bg-orange-400' : 'bg-slate-300'}`} /><span aria-hidden="true" className={`absolute -left-2 h-9 w-1.5 rounded-l-md ${table.openedAt ? 'bg-orange-400' : 'bg-slate-300'}`} /><span aria-hidden="true" className={`absolute -right-2 h-9 w-1.5 rounded-r-md ${table.openedAt ? 'bg-orange-400' : 'bg-slate-300'}`} /><span className="max-w-full truncate px-1 text-sm font-semibold" translate="no">{table.name}</span><span className="inline-flex items-center gap-1 text-xs"><UsersRound className="size-3" />{table.openedAt ? table.guests : table.seats}</span></span>
        <span className={`mt-3 block text-xs font-medium ${table.openedAt ? 'text-orange-600' : 'text-muted-foreground'}`}>{table.openedAt ? 'Occupied' : 'Available'}</span>
      </button>)}</div> : <div className="flex min-h-48 flex-col items-center justify-center gap-3"><DiningTableIcon className="size-8 text-primary" /><h2 className="font-semibold">No tables yet</h2><Button variant="outline" onClick={() => editTable(null)}><Plus />Add table</Button></div>}</CardContent></Card>
      <Card className="gap-inset border-0 bg-background p-inset shadow-sm">{selected ? <>
        <CardHeader className="flex flex-row items-center justify-between px-0"><CardTitle translate="no">{selected.name}</CardTitle><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${selected.name}`} onClick={() => editTable(selected)}><SquarePen /></Button><Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`Remove ${selected.name}`} disabled={!!selected.openedAt || busy} onClick={() => setRemoving(selected)}><Trash2 /></Button></div></CardHeader>
        <CardContent className="space-y-inset px-0"><div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><UsersRound className="size-4" />{selected.openedAt ? `${selected.guests} guests · ` : ''}{selected.seats} seats</span>{selected.openedAt && <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{new Date(selected.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div>
          {selected.openedAt ? <><div className="space-y-3 border-y-[0.75pt] border-border py-inset">{selected.order.length ? selected.order.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {itemName(item.id)}</span><span className="shrink-0">{money(lineTotal(item))}</span></div>) : <p className="text-sm text-muted-foreground">No items yet</p>}</div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total</span><strong className="text-xl">{money(selected.order.reduce((sum, item) => sum + lineTotal(item), 0))}</strong></div><Button className="w-full" disabled={busy} onClick={() => openOrder(selected)}>{selected.order.length ? 'View order' : 'Add items'}</Button>{!selected.order.length && <Button variant="outline" className="w-full border-input" disabled={busy} onClick={() => visit('close')}>Close table</Button>}</> : <><div className="space-y-2"><Label htmlFor="table-guests">Guests</Label><Input id="table-guests" type="number" min="1" max={selected.seats} value={guests} onChange={event => setGuests(event.target.value)} /></div><Button className="w-full" disabled={busy} onClick={() => visit('open')}>Open table</Button></>}
        </CardContent>
      </> : <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 px-0"><DiningTableIcon className="size-8 text-primary" /><h2 className="font-semibold">Select a table</h2></CardContent>}</Card>
    </div>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent className="gap-inset border-0 shadow-xl sm:max-w-[330pt]"><DialogHeader><DialogTitle>{editing ? 'Edit table' : 'Add table'}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-inset"><div className="space-y-2"><Label htmlFor="table-name">Name</Label><Input id="table-name" value={name} onChange={event => setName(event.target.value)} required maxLength={40} /></div><div className="space-y-2"><Label htmlFor="table-seats">Seats</Label><Input id="table-seats" type="number" min="1" max="100" value={seats} onChange={event => setSeats(event.target.value)} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDialog(false)} disabled={busy}>Cancel</Button><Button disabled={busy}>{editing ? 'Save' : 'Add table'}</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle><AlertDialogDescription>The table will be removed from the floor.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={remove}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
