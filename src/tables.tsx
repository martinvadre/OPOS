import { useState, type FormEvent } from 'react'
import { ChevronDown, Clock3, Plus, RefreshCw, RotateCw, SquarePen, Trash2, UsersRound } from 'lucide-react'
import { DiningTableIcon } from '@/table-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type TableGrid = { columns: number; rows: number }
export type TableItem = { id: number; quantity: number; addons: number[] }
const tableSizes = ['M', '2M', 'L'] as const
type TableSize = typeof tableSizes[number]
const chairSides = ['Top', 'Right', 'Bottom', 'Left'] as const
const defaultChairs: Record<TableSize, number[]> = { M: [2, 0, 2, 0], '2M': [4, 0, 4, 0], L: [3, 0, 3, 0] }
export type DiningTable = { id: number; name: string; seats: number; guests: number; openedAt: string | null; order: TableItem[]; version: number; position: number; rotation?: 0 | 90; size?: TableSize; chairLayout?: number[]; combinedTableIds?: number[] }
type Props = {
  tables: DiningTable[]
  grid: TableGrid
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

function TableShape({ name, seats, size, chairLayout, rotation, occupied }: Pick<DiningTable, 'name' | 'seats' | 'size' | 'chairLayout' | 'rotation'> & { occupied: boolean }) {
  const vertical = rotation === 90
  const layout = chairLayout || [Math.ceil(seats / 2), 0, Math.floor(seats / 2), 0]
  const [top, right, bottom, left] = vertical ? [layout[3], layout[0], layout[1], layout[2]] : layout
  const actualSize = size || (seats > 4 ? 'L' : 'M')
  const shape = {
    M: 'size-24',
    '2M': vertical ? 'h-48 w-24' : 'h-24 w-48',
    L: vertical ? 'h-30 w-24' : 'h-24 w-30',
  }[actualSize]

  function chairs(count: number, side: 'top' | 'right' | 'bottom' | 'left') {
    if (!count) return null
    const sideways = side === 'left' || side === 'right'
    const dense = count > 4
    const tracks = `repeat(${Math.min(count, dense ? 12 : 4)}, ${dense ? 6 : 18}px)`
    const bar = dense
      ? sideways ? 'h-1.5 w-0.5' : 'h-0.5 w-1.5'
      : sideways ? 'h-[18px] w-1.5' : 'h-1.5 w-[18px]'
    const position = { top: 'col-start-2 row-start-1', right: 'col-start-3 row-start-2', bottom: 'col-start-2 row-start-3', left: 'col-start-1 row-start-2' }[side]
    return <span aria-hidden="true" className={`grid place-self-center gap-px ${position}`} style={sideways
      ? { gridTemplateRows: tracks, gridAutoFlow: 'column' }
      : { gridTemplateColumns: tracks }}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`${bar} rounded-full ${occupied ? 'bg-orange-400' : 'bg-slate-400'}`} />
      ))}
    </span>
  }

  return <span className="grid grid-cols-[auto_auto_auto] grid-rows-[auto_auto_auto] gap-1">
    {chairs(top, 'top')}
    {chairs(right, 'right')}
    {chairs(bottom, 'bottom')}
    {chairs(left, 'left')}
    <span className={`${shape} relative col-start-2 row-start-2 grid place-items-center rounded-lg border ${occupied ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {actualSize === '2M' && <span aria-hidden="true" className={`absolute border-current opacity-25 ${vertical ? 'inset-x-0 top-1/2 border-t' : 'inset-y-0 left-1/2 border-l'}`} />}
      <span className="relative line-clamp-2 max-w-full wrap-anywhere px-2 text-center text-sm font-semibold" translate="no" title={name}>{name}</span>
    </span>
  </span>
}

export function TablesPage({ tables, grid, request, refresh, openOrder, transferOrder, onGuestUpdated, itemName, lineTotal, onError }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<DiningTable | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingGrid, setEditingGrid] = useState(false)
  const [gridColumns, setGridColumns] = useState('4')
  const [gridRows, setGridRows] = useState('4')
  const { columns, rows } = grid
  const slots = columns * rows
  const canAdd = tables.length < Math.min(slots, 100)
  const [row, setRow] = useState('1')
  const [column, setColumn] = useState('1')
  const [rotation, setRotation] = useState<0 | 90>(0)
  const [name, setName] = useState('')
  const [size, setSize] = useState<TableSize>('M')
  const [chairLayout, setChairLayout] = useState<number[]>(defaultChairs.M)
  const seats = chairLayout.reduce((sum, count) => sum + count, 0)
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

  function editTable(table: DiningTable | null, slot?: number) {
    const position = table?.position ?? slot ?? Array.from({ length: slots }, (_, index) => index).find(index => !tables.some(existing => existing.position === index)) ?? 0
    setDialogError('')
    setEditing(table)
    setName(table?.name || `Table ${Math.max(0, ...tables.map(table => table.id)) + 1}`)
    setSize(table?.size || (table && table.seats > 4 ? 'L' : 'M'))
    setChairLayout(table?.chairLayout || (table ? [Math.ceil(table.seats / 2), 0, Math.floor(table.seats / 2), 0] : defaultChairs.M))
    setRotation(table?.rotation ?? 0)
    setRow(String(Math.floor(position / columns) + 1))
    setColumn(String(position % columns + 1))
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
      await request<DiningTable>(editing ? `tables/${editing.id}` : 'tables', editing ? 'PATCH' : 'POST', { name: name.trim(), seats, size, chairLayout, rotation, gridColumns: columns, position: (Number(row) - 1) * columns + Number(column) - 1, ...(editing ? { action: 'details', version: editing.version } : {}) })
      setShowForm(false); await refresh()
    } catch (cause) { setDialogError(cause instanceof Error ? cause.message : 'Could not save table') } finally { setBusy(false) }
  }
  async function saveGrid(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setDialogError('')
    try {
      await request('tables/grid', 'PUT', { columns: Number(gridColumns), rows: Number(gridRows) })
      await refresh()
      setEditingGrid(false)
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'Could not save grid')
    } finally {
      setBusy(false)
    }
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
    try { await request(`tables/${removing.id}`, 'DELETE'); setRemoving(null); setShowForm(false); await refresh() }
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

  function renderFloor(setup: boolean) {
    const byPosition = new Map(tables.map(table => [table.position, table]))
    const cellWidth = tables.some(table => table.size === '2M') ? 16.5 : 10
    return <div className="max-h-[60dvh] overflow-auto p-1">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(${cellWidth}rem, 1fr))`, minWidth: `calc(${columns * cellWidth}rem + ${(columns - 1) * 0.5}rem)` }}>
        {Array.from({ length: slots }, (_, position) => {
          const table = byPosition.get(position)
          if (!table) {
            return setup && canAdd
              ? <button key={position} type="button" disabled={busy} aria-label={`Add table at row ${Math.floor(position / columns) + 1}, column ${position % columns + 1}`}
                  className="grid min-h-40 place-items-center rounded-xl border border-dashed border-input text-muted-foreground hover:bg-muted"
                  onClick={() => editTable(null, position)}><Plus className="size-4" /></button>
              : <span key={position} aria-hidden="true" className="min-h-40" />
          }
          const anchor = anchorFor(table)
          const occupied = !!anchor.openedAt
          const combined = !!anchor.combinedTableIds?.length
          const status = combined ? 'Combined' : occupied ? 'Occupied' : 'Available'
          const selected = !setup && anchor.id === selectedId
          return <button key={position} type="button"
            aria-label={`${setup ? 'Edit ' : ''}${table.name}, ${table.seats} seats, ${status}`}
            aria-pressed={setup ? undefined : selected}
            disabled={setup && (busy || combined)}
            onClick={() => setup ? editTable(table) : selectTable(table)}
            className={`flex min-h-40 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center disabled:opacity-60 ${selected ? 'border-primary bg-primary/5' : setup ? 'border-border hover:bg-muted' : 'border-transparent hover:bg-muted'}`}>
            <TableShape name={table.name} seats={table.seats} size={table.size} chairLayout={table.chairLayout} rotation={table.rotation} occupied={occupied} />
            <span className="text-xs text-muted-foreground">{status}</span>
          </button>
        })}
      </div>
    </div>
  }

  return <>
    <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] items-center justify-between gap-3"><h1 className="text-[21pt] font-bold leading-tight tracking-tight">Tables</h1><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="rounded-full border-input" aria-label="Refresh tables" disabled={busy} onClick={async () => { setBusy(true); try { await refresh() } catch (cause) { onError(cause) } finally { setBusy(false) } }}><RefreshCw /></Button><Button className="h-[calc(var(--radius-card)*2)] rounded-full has-[>svg]:px-inset" onClick={() => { setDialogError(''); setShowForm(false); setEditingGrid(false); setDialog(true) }}><SquarePen />Table setup</Button></div></div>
    <div className="mb-inset flex items-center gap-4 text-sm"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-slate-400" />Available {tables.length - occupied}</span><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-orange-500" />Occupied {occupied}</span></div>
    <div className="grid items-start gap-inset xl:grid-cols-[minmax(0,1fr)_255pt]">
      <Card className="gap-0 border-0 bg-background p-inset shadow-sm"><CardContent className="px-0">{tables.length ? renderFloor(false) : <div className="flex min-h-48 flex-col items-center justify-center gap-3"><DiningTableIcon className="size-8 text-primary" /><h2 className="font-semibold">No tables yet</h2></div>}</CardContent></Card>
      <Card className="gap-inset border-0 bg-background p-inset shadow-sm">{selected ? <>
        <CardHeader className="px-0"><CardTitle translate="no">{[selected, ...tables.filter(table => selected.combinedTableIds?.includes(table.id))].map(table => table.name).join(' + ')}</CardTitle></CardHeader>
        <CardContent className="space-y-inset px-0"><div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><UsersRound className="size-4" />{selected.openedAt ? `${selected.guests} guests · ` : ''}{selectedCapacity} seats</span>{selected.openedAt && <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{new Date(selected.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div>
          {selected.openedAt ? <><div className="space-y-2"><Label htmlFor="occupied-table-guests">Guests</Label><div className="flex gap-2"><Input id="occupied-table-guests" type="number" min="1" max={selectedCapacity} value={guests} onChange={event => setGuests(event.target.value)} /><Button variant="outline" className="border-input" disabled={busy || Number(guests) === selected.guests || !validGuests} onClick={() => visit('guests')}>Save</Button></div></div><div className="space-y-3 border-y-[0.75pt] border-border py-inset">{selected.order.length ? selected.order.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {itemName(item.id)}</span><span className="shrink-0">{money(lineTotal(item))}</span></div>) : <p className="text-sm text-muted-foreground">No items yet</p>}</div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total</span><strong className="text-xl">{money(selectedTotal)}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Avg. per guest</span><strong>{money(Math.round(selectedTotal / selected.guests))}</strong></div><Button variant="outline" className="w-full border-input" disabled={busy || !availableMoves.length} onClick={() => startTransfer('move')}>Move table</Button><Button className="w-full" disabled={busy} onClick={() => openOrder(selected)}>{selected.order.length ? 'View order' : 'Add items'}</Button>{!selected.order.length && <Button variant="outline" className="w-full border-input" disabled={busy} onClick={() => visit('close')}>Close table</Button>}</> : <><div className="space-y-2"><Label htmlFor="table-guests">Guests</Label><Input id="table-guests" type="number" min="1" max={selectedCapacity} value={guests} onChange={event => setGuests(event.target.value)} /></div><Button className="w-full" disabled={busy || !validGuests} onClick={() => visit('open')}>Open table</Button></>}
          <Button variant="outline" className="w-full" disabled={busy || !otherTables.length} onClick={() => startTransfer('combine')}>Combine tables</Button>
        </CardContent>
      </> : <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 px-0"><DiningTableIcon className="size-8 text-primary" /><h2 className="font-semibold">Select a table</h2></CardContent>}</Card>
    </div>
    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogContent aria-describedby={undefined} className="max-h-[85dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto border-0 shadow-xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Table setup</DialogTitle>
        </DialogHeader>
        {editingGrid ? <form onSubmit={saveGrid} className="space-y-inset">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label htmlFor="grid-columns">Columns</Label><Input id="grid-columns" type="number" min="1" max="12" value={gridColumns} onChange={event => setGridColumns(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="grid-rows">Rows</Label><Input id="grid-rows" type="number" min="1" max="50" value={gridRows} onChange={event => setGridRows(event.target.value)} required /></div>
          </div>
          {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditingGrid(false)}>Cancel</Button>
            <Button disabled={busy}>Save</Button>
          </DialogFooter>
        </form> : showForm ? <form onSubmit={save} className="space-y-inset">
          <div className="space-y-2"><Label htmlFor="table-name">Name</Label><Input id="table-name" value={name} onChange={event => setName(event.target.value)} required maxLength={40} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label htmlFor="table-row">Row</Label><Input id="table-row" type="number" min="1" max={rows} value={row} onChange={event => setRow(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="table-column">Column</Label><Input id="table-column" type="number" min="1" max={columns} value={column} onChange={event => setColumn(event.target.value)} required /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Table size</legend>
            <div className="flex flex-wrap gap-2">
              {tableSizes.map(option => <Button key={option} type="button" variant={option === size ? 'default' : 'outline'} aria-pressed={option === size}
                onClick={() => { if (option !== size) { setSize(option); setChairLayout(defaultChairs[option]) } }}>
                {option === '2M' ? '2 × M' : option} <span>{option === 'M' ? 'Square' : option === 'L' ? 'Rectangle' : 'Joined squares'}</span>
              </Button>)}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Chair layout</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {chairSides.map((side, index) => {
                const slot = rotation === 90 ? (index + 3) % 4 : index
                return <div key={side} className="space-y-2">
                <Label htmlFor={`chairs-${index}`}>{side}</Label>
                <Input id={`chairs-${index}`} type="number" min="0" max="100" required value={chairLayout[slot]} onChange={event => {
                  const count = Number(event.target.value)
                  setChairLayout(layout => layout.map((value, current) => current === slot ? count : value))
                }} />
                </div>
              })}
            </div>
            <p className="text-sm text-muted-foreground">{seats} <span>Chairs</span></p>
          </fieldset>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <TableShape name={name} seats={seats} size={size} chairLayout={chairLayout.map(count => Math.min(100, Math.max(0, Math.floor(count))))} rotation={rotation} occupied={false} />
            <Button type="button" variant="outline" onClick={() => setRotation(value => value === 0 ? 90 : 0)}><RotateCw />Rotate table</Button>
          </div>
          {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            {editing && <Button type="button" variant="ghost" className="mr-auto text-destructive" disabled={busy || !!anchorFor(editing).openedAt} onClick={() => setRemoving(editing)}><Trash2 />Remove</Button>}
            <Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={busy || seats < 1 || seats > 100}>{editing ? 'Save' : 'Add table'}</Button>
          </DialogFooter>
        </form> : <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={busy} onClick={() => {
              setGridColumns(String(columns))
              setGridRows(String(rows))
              setDialogError('')
              setEditingGrid(true)
            }}><SquarePen />Edit grid <span className="text-muted-foreground">{columns} × {rows}</span></Button>
            <Button disabled={busy || !canAdd} onClick={() => editTable(null)}><Plus />Add table</Button>
          </div>
          {renderFloor(true)}
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
