import { useState, type FormEvent } from 'react'
import { ChevronDown, Clock3, Plus, RefreshCw, SquarePen, Trash2, UsersRound } from 'lucide-react'
import { DiningTableIcon } from '@/table-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type TableItem = { id: number; quantity: number; addons: number[] }
export type DiningTable = { id: number; name: string; seats: number; guests: number; openedAt: string | null; order: TableItem[]; version: number; position: number; combinedTableIds?: number[] }
type Props = {
  tables: DiningTable[]
  request: <T>(route: string, method?: string, payload?: unknown) => Promise<T>
  refresh: () => Promise<void>
  openOrder: (table: DiningTable) => void
  transferOrder: (source: DiningTable, destination: DiningTable, action: 'move' | 'combine', guests: number) => Promise<DiningTable>
  onGuestUpdated: (table: DiningTable, previousVersion: number) => void
  itemName: (id: number) => string
  lineTotal: (item: TableItem) => number
  onError: (error: unknown) => void
}
const money = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount / 100)

export function TablesPage({ tables, request, refresh, openOrder, transferOrder, onGuestUpdated, itemName, lineTotal, onError }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<DiningTable | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [row, setRow] = useState('1')
  const [column, setColumn] = useState('1')
  const [name, setName] = useState('')
  const [seats, setSeats] = useState('4')
  const [guests, setGuests] = useState('1')
  const [removing, setRemoving] = useState<DiningTable | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [transfer, setTransfer] = useState<'move' | 'combine' | null>(null)
  const [partySize, setPartySize] = useState('1')
  const [destinationId, setDestinationId] = useState<number | null>(null)
  const anchorFor = (table: DiningTable) => tables.find(anchor => anchor.combinedTableIds?.includes(table.id)) || table
  const selected = tables.find(table => table.id === selectedId)
  const capacity = (table: DiningTable) => table.seats + tables.filter(member => table.combinedTableIds?.includes(member.id)).reduce((sum, member) => sum + member.seats, 0)
  const selectedCapacity = selected ? capacity(selected) : 0
  const selectedTotal = selected?.order.reduce((sum, item) => sum + lineTotal(item), 0) || 0
  const otherTables = tables.filter(table => table.id !== selectedId && anchorFor(table) === table)
  const availableMoves = otherTables.filter(table => !table.openedAt && table.seats >= (selected?.guests || 0))
  const destinations = transfer === 'move' ? availableMoves : otherTables
  const destination = destinations.find(table => table.id === destinationId)
  const startingParty = transfer === 'combine' && selected && destination && !selected.openedAt && !destination.openedAt
  const occupied = tables.filter(table => anchorFor(table).openedAt).length
  const validGuests = Number.isInteger(Number(guests)) && Number(guests) >= 1 && Number(guests) <= selectedCapacity

  function editTable(table: DiningTable | null) {
    const position = table?.position ?? Array.from({ length: 200 }, (_, index) => index).find(index => !tables.some(existing => existing.position === index)) ?? 0
    setDialogError('')
    setEditing(table)
    setName(table?.name || `Table ${Math.max(0, ...tables.map(table => table.id)) + 1}`)
    setSeats(String(table?.seats || 4))
    setRow(String(Math.floor(position / 4) + 1))
    setColumn(String(position % 4 + 1))
    setShowForm(true)
  }
  function selectTable(table: DiningTable) {
    const anchor = anchorFor(table)
    setSelectedId(anchor.id)
    setGuests(String(anchor.guests || 1))
  }
  function startTransfer(action: 'move' | 'combine') {
    setDialogError('')
    setDestinationId(action === 'move' ? availableMoves[0]?.id ?? null : null)
    setPartySize(guests)
    setTransfer(action)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setDialogError('')
    try {
      await request<DiningTable>(editing ? `tables/${editing.id}` : 'tables', editing ? 'PATCH' : 'POST', { name: name.trim(), seats: Number(seats), position: (Number(row) - 1) * 4 + Number(column) - 1, ...(editing ? { action: 'details', version: editing.version } : {}) })
      setShowForm(false); await refresh()
    } catch (cause) { setDialogError(cause instanceof Error ? cause.message : 'Could not save table') } finally { setBusy(false) }
  }
  async function visit(action: 'open' | 'close' | 'guests') {
    if (!selected) return
    setBusy(true)
    try {
      const table = await request<DiningTable>(`tables/${selected.id}`, 'PATCH', { action, guests: Number(guests), version: selected.version })
      await refresh()
      if (action === 'open') openOrder(table)
      if (action === 'guests') onGuestUpdated(table, selected.version)
      if (action === 'close') setGuests('1')
    } catch (cause) { onError(cause); await refresh().catch(() => {}) } finally { setBusy(false) }
  }
  async function remove() {
    if (!removing) return
    setBusy(true)
    try { await request(`tables/${removing.id}`, 'DELETE'); setRemoving(null); await refresh() }
    catch (cause) { onError(cause) } finally { setBusy(false) }
  }
  async function submitTransfer(event: FormEvent) {
    event.preventDefault()
    if (!selected || !destination || !transfer) return
    setBusy(true)
    setDialogError('')
    try {
      const moved = await transferOrder(selected, destination, transfer, Number(partySize))
      setSelectedId(moved.id); setGuests(String(moved.guests)); setTransfer(null); await refresh()
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'Could not update tables')
      await refresh().catch(() => {})
    } finally { setBusy(false) }
  }

  return <>
    <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] items-center justify-between gap-3"><h1 className="text-[21pt] font-bold leading-tight tracking-tight">Tables</h1><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="rounded-full border-input" aria-label="Refresh tables" disabled={busy} onClick={async () => { setBusy(true); try { await refresh() } catch (cause) { onError(cause) } finally { setBusy(false) } }}><RefreshCw /></Button><Button className="h-[calc(var(--radius-card)*2)] rounded-full has-[>svg]:px-inset" onClick={() => { setDialogError(''); setShowForm(false); setDialog(true) }}><SquarePen />Table setup</Button></div></div>
    <div className="mb-inset flex items-center gap-4 text-sm"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-slate-400" />Available {tables.length - occupied}</span><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-orange-500" />Occupied {occupied}</span></div>
    <div className="grid items-start gap-inset xl:grid-cols-[minmax(0,1fr)_255pt]">
      <Card className="gap-0 border-0 bg-background p-inset shadow-sm"><CardContent className="px-0">{tables.length ? <div className="max-h-[65dvh] overflow-auto pb-1"><div className="grid min-w-[24rem] auto-rows-[minmax(7rem,auto)] grid-cols-4 gap-3">
        {[...tables].sort((a, b) => a.position - b.position).map(table => {
          const anchor = anchorFor(table)
          const isOccupied = !!anchor.openedAt
          const isCombined = !!anchor.combinedTableIds?.length
          const chairs = (count: number) => <span aria-hidden="true" className="flex w-full flex-wrap justify-center gap-0.5 px-1">
            {Array.from({ length: count }, (_, index) => <span key={index} className={`h-1 w-1.5 rounded-full ${isOccupied ? 'bg-orange-400' : 'bg-slate-300'}`} />)}
          </span>
          return <button key={table.id} type="button" style={{ gridRow: Math.floor(table.position / 4) + 1, gridColumn: table.position % 4 + 1 }}
            aria-label={`${table.name}, ${table.seats} seats, ${isCombined ? 'Combined' : isOccupied ? 'Occupied' : 'Available'}`} aria-pressed={anchor.id === selectedId} onClick={() => selectTable(table)}
            className={`flex min-h-28 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center ${anchor.id === selectedId ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
            {chairs(Math.ceil(table.seats / 2))}
            <span className={`w-full truncate rounded-lg border px-1 py-3 text-sm font-semibold ${isOccupied ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`} translate="no">{table.name}</span>
            {chairs(Math.floor(table.seats / 2))}
            <span className="text-xs text-muted-foreground">{isCombined ? 'Combined' : isOccupied ? 'Occupied' : 'Available'}</span>
          </button>
        })}
      </div></div> : <div className="flex min-h-48 flex-col items-center justify-center gap-3"><DiningTableIcon className="size-8 text-primary" /><h2 className="font-semibold">No tables yet</h2></div>}</CardContent></Card>
      <Card className="gap-inset border-0 bg-background p-inset shadow-sm">{selected ? <>
        <CardHeader className="px-0"><CardTitle translate="no">{[selected, ...tables.filter(table => selected.combinedTableIds?.includes(table.id))].map(table => table.name).join(' + ')}</CardTitle></CardHeader>
        <CardContent className="space-y-inset px-0"><div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><UsersRound className="size-4" />{selected.openedAt ? `${selected.guests} guests · ` : ''}{selectedCapacity} seats</span>{selected.openedAt && <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{new Date(selected.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div>
          {selected.openedAt ? <><div className="space-y-2"><Label htmlFor="occupied-table-guests">Guests</Label><div className="flex gap-2"><Input id="occupied-table-guests" type="number" min="1" max={selectedCapacity} value={guests} onChange={event => setGuests(event.target.value)} /><Button variant="outline" className="border-input" disabled={busy || Number(guests) === selected.guests || !validGuests} onClick={() => visit('guests')}>Save</Button></div></div><div className="space-y-3 border-y-[0.75pt] border-border py-inset">{selected.order.length ? selected.order.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {itemName(item.id)}</span><span className="shrink-0">{money(lineTotal(item))}</span></div>) : <p className="text-sm text-muted-foreground">No items yet</p>}</div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total</span><strong className="text-xl">{money(selectedTotal)}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Avg. per guest</span><strong>{money(Math.round(selectedTotal / selected.guests))}</strong></div><Button variant="outline" className="w-full border-input" disabled={busy || !availableMoves.length} onClick={() => startTransfer('move')}>Move table</Button><Button className="w-full" disabled={busy} onClick={() => openOrder(selected)}>{selected.order.length ? 'View order' : 'Add items'}</Button>{!selected.order.length && <Button variant="outline" className="w-full border-input" disabled={busy} onClick={() => visit('close')}>Close table</Button>}</> : <><div className="space-y-2"><Label htmlFor="table-guests">Guests</Label><Input id="table-guests" type="number" min="1" max={selectedCapacity} value={guests} onChange={event => setGuests(event.target.value)} /></div><Button className="w-full" disabled={busy || !validGuests} onClick={() => visit('open')}>Open table</Button></>}
          <Button variant="outline" className="w-full" disabled={busy || !otherTables.length} onClick={() => startTransfer('combine')}>Combine tables</Button>
        </CardContent>
      </> : <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 px-0"><DiningTableIcon className="size-8 text-primary" /><h2 className="font-semibold">Select a table</h2></CardContent>}</Card>
    </div>
    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-0 shadow-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Table setup</DialogTitle>
          <DialogDescription>Set the table names, chair counts, and positions on the floor.</DialogDescription>
        </DialogHeader>
        {showForm ? <form onSubmit={save} className="space-y-inset">
          <div className="space-y-2"><Label htmlFor="table-name">Name</Label><Input id="table-name" value={name} onChange={event => setName(event.target.value)} required maxLength={40} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2"><Label htmlFor="table-seats">Chairs</Label><Input id="table-seats" type="number" min="1" max="100" value={seats} onChange={event => setSeats(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="table-row">Row</Label><Input id="table-row" type="number" min="1" max="50" value={row} onChange={event => setRow(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="table-column">Column</Label><Input id="table-column" type="number" min="1" max="4" value={column} onChange={event => setColumn(event.target.value)} required /></div>
          </div>
          {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={busy}>{editing ? 'Save' : 'Add table'}</Button>
          </DialogFooter>
        </form> : <div className="space-y-2">
          {[...tables].sort((a, b) => a.position - b.position).map(table => <div key={table.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium" translate="no">{table.name}</div>
              <div className="text-xs text-muted-foreground">{table.seats} seats · <span>Row</span> {Math.floor(table.position / 4) + 1} · <span>Column</span> {table.position % 4 + 1}</div>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${table.name}`} disabled={busy || !!anchorFor(table).combinedTableIds?.length} onClick={() => editTable(table)}><SquarePen /></Button>
            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Remove ${table.name}`} disabled={busy || !!anchorFor(table).openedAt} onClick={() => setRemoving(table)}><Trash2 /></Button>
          </div>)}
          <Button disabled={busy || tables.length >= 100} onClick={() => editTable(null)}><Plus />Add table</Button>
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={transfer !== null} onOpenChange={open => { if (!open) setTransfer(null) }}>
      <DialogContent className="gap-inset border-0 shadow-xl sm:max-w-[330pt]">
        <DialogHeader>
          <DialogTitle>{transfer === 'combine' ? 'Combine tables' : 'Move table'}</DialogTitle>
          <DialogDescription>{transfer === 'combine' ? 'The selected tables will share one order and bill.' : 'The guests and saved order will move to the selected table.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitTransfer} className="space-y-inset">
          <div className="space-y-2">
            <Label htmlFor="destination-table">Destination table</Label>
            <div className="relative">
              <select id="destination-table" className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-10 text-sm" value={destinationId ?? ''} onChange={event => setDestinationId(Number(event.target.value))}>
                {!destination && <option value="">Select a table</option>}
                {destinations.map(table => <option key={table.id} value={table.id} translate="no">{table.name}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </div>
          </div>
          {startingParty && <div className="space-y-2"><Label htmlFor="combined-guests">Guests</Label><Input id="combined-guests" type="number" min="1" max={selectedCapacity + capacity(destination)} value={partySize} onChange={event => setPartySize(event.target.value)} required /></div>}
          {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setTransfer(null)}>Cancel</Button>
            <Button disabled={busy || !destination}>{transfer === 'combine' ? 'Combine tables' : 'Move table'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle><AlertDialogDescription>The table will be removed from the floor.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={remove}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
