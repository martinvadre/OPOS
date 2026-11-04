import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const units = ['pcs', 'ml', 'g', 'oz'] as const
type Unit = typeof units[number]
export type StockItem = {
  id: number
  name: string
  unit: Unit
  quantity: number
  unitCost: number
  lastPurchase: { quantity: number; cost: number }
}
export type RecipeLine = { stockId: number; quantity: number }

const currency = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })
const formatMoney = (satang: number) => currency.format(satang / 100)
const formatQuantity = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 })
const selectStyle = 'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm'

export function RecipeEditor({ stock, recipe, onChange }: {
  stock: StockItem[]
  recipe: RecipeLine[]
  onChange: (recipe: RecipeLine[]) => void
}) {
  const unused = stock.filter(item => !recipe.some(line => line.stockId === item.id))
  const byId = new Map(stock.map(item => [item.id, item]))
  const cost = recipe.reduce((sum, line) => sum + line.quantity * (byId.get(line.stockId)?.unitCost ?? 0), 0)

  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium">Stock recipe</legend>
    {recipe.map((line, index) => {
      const item = byId.get(line.stockId)
      return <div key={index} className="grid grid-cols-[minmax(0,1fr)_6rem_auto_auto] items-center gap-2">
        <select aria-label="Stock item" className={selectStyle} value={line.stockId} onChange={event => {
          onChange(recipe.map((entry, i) => i === index ? { stockId: Number(event.target.value), quantity: 1 } : entry))
        }}>
          {[...(item ? [item] : []), ...unused].map(choice => <option key={choice.id} value={choice.id} translate="no">{choice.name}</option>)}
        </select>
        <Input aria-label="Quantity per item" type="number" min={item?.unit === 'pcs' ? 1 : 0.001} max={100000} step={item?.unit === 'pcs' ? 1 : 0.001}
          required value={line.quantity || ''} onChange={event => {
            onChange(recipe.map((entry, i) => i === index ? { ...entry, quantity: Number(event.target.value) } : entry))
          }} />
        <span className="text-xs text-muted-foreground">{item?.unit}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove ingredient" onClick={() => onChange(recipe.filter((_, i) => i !== index))}><X /></Button>
      </div>
    })}
    {stock.length === 0 && <p className="text-sm text-muted-foreground">Add ingredients and packaging on the Stock page first.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!unused.length || recipe.length >= 50}
        onClick={() => onChange([...recipe, { stockId: unused[0].id, quantity: 1 }])}><Plus />Add ingredient</Button>
      {!!recipe.length && <span className="text-sm text-muted-foreground"><span>Recipe cost</span> {formatMoney(cost)}</span>}
    </div>
  </fieldset>
}

export function StockPage({ stock, savePurchase }: {
  stock: StockItem[]
  savePurchase: (id: number | null, input: { name: string; unit: Unit; quantity: number; cost: number }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<StockItem | null>(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('pcs')
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function startPurchase(item: StockItem | null) {
    setSelected(item)
    setName(item?.name ?? '')
    setUnit(item?.unit ?? 'pcs')
    setQuantity('')
    setCost('')
    setError('')
    setOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await savePurchase(selected?.id ?? null, { name, unit, quantity: Number(quantity), cost: Math.round(Number(cost) * 100) })
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save purchase')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] flex-wrap items-center justify-between gap-3">
      <h1 className="text-[21pt] font-bold leading-tight tracking-tight">Stock</h1>
      <Button className="h-[calc(var(--radius-card)*2)] rounded-full" onClick={() => startPurchase(null)}><Plus />Add stock item</Button>
    </div>
    <Card className="gap-0 overflow-hidden border-0 bg-background py-0 shadow-sm">
      {stock.length ? <Table>
        <TableHeader><TableRow>
          <TableHead className="pl-inset">Stock item</TableHead>
          <TableHead>On hand</TableHead>
          <TableHead>Latest purchase</TableHead>
          <TableHead className="text-right pr-inset">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>{stock.map(item => <TableRow key={item.id}>
          <TableCell className="pl-inset font-medium"><span translate="no">{item.name}</span></TableCell>
          <TableCell className={item.quantity < 0 ? 'font-semibold text-destructive' : ''}>{formatQuantity.format(item.quantity)} {item.unit}</TableCell>
          <TableCell>{formatQuantity.format(item.lastPurchase.quantity)} {item.unit} · {formatMoney(item.lastPurchase.cost)}</TableCell>
          <TableCell className="pr-inset text-right"><Button variant="outline" size="sm" onClick={() => startPurchase(item)}>Restock</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="p-inset text-sm text-muted-foreground">Add ingredients and packaging to start tracking stock.</p>}
    </Card>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <DialogContent aria-describedby={undefined} className="border-0">
        <DialogHeader><DialogTitle>{selected ? 'Restock' : 'Add stock item'}</DialogTitle></DialogHeader>
        <form className="space-y-inset" onSubmit={submit}>
          {selected ? <p className="font-medium" translate="no">{selected.name}</p> : <>
            <div className="space-y-2"><Label htmlFor="stock-name">Name</Label><Input id="stock-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="stock-unit">Unit</Label><select id="stock-unit" className={selectStyle} value={unit} onChange={event => setUnit(event.target.value as Unit)}>
              {units.map(value => <option key={value} value={value}>{value}</option>)}
            </select></div>
          </>}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label htmlFor="stock-quantity"><span>Purchase quantity</span> ({unit})</Label>
              <Input id="stock-quantity" type="number" min={unit === 'pcs' ? 1 : 0.001} max={1000000000} step={unit === 'pcs' ? 1 : 0.001} required value={quantity} onChange={event => setQuantity(event.target.value)} />
            </div>
            <div className="space-y-2"><Label htmlFor="stock-cost">Purchase cost (฿)</Label>
              <Input id="stock-cost" type="number" min={0} max={1000000} step={0.01} required value={cost} onChange={event => setCost(event.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
}
