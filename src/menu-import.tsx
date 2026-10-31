import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { parseMenuCsv, type ImportedMenuItem } from '../menu-import.mjs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function MenuImport({ names, onImport, onError }: { names: string[]; onImport: (csv: string) => Promise<void>; onError: (cause: unknown) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [csv, setCsv] = useState('')
  const [filename, setFilename] = useState('')
  const [items, setItems] = useState<ImportedMenuItem[]>([])
  const input = useRef<HTMLInputElement>(null)
  const seen = new Set(names.map(name => name.trim().toLowerCase()))
  const preview = items.map(item => { const key = item.name.toLowerCase(); const skip = seen.has(key); seen.add(key); return { ...item, skip } })
  const count = preview.filter(item => !item.skip).length

  async function readFile(file?: File) {
    if (!file || busy) return
    setBusy(true); setCsv(''); setItems([]); setFilename('')
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Choose a .csv file. Download the template for the correct format.')
      if (file.size > 1000000) throw new Error('Use a CSV file smaller than 1 MB')
      const text = await file.text()
      const parsed = parseMenuCsv(text)
      setCsv(text); setItems(parsed); setFilename(file.name)
    } catch (cause) { onError(cause) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  async function importItems() {
    setBusy(true)
    try { await onImport(csv); setOpen(false); setCsv(''); setItems([]); setFilename('') }
    catch (cause) { onError(cause) }
    finally { setBusy(false) }
  }

  return <>
    <Button variant="outline" className="h-[calc(var(--radius-card)*2)] rounded-full border-input px-4" onClick={() => setOpen(true)}><Upload />Import CSV</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <DialogContent className="max-h-[calc(100dvh-32px)] gap-inset overflow-y-auto border-0 shadow-xl sm:max-w-[540pt]">
        <DialogHeader className="pr-8"><DialogTitle>Import menu</DialogTitle><DialogDescription>Prices are in baht. Blank prices become ฿0. Existing item names are skipped.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">CSV · up to 500 items · 1 MB maximum</span><Button variant="ghost" size="sm" asChild><a href="/assets/menu-template.csv" download><Download />Download template</a></Button></div>
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-input bg-muted/30 p-6 text-center transition-colors hover:border-primary/40" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) return onError('Drop one CSV file at a time'); void readFile(event.dataTransfer.files[0]) }}>
          <Upload className="size-7 text-primary" /><p className="text-sm font-medium">{filename || 'Drop your CSV file here'}</p><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Please wait…' : filename ? 'Choose another file' : 'Choose CSV'}</Button><input ref={input} type="file" accept=".csv,text/csv" aria-label="Menu CSV file" className="hidden" onChange={event => { void readFile(event.target.files?.[0]) }} />
        </div>
        <p className="text-xs text-muted-foreground">Columns: Product, Category, Price, Add-ons. Product names are required; Price can be blank. Add-ons: Cream cheese:10|Pearls:5.</p>
        {items.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">{count} new {count === 1 ? 'item' : 'items'} · {items.length - count} skipped</p><div className="max-h-60 overflow-auto rounded-xl border border-border [&_tr]:border-border [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Add-ons</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{preview.map((item, index) => <TableRow key={index} className={item.skip ? 'text-muted-foreground' : undefined}><TableCell className="max-w-48 truncate font-medium" translate="no">{item.name}</TableCell><TableCell>{item.category || '—'}</TableCell><TableCell>{(item.price / 100).toFixed(2)}</TableCell><TableCell className="max-w-56 truncate">{item.addons.map(addon => `${addon.name} ฿${(addon.price / 100).toFixed(2)}`).join(', ') || '—'}</TableCell><TableCell>{item.skip ? 'Duplicate name' : 'New'}</TableCell></TableRow>)}</TableBody></Table></div></div>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !count} onClick={importItems}>{busy ? 'Importing…' : `Add ${count || ''} ${count === 1 ? 'item' : 'items'}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
