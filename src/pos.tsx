import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheck, CircleAlert, ArrowUp, ArrowDown, ArrowUpDown, Delete, Utensils, CalendarDays, ChartNoAxesColumn, ChevronDown, ChevronLeft, ChevronRight, ConciergeBell, Download, Eye, EyeOff, TicketPercent, LogOut, Package, Plus, Settings, ShoppingCart, SquarePen, Trash2, Minus, X } from 'lucide-react'
import { DropdownMenu, Popover } from 'radix-ui'
import cocoaImg from '@/assets/cocoa.png'
import thaiTeaImg from '@/assets/thai-tea.png'

const productImages: Record<string, string> = { 'thai tea': thaiTeaImg, cocoa: cocoaImg }
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AnimatedSize } from '@/components/ui/animated-size'
import { DiningTableIcon } from '@/table-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Sidebar, SidebarContent, SidebarFooter, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablesPage, type DiningTable } from '@/tables'
import { MenuImport } from '@/menu-import'
import { CategorySelector } from '@/category-selector'
import { applyLanguage, type Language } from '@/language'

type Addon = { name: string; price: number }
type Product = { id: number; name: string; category?: string; price: number; addons: Addon[]; hidden: boolean; image?: string }
type Sale = { id: number; date: string; total: number; discount?: number; payment: string; items: { id: number; name: string; price: number; quantity: number; addons?: Addon[] }[] }
type CartItem = { id: number; quantity: number; addons: number[] }
type PromotionEffect = { type: 'fixed' | 'percent'; value: number } | { type: 'free_addon'; addonName: string }
type Promotion = { id: number; name: string; effects?: PromotionEffect[]; type?: 'fixed' | 'percent'; value?: number; categories?: string[] | null; productIds?: number[] | null; hidden?: boolean }
type EffectForm = { type: PromotionEffect['type'] | 'none'; value: string; addonName: string }
const emptyPromotionEffects = (): EffectForm[] => [{ type: 'fixed', value: '', addonName: '' }, { type: 'none', value: '', addonName: '' }]
const effectToForm = (effect: PromotionEffect): EffectForm => effect.type === 'free_addon' ? { type: effect.type, value: '', addonName: effect.addonName } : { type: effect.type, value: effect.type === 'fixed' ? (effect.value / 100).toFixed(2) : String(effect.value), addonName: '' }
const promotionTypeLabels: Record<EffectForm['type'], string> = { none: 'None', fixed: 'Baht off', percent: 'Percent off', free_addon: 'Free add-on' }
type Tab = 'dashboard' | 'pos' | 'inventory' | 'reports' | 'settings' | 'tables'
type Payment = 'cash' | 'promptpay' | `manual:${string}`
type ProductForm = { name: string; category: string; price: string; addons: { name: string; price: string }[]; image: string; imageName: string }
const emptyForm = (): ProductForm => ({ name: '', category: '', price: '', addons: [], image: '', imageName: '' })
const cartKey = (item: CartItem) => `${item.id}:${item.addons.join(',')}`
const baht = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })
const money = (satang: number) => baht.format(satang / 100)
const paymentLabel = (payment: string) => payment === 'cash' ? 'Cash' : payment === 'promptpay' ? 'PromptPay' : payment.startsWith('manual:') ? payment.slice(7) : payment
const menuCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const toCents = (value: string) => Math.round(Number(value) * 100)
function cashKeyValue(value: string, key: string) {
  if (key === 'Clear' || key === 'Delete') return ''
  if (key === 'Backspace') return value.slice(0, -1)
  if (!/^[0-9.]$/.test(key)) return value
  const next = key === '.' && !value ? '0.' : value === '0' && key !== '.' ? key : value + key
  return /^\d{1,9}(\.\d{0,2})?$/.test(next) ? next : value
}
const effectsOf = (promotion: Promotion): PromotionEffect[] => promotion.effects || (promotion.type && promotion.value !== undefined ? [{ type: promotion.type, value: promotion.value }] : [])
const effectLabel = (effect: PromotionEffect) => effect.type === 'free_addon' ? `Free ${effect.addonName}` : effect.type === 'fixed' ? `${money(effect.value)} off` : `${effect.value}% off`
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDate = (day: string, amount: number) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + amount); return dateKey(date) }
const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
function savedReportRange() {
  const today = dateKey(new Date())
  const fallback = { from: shiftDate(today, -6), to: today }
  try {
    const saved = JSON.parse(localStorage.getItem('opos-report-range') || 'null')
    const validDay = (day: unknown) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dateKey(new Date(`${day}T12:00:00`)) === day
    if (validDay(saved?.from) && validDay(saved?.to) && saved.to <= today && dayCount(saved.from, saved.to) >= 1 && dayCount(saved.from, saved.to) <= 366) return { from: saved.from as string, to: saved.to as string }
  } catch { /* Use the default range if the saved preference is invalid. */ }
  return fallback
}
function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
async function api<T>(route: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch(`/api/${route}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Request failed')
  return result as T
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('opos-language') === 'th' ? 'th' : 'en')
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [showStatusText, setShowStatusText] = useState(true)
  const [password, setPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [settingsUsername, setSettingsUsername] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const usernameBeforeEdit = useRef('')
  const [promptpayId, setPromptpayId] = useState('')
  const [promptpayEnabled, setPromptpayEnabled] = useState(false)
  const [editingPromptpay, setEditingPromptpay] = useState(false)
  const promptpayBeforeEdit = useRef('')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [promptpayConfigured, setPromptpayConfigured] = useState(false)
  const [manualPayments, setManualPayments] = useState<string[]>([])
  const [manualPaymentDraft, setManualPaymentDraft] = useState<string[]>([])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [restaurantEnabled, setRestaurantEnabled] = useState(false)
  const [tables, setTables] = useState<DiningTable[]>([])
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [activeTableVersion, setActiveTableVersion] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('iaun-tab')
    return saved === 'dashboard' || saved === 'inventory' || saved === 'reports' || saved === 'settings' ? saved : 'pos'
  })
  const [reportView, setReportView] = useState<'sales' | 'menu' | null>(() => { const saved = localStorage.getItem('iaun-report-view'); return saved === 'sales' || saved === 'menu' ? saved : null })
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [menuSort, setMenuSort] = useState<{ key: 'name' | 'category'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' })
  const [reportSearch, setReportSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [paymentSort, setPaymentSort] = useState<'asc' | 'desc' | null>(null)
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null)
  const [renderedSaleId, setRenderedSaleId] = useState<number | null>(null)
  const collapseSaleTimer = useRef<number | null>(null)
  const [reportRange, setReportRange] = useState(savedReportRange)
  const { from: reportFrom, to: reportTo } = reportRange
  const [draftFrom, setDraftFrom] = useState(reportFrom)
  const [draftTo, setDraftTo] = useState(reportTo)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dateAnchor, setDateAnchor] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => `${dateKey(new Date()).slice(0, 7)}-01`)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [productDialog, setProductDialog] = useState(false)
  const [selectingProduct, setSelectingProduct] = useState<Product | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<number[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [payment, setPayment] = useState<Payment>('cash')
  const [received, setReceived] = useState('')
  const [selectedPromotionId, setSelectedPromotionId] = useState<number | null>(null)
  const [promotionName, setPromotionName] = useState('')
  const [promotionEffectsForm, setPromotionEffectsForm] = useState<EffectForm[]>(emptyPromotionEffects)
  const [promotionCategories, setPromotionCategories] = useState<string[] | null>(null)
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null)
  const [deletingPromotionId, setDeletingPromotionId] = useState<number | null>(null)
  const [promptpayQr, setPromptpayQr] = useState('')
  const [qrImageLoaded, setQrImageLoaded] = useState(false)
  const [qrError, setQrError] = useState('')
  const [busy, setBusy] = useState(false)
  const saleRequestId = useRef(requestId())

  useEffect(() => {
    if (renderedSaleId === null) return
    const frame = window.requestAnimationFrame(() => setExpandedSaleId(renderedSaleId))
    return () => window.cancelAnimationFrame(frame)
  }, [renderedSaleId])

  function toggleSaleDetails(id: number) {
    if (collapseSaleTimer.current !== null) window.clearTimeout(collapseSaleTimer.current)
    if (renderedSaleId === id) {
      if (expandedSaleId !== id) { setExpandedSaleId(id); return }
      setExpandedSaleId(null)
      collapseSaleTimer.current = window.setTimeout(() => setRenderedSaleId(current => current === id ? null : current), 250)
    } else {
      setExpandedSaleId(null)
      setRenderedSaleId(id)
    }
  }

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.error ? 7000 : 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => { localStorage.setItem('iaun-tab', tab) }, [tab])
  useEffect(() => { localStorage.setItem('opos-language', language); return applyLanguage(language) }, [language])
  useEffect(() => { if (reportView) localStorage.setItem('iaun-report-view', reportView); else localStorage.removeItem('iaun-report-view') }, [reportView])
  useEffect(() => { localStorage.setItem('opos-report-range', JSON.stringify(reportRange)) }, [reportRange])
  useEffect(() => { if (accountId !== null && activeTableId === null) localStorage.setItem(`iaun-cart:${accountId}`, JSON.stringify(cart)) }, [cart, accountId, activeTableId])
  useEffect(() => {
    if (!authenticated) return
    setShowStatusText(true)
    const timer = window.setTimeout(() => setShowStatusText(false), 3000)
    return () => window.clearTimeout(timer)
  }, [authenticated])

  async function refresh() {
    const state = await api<{ accountId?: number; promptpayEnabled?: boolean; promptpayConfigured?: boolean; manualPayments?: string[]; restaurantEnabled?: boolean; tables?: DiningTable[]; products: Product[]; sales: Sale[]; promotions: Promotion[] }>('state')
    const nextAccountId = state.accountId ?? 1
    setProducts(state.products)
    setSales(state.sales)
    setPromotions(state.promotions)
    setRestaurantEnabled(!!state.restaurantEnabled)
    setTables(state.tables || [])
    if (tab === 'tables' && !state.restaurantEnabled) setTab('pos')
    setPromptpayEnabled(!!state.promptpayEnabled)
    setPromptpayConfigured(!!state.promptpayConfigured)
    setManualPayments(state.manualPayments || ['Scan', 'EDC'])
    setSelectedPromotionId(current => current !== null && !state.promotions.some(p => p.id === current) ? null : current)
    setCart(current => {
      if (activeTableId !== null) return current
      let next = current
      if (accountId !== nextAccountId) {
        try { const saved: unknown = JSON.parse(localStorage.getItem(`iaun-cart:${nextAccountId}`) || '[]'); next = Array.isArray(saved) ? saved.filter((item): item is CartItem => item && Number.isSafeInteger(item.id) && Number.isSafeInteger(item.quantity) && item.quantity > 0 && Array.isArray(item.addons)) : [] } catch { next = [] }
      }
      return next.filter(item => { const product = state.products.find(p => p.id === item.id); return product && !product.hidden && item.addons.every(index => index >= 0 && index < product.addons.length) })
    })
    setAccountId(nextAccountId)
    setAuthenticated(true)
  }
  useEffect(() => { refresh().catch(() => setAuthenticated(false)) }, [])
  function error(message: unknown) { setNotice({ text: message instanceof Error ? message.message : String(message), error: true }) }
  async function login(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try { await api('login', 'POST', { username: loginUsername, password }); setPassword(''); setNotice(null); setTab('pos'); await refresh() }
    catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function signup(event: FormEvent) {
    event.preventDefault()
    if (password !== signupConfirm) return error('Passwords do not match')
    setBusy(true)
    try { await api('signup', 'POST', { username: loginUsername, password }); setPassword(''); setSignupConfirm(''); setNotice(null); setTab('pos'); await refresh() }
    catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function logout() {
    try { await api('logout', 'POST'); if (accountId !== null) localStorage.removeItem(`iaun-cart:${accountId}`); window.location.reload() } catch (cause) { error(cause) }
  }
  useEffect(() => {
    if (!authenticated || tab !== 'settings') return
    setSettingsLoaded(false); setEditingUsername(false); setEditingPromptpay(false)
    api<{ username: string; promptpayId?: string; promptpayEnabled?: boolean; manualPayments?: string[] }>('settings').then(result => { setSettingsUsername(result.username); setPromptpayId(result.promptpayId || ''); setPromptpayEnabled(!!result.promptpayEnabled); setManualPayments(result.manualPayments || ['Scan', 'EDC']); setManualPaymentDraft(result.manualPayments || ['Scan', 'EDC']); setSettingsLoaded(true) }).catch(error)
  }, [authenticated, tab])
  function selectTab(next: Tab) { setTab(next); setNotice(null); if (next === 'reports') setReportView(null); if (next !== 'pos' && next !== 'settings') refresh().catch(error) }
  async function toggleRestaurant(enabled: boolean) {
    setBusy(true)
    try { await api('restaurant', 'PUT', { enabled }); await refresh() }
    catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function saveUsername(event: FormEvent) {
    event.preventDefault()
    if (!editingUsername) { usernameBeforeEdit.current = settingsUsername; setEditingUsername(true); return }
    setBusy(true)
    try {
      const result = await api<{ username: string }>('settings', 'PUT', { username: settingsUsername })
      setSettingsUsername(result.username)
      setEditingUsername(false)
      setNotice({ text: 'Username updated', error: false })
    } catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirmPassword) return error('New passwords do not match')
    setBusy(true)
    try {
      await api('settings', 'PUT', { currentPassword, newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setNotice({ text: 'Password changed', error: false })
    } catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function savePromptpay(event: FormEvent) {
    event.preventDefault()
    if (!promptpayEnabled) return
    if (!editingPromptpay) { promptpayBeforeEdit.current = promptpayId; setEditingPromptpay(true); return }
    setBusy(true)
    try { const result = await api<{ promptpayId: string }>('settings', 'PUT', { promptpayId: promptpayId.trim() }); setPromptpayId(result.promptpayId); setEditingPromptpay(false); setPromptpayConfigured(!!result.promptpayId); setNotice({ text: 'PromptPay ID updated', error: false }) }
    catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function togglePromptpay(enabled: boolean) {
    setBusy(true)
    try {
      await api('settings', 'PUT', { promptpayEnabled: enabled })
      setPromptpayEnabled(enabled)
      setPromptpayConfigured(enabled && !!promptpayId)
      setEditingPromptpay(false)
      setNotice({ text: enabled ? 'PromptPay enabled' : 'PromptPay disabled', error: false })
    } catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function saveManualPayments(event: FormEvent) {
    event.preventDefault()
    const names = manualPaymentDraft.map(name => name.trim())
    if (names.some(name => !name || name.length > 30 || ['cash', 'promptpay'].includes(name.toLowerCase())) || new Set(names.map(name => name.toLowerCase())).size !== names.length) return error('Use unique payment names of 1–30 characters, excluding Cash and PromptPay')
    setBusy(true)
    try {
      const result = await api<{ manualPayments: string[] }>('settings', 'PUT', { manualPayments: names })
      setManualPayments(result.manualPayments)
      setManualPaymentDraft(result.manualPayments)
      setNotice({ text: 'Payment methods updated', error: false })
    } catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  function addToCart(product: Product, addons: number[] = []) {
    const next = { id: product.id, addons: addons.slice().sort((a, b) => a - b), quantity: 1 }
    setCart(current => {
      const item = current.find(item => cartKey(item) === cartKey(next))
      return item ? current.map(entry => cartKey(entry) === cartKey(next) ? { ...entry, quantity: entry.quantity + 1 } : entry) : [...current, next]
    })
  }
  function changeQuantity(key: string, amount: number) {
    setCart(current => current.map(item => cartKey(item) === key ? { ...item, quantity: item.quantity + amount } : item).filter(item => item.quantity > 0))
  }
  const lineTotal = (item: CartItem) => { const product = products.find(p => p.id === item.id); return product ? (product.price + item.addons.reduce((total, index) => total + (product.addons[index]?.price || 0), 0)) * item.quantity : 0 }
  const activeTable = tables.find(table => table.id === activeTableId)
  const tableOrderChanged = !!activeTable && JSON.stringify(cart.map(item => [item.id, item.quantity, item.addons])) !== JSON.stringify(activeTable.order.map(item => [item.id, item.quantity, item.addons]))
  function openTableOrder(table: DiningTable) {
    if ((activeTableId === null && cart.length) || tableOrderChanged) return error(activeTableId === null ? 'Finish or clear the current sale before opening a table order' : 'Save the current table order before switching tables')
    setActiveTableId(table.id); setActiveTableVersion(table.version); setCart(structuredClone(table.order)); setSelectedPromotionId(null); setTab('pos'); setCheckout(false); saleRequestId.current = requestId(); setNotice(null)
  }
  function leaveTableOrder() {
    if (tableOrderChanged) return error('Save the table order before leaving it')
    setActiveTableId(null); setActiveTableVersion(null); setCart([]); setSelectedPromotionId(null); setTab('tables')
  }
  async function saveTableOrder() {
    if (activeTableId === null) return
    const table = await api<DiningTable>(`tables/${activeTableId}`, 'PATCH', { action: 'order', version: activeTableVersion, items: cart })
    setActiveTableVersion(table.version)
    await refresh()
  }
  async function saveCurrentTable() {
    setBusy(true)
    try { await saveTableOrder(); setNotice({ text: 'Table order saved', error: false }) }
    catch (cause) { error(cause); await refresh().catch(() => {}) }
    finally { setBusy(false) }
  }
  async function prepareCheckout() {
    setBusy(true)
    try { if (activeTableId !== null) await saveTableOrder(); setPayment('cash'); setReceived(''); setCheckout(true) }
    catch (cause) { error(cause); await refresh().catch(() => {}) }
    finally { setBusy(false) }
  }
  const subtotal = cart.reduce((sum, item) => sum + lineTotal(item), 0)
  const availableAddonNames = Array.from(new Set(products.filter(product => !product.hidden && (!promotionCategories || promotionCategories.includes(product.category || ''))).flatMap(product => product.addons.map(addon => addon.name))))
  const promotionDiscount = (promotion: Promotion) => {
    const eligibleItems = cart.filter(item => promotion.categories != null ? promotion.categories.includes(products.find(product => product.id === item.id)?.category || '') : !promotion.productIds || promotion.productIds.includes(item.id))
    const eligible = eligibleItems.reduce((sum, item) => sum + lineTotal(item), 0)
    const effects = effectsOf(promotion)
    const freeNames = new Set(effects.filter(effect => effect.type === 'free_addon').map(effect => effect.addonName.trim().toLowerCase()))
    let discount = eligibleItems.flatMap(item => { const product = products.find(p => p.id === item.id); return item.addons.map(index => product?.addons[index]) }).find(addon => addon && freeNames.has(addon.name.toLowerCase()))?.price || 0
    let remaining = Math.max(0, eligible - discount)
    for (const effect of effects) {
      if (effect.type === 'free_addon') continue
      const amount = Math.min(remaining, effect.type === 'percent' ? Math.round(remaining * effect.value / 100) : effect.value)
      discount += amount
      remaining -= amount
    }
    return Math.min(eligible, discount)
  }
  const visiblePromotions = promotions.filter(promotion => !promotion.hidden)
  const availablePromotions = visiblePromotions.filter(promotion => promotionDiscount(promotion) > 0)
  const selectedPromotion = availablePromotions.find(p => p.id === selectedPromotionId)
  const discountAmount = selectedPromotion ? promotionDiscount(selectedPromotion) : 0
  const cartTotal = subtotal - discountAmount
  useEffect(() => { if (selectedPromotionId !== null && !selectedPromotion) setSelectedPromotionId(null) }, [selectedPromotionId, selectedPromotion])
  useEffect(() => {
    if (!checkout || payment !== 'promptpay') { setPromptpayQr(''); setQrImageLoaded(false); setQrError(''); return }
    if (cartTotal < 1) { setPromptpayQr(''); setQrError('PromptPay requires an amount above ฿0.'); return }
    let active = true
    setPromptpayQr('')
    setQrImageLoaded(false)
    setQrError('')
    api<{ qr: string }>(`promptpay?amount=${cartTotal}`).then(result => { if (active) setPromptpayQr(result.qr) }).catch(cause => { if (active) setQrError(cause instanceof Error ? cause.message : 'Could not generate QR code') })
    return () => { active = false }
  }, [checkout, payment, cartTotal])
  const menuCategories = Array.from(new Set(products.map(product => product.category || '').filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const suggestedCategories = menuCategories.filter(category => category.toLowerCase().includes(form.category.trim().toLowerCase())).slice(0, 6)
  const visibleCategories = Array.from(new Set(products.filter(product => !product.hidden).map(product => product.category || ''))).sort((a, b) => a.localeCompare(b))
  useEffect(() => { if (selectedCategory !== null && !visibleCategories.includes(selectedCategory)) setSelectedCategory(null) }, [products, selectedCategory])
  const matching = products.filter(p => !p.hidden && (selectedCategory === null || (p.category || '') === selectedCategory) && p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const sortedMenu = [...products].sort((a, b) => {
    const comparison = menuCollator.compare(a[menuSort.key] || '', b[menuSort.key] || '')
    return comparison ? comparison * (menuSort.direction === 'asc' ? 1 : -1) : menuCollator.compare(a.name, b.name)
  })
  function sortMenu(key: 'name' | 'category') {
    setMenuSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  }
  const paymentTypes = Array.from(new Set(['cash', ...(promptpayEnabled ? ['promptpay'] : manualPayments.map(name => `manual:${name}`)), ...sales.map(sale => sale.payment)]))
  const validReportRange = !!reportFrom && !!reportTo && dayCount(reportFrom, reportTo) > 0 && dayCount(reportFrom, reportTo) <= 366
  const reportDays = validReportRange ? dayCount(reportFrom, reportTo) : 0
  const priorFrom = validReportRange ? shiftDate(reportFrom, -reportDays) : ''
  const priorTo = validReportRange ? shiftDate(reportFrom, -1) : ''
  const matchesReport = (sale: Sale) => (paymentFilter === 'all' || sale.payment === paymentFilter) && (`${sale.id} ${sale.items.map(item => `${item.name} ${(item.addons || []).map(addon => addon.name).join(' ')}`).join(' ')}`).toLowerCase().includes(reportSearch.trim().toLowerCase())
  const filteredSales = validReportRange ? sales.filter(sale => { const day = dateKey(new Date(sale.date)); return day >= reportFrom && day <= reportTo && matchesReport(sale) }) : []
  const sortedSales = paymentSort ? [...filteredSales].sort((a, b) => paymentLabel(a.payment).localeCompare(paymentLabel(b.payment)) * (paymentSort === 'asc' ? 1 : -1)) : filteredSales
  const priorSales = validReportRange ? sales.filter(sale => { const day = dateKey(new Date(sale.date)); return day >= priorFrom && day <= priorTo && matchesReport(sale) }) : []
  const saleSum = filteredSales.reduce((sum, sale) => sum + sale.total, 0)
  const priorSum = priorSales.reduce((sum, sale) => sum + sale.total, 0)
  const discountSum = filteredSales.reduce((sum, sale) => sum + (sale.discount || 0), 0)
  const itemCount = filteredSales.reduce((sum, sale) => sum + sale.items.reduce((count, item) => count + item.quantity, 0), 0)
  const dailySales = Array.from({ length: reportDays }, (_, index) => { const day = shiftDate(reportFrom, index); const bills = filteredSales.filter(sale => dateKey(new Date(sale.date)) === day); return { day, total: bills.reduce((sum, sale) => sum + sale.total, 0), bills: bills.length } })
  const chartSales = reportDays === 1 ? Array.from({ length: 24 }, (_, hour) => { const bills = filteredSales.filter(sale => new Date(sale.date).getHours() === hour); return { day: `${String(hour).padStart(2, '0')}:00`, total: bills.reduce((sum, sale) => sum + sale.total, 0), bills: bills.length } }) : dailySales
  const changePercent = priorSum ? ((saleSum - priorSum) / priorSum) * 100 : null
  const menuRows = Array.from(sales.filter(sale => { const day = dateKey(new Date(sale.date)); return validReportRange && day >= reportFrom && day <= reportTo }).flatMap(sale => sale.items).reduce((rows, item) => { const row = rows.get(item.id) || { id: item.id, name: item.name, quantity: 0, gross: 0 }; row.quantity += item.quantity; row.gross += item.price * item.quantity; rows.set(item.id, row); return rows }, new Map<number, { id: number; name: string; quantity: number; gross: number }>()).values()).sort((a, b) => b.quantity - a.quantity || b.gross - a.gross)
  const today = dateKey(new Date())
  const monthDate = new Date(`${calendarMonth}T12:00:00`)
  const monthLength = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  function selectReportDay(day: string) {
    if (!dateAnchor) { setDateAnchor(day); setDraftFrom(day); setDraftTo(day) }
    else { setDraftFrom(day < dateAnchor ? day : dateAnchor); setDraftTo(day > dateAnchor ? day : dateAnchor); setDateAnchor(null) }
  }
  function setReportPreset(days: number) { setDraftTo(today); setDraftFrom(shiftDate(today, 1 - days)); setDateAnchor(null) }
  function exportReport() {
    const escape = (value: string | number) => { const text = String(value); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"` }
    const rows = [['Date', 'Sale', 'Items', 'Subtotal (THB)', 'Discount (THB)', 'Total (THB)', 'Payment'], ...sortedSales.map(sale => [sale.date, sale.id, sale.items.map(item => `${item.quantity} × ${item.name}${item.addons?.length ? ` (${item.addons.map(addon => addon.name).join(', ')})` : ''}`).join('; '), ((sale.total + (sale.discount || 0)) / 100).toFixed(2), ((sale.discount || 0) / 100).toFixed(2), (sale.total / 100).toFixed(2), paymentLabel(sale.payment)])]
    const blob = new Blob(['\uFEFF', rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `opos-sales-${reportFrom}-to-${reportTo}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  function openProduct(product?: Product) {
    setEditingId(product?.id ?? null)
    const initialImage = product ? (product.image ?? productImages[product.name.trim().toLowerCase()] ?? '') : ''
    setForm(product ? { name: product.name, category: product.category || '', price: (product.price / 100).toFixed(2), addons: product.addons.map(addon => ({ name: addon.name, price: (addon.price / 100).toFixed(2) })), image: initialImage, imageName: '' } : emptyForm())
    setProductDialog(true)
  }
  function selectImage(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 512
        const scale = Math.min(1, size / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setForm(current => ({ ...current, image: canvas.toDataURL('image/webp', 0.85), imageName: file.name }))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }
  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim() || !/^\d+(\.\d{1,2})?$/.test(form.price)) return error('Enter a product name and valid price')
    if (form.addons.some(addon => !addon.name.trim() || !/^\d+(\.\d{1,2})?$/.test(addon.price))) return error('Enter a name and valid price for each add-on')
    setBusy(true)
    try {
      const categoryName = form.category.trim()
      const payload = { name: form.name.trim(), category: menuCategories.find(category => category.toLowerCase() === categoryName.toLowerCase()) || categoryName, price: toCents(form.price), addons: form.addons.map(addon => ({ name: addon.name.trim(), price: toCents(addon.price) })), image: form.image }
      await api(editingId ? `products/${editingId}` : 'products', editingId ? 'PUT' : 'POST', payload)
      setProductDialog(false)
      await refresh()
      setNotice({ text: editingId ? 'Product updated' : 'Product added', error: false })
    } catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function deleteProduct() {
    if (deletingId === null) return
    try { await api(`products/${deletingId}`, 'DELETE'); setDeletingId(null); await refresh(); setNotice({ text: 'Product removed', error: false }) }
    catch (cause) { error(cause) }
  }
  function resetPromotionForm() {
    setEditingPromotionId(null)
    setPromotionName('')
    setPromotionEffectsForm(emptyPromotionEffects())
    setPromotionCategories(null)
  }
  function editPromotion(promotion: Promotion) {
    const effects = effectsOf(promotion).map(effectToForm)
    setEditingPromotionId(promotion.id)
    setPromotionName(promotion.name)
    setPromotionEffectsForm([effects[0] || emptyPromotionEffects()[0], effects[1] || emptyPromotionEffects()[1]])
    setPromotionCategories(promotion.categories ?? (promotion.productIds ? Array.from(new Set(products.filter(product => promotion.productIds!.includes(product.id)).map(product => product.category || ''))) : null))
    document.getElementById('promotion-name')?.focus()
  }
  async function savePromotion(event: FormEvent) {
    event.preventDefault()
    if (!promotionName.trim()) return error('Enter a promotion name')
    const effects: PromotionEffect[] = []
    for (const effect of promotionEffectsForm) {
      if (effect.type === 'none') continue
      if (effect.type === 'free_addon') {
        if (!availableAddonNames.includes(effect.addonName)) return error('Choose an available add-on')
        effects.push({ type: 'free_addon', addonName: effect.addonName })
      } else {
        if (!/^\d+(\.\d{1,2})?$/.test(effect.value) || Number(effect.value) <= 0 || (effect.type === 'percent' && (!Number.isInteger(Number(effect.value)) || Number(effect.value) > 100))) return error('Enter a valid promotion value')
        effects.push({ type: effect.type, value: effect.type === 'fixed' ? toCents(effect.value) : Number(effect.value) })
      }
    }
    if (promotionCategories !== null && !promotionCategories.length) return error('Select at least one category for this promotion')
    setBusy(true)
    try {
      await api(editingPromotionId === null ? 'promotions' : `promotions/${editingPromotionId}`, editingPromotionId === null ? 'POST' : 'PUT', { name: promotionName.trim(), effects, categories: promotionCategories })
      resetPromotionForm()
      await refresh()
      setNotice({ text: editingPromotionId === null ? 'Promotion added' : 'Promotion updated', error: false })
    } catch (cause) { error(cause) }
    finally { setBusy(false) }
  }
  async function deletePromotion() {
    if (deletingPromotionId === null) return
    try { await api(`promotions/${deletingPromotionId}`, 'DELETE'); if (editingPromotionId === deletingPromotionId) resetPromotionForm(); setDeletingPromotionId(null); await refresh(); setNotice({ text: 'Promotion removed', error: false }) }
    catch (cause) { error(cause) }
  }
  async function togglePromotion(promotion: Promotion) {
    try { await api(`promotions/${promotion.id}`, 'PATCH', { hidden: !promotion.hidden }); await refresh(); setNotice({ text: promotion.hidden ? 'Promotion shown' : 'Promotion hidden', error: false }) }
    catch (cause) { error(cause) }
  }
  async function completeSale() {
    if (selectedPromotionId !== null && !selectedPromotion) return error('Promotion unavailable. Refresh and try again.')
    const cash = toCents(received)
    if (payment === 'cash' && (!Number.isSafeInteger(cash) || cash < cartTotal)) return error('Insufficient cash received')
    if (payment === 'promptpay' && !promptpayQr) return error('Wait for the PromptPay QR code')
    setBusy(true)
    try {
      const result = await api<{ id: number; total: number }>('sales', 'POST', { requestId: saleRequestId.current, payment, received: payment === 'cash' ? cash : null, promotionId: selectedPromotionId, items: cart, ...(activeTableId !== null ? { tableId: activeTableId, tableVersion: activeTableVersion } : {}) })
      saleRequestId.current = requestId()
      setCart([])
      setSelectedPromotionId(null)
      setCheckout(false)
      setReceived('')
      if (activeTableId !== null) { setActiveTableId(null); setActiveTableVersion(null); setTab('tables') }
      await refresh()
      setNotice({ text: `Sale #${result.id} recorded: ${money(result.total)}`, error: false })
    } catch (cause) { error(cause); await refresh().catch(() => {}) }
    finally { setBusy(false) }
  }

  const notification = notice && createPortal(
    <div role={notice.error ? 'alert' : 'status'} className="fixed top-[max(16px,env(safe-area-inset-top))] right-4 left-4 z-[100] flex items-start gap-3 rounded-2xl border border-border bg-background p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 sm:left-auto sm:w-[360px]">
      {notice.error ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" /> : <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />}
      <p className="min-w-0 flex-1 self-center text-sm leading-5 break-words text-foreground">{notice.text}</p>
      <Button variant="ghost" size="icon-sm" className="size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground" aria-label="Dismiss message" onClick={() => setNotice(null)}><X className="size-4" /></Button>
    </div>, document.body,
  )

  if (authenticated === null) return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading OPOS…</div>
  if (!authenticated) return (
    <div className="grid min-h-svh place-items-center p-5">
      <Card className="w-full max-w-sm border-0 bg-background shadow-none">
        <CardHeader className="items-center text-center">
          <p className="mb-4 text-2xl font-extrabold tracking-[-.04em] text-primary">OPOS</p>
          <CardTitle className="text-2xl tracking-tight">{authMode === 'signin' ? 'Welcome back' : 'Create an account'}</CardTitle>
          <CardDescription>{authMode === 'signin' ? 'Sign in to open your register.' : 'Start your own register.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={authMode === 'signin' ? login : signup} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" autoComplete="username" value={loginUsername} onChange={event => setLoginUsername(event.target.value)} minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]+" required /></div>
            <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={authMode === 'signup' ? 12 : undefined} required /></div>
            {authMode === 'signup' && <div className="space-y-2"><Label htmlFor="signup-confirm">Confirm password</Label><Input id="signup-confirm" type="password" autoComplete="new-password" value={signupConfirm} onChange={event => setSignupConfirm(event.target.value)} minLength={12} required /></div>}
            {notification}
            <Button className="w-full" disabled={busy}>{authMode === 'signin' ? 'Sign in' : 'Sign up'}</Button>
            <p className="text-center text-sm text-muted-foreground">{authMode === 'signin' ? "Don't have an account?" : 'Have an account?'} <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setPassword(''); setSignupConfirm(''); setNotice(null) }}>{authMode === 'signin' ? 'Sign up' : 'Sign in'}</button></p>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <SidebarProvider defaultOpen={false} className="min-h-dvh" style={{ '--sidebar-width': '156pt', '--sidebar-width-icon': '48pt' } as React.CSSProperties}>
      <header className="pointer-events-auto fixed inset-x-0 top-0 z-60 flex h-16 items-center bg-primary pl-2 pr-inset text-primary-foreground md:hidden">
        <SidebarTrigger className="size-10 shrink-0 rounded-lg text-white hover:bg-white/15 hover:text-white [&_svg]:!size-6" />
        <span className="ml-2 text-xl font-extrabold tracking-[-.04em] text-white">OPOS</span>
        <span className="ml-auto flex items-center gap-2 text-xs font-medium text-white/80" role="status" aria-label="Register ready">{showStatusText && <span aria-hidden="true">Register ready</span>}<span aria-hidden="true" className="size-2 rounded-full bg-emerald-400" /></span>
      </header>
      <Sidebar collapsible="icon" className="!top-16 !bottom-0 !h-auto border-sidebar-border bg-sidebar text-sidebar-foreground md:!top-0">
        <SidebarContent className="pt-4">
          <div className="hidden items-center gap-2 px-3 transition-[gap] duration-200 ease-in-out group-data-[collapsible=icon]:gap-0 md:flex"><SidebarTrigger className="size-10 shrink-0 rounded-lg p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:!size-6" /><span className="max-w-[96pt] overflow-hidden text-xl font-extrabold tracking-[-.04em] whitespace-nowrap text-sidebar-foreground transition-[max-width,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">OPOS</span></div>
          <SidebarMenu className="gap-2 px-3">
            {([{ key: 'pos', label: 'POS', icon: ShoppingCart }, ...(restaurantEnabled ? [{ key: 'tables' as const, label: 'Tables', icon: DiningTableIcon }] : []), { key: 'reports', label: 'Reports', icon: ChartNoAxesColumn }, { key: 'inventory', label: 'Menu', icon: Utensils }, { key: 'dashboard', label: 'Promotions', icon: TicketPercent }] as const).map(({ key, label, icon: Icon }) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton className="h-10 px-3 !transition-none group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!p-3" isActive={tab === key} onClick={() => selectTab(key)} aria-label={label}>
                  <Icon /><span className="transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-0">{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="px-3 py-4">
          <SidebarMenu><SidebarMenuItem><SidebarMenuButton className="h-10 px-3 !transition-none group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!p-3" isActive={tab === 'settings'} onClick={() => selectTab('settings')} aria-label="Settings"><Settings /><span className="transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-0">Settings</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-dvh min-w-0 bg-[#f6f8fc] pt-16 md:pt-0">
        <div className="mx-auto w-full max-w-[1080pt] p-inset">
          {notification}
          <div className={tab === 'pos' ? 'grid items-start gap-inset lg:grid-cols-[minmax(0,1fr)_255pt] xl:grid-cols-[minmax(0,1fr)_270pt]' : 'block'}>
            <section className="min-w-0">
              {tab === 'tables' && restaurantEnabled && <TablesPage tables={tables} request={api} refresh={refresh} openOrder={openTableOrder} itemName={id => products.find(product => product.id === id)?.name || `Product #${id}`} lineTotal={lineTotal} onError={error} />}
              {tab === 'dashboard' && <>
                <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] items-center"><PageHeading title="Promotions" /></div>
                <Card className="mb-inset gap-inset border-0 bg-background p-inset shadow-sm">
                  <CardContent className="px-0">
                    <form onSubmit={savePromotion} className="grid gap-4 lg:grid-cols-3 lg:items-start">
                      <div className="space-y-2"><Label htmlFor="promotion-name">Name</Label><Input id="promotion-name" placeholder="Weekend special" value={promotionName} onChange={event => setPromotionName(event.target.value)} required maxLength={80} /></div>
                      {promotionEffectsForm.map((effect, index) => <div key={index} className="grid min-w-0 grid-cols-2 items-end gap-2">
                        <div className="min-w-0 space-y-2"><Label>Type {index + 1}{index === 1 && ' (optional)'}</Label><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button type="button" variant="outline" className="w-full justify-between border-input"><span className="truncate">{promotionTypeLabels[effect.type]}</span><ChevronDown /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="start" sideOffset={5} className="z-50 min-w-36 rounded-md border-[0.75pt] border-border bg-background p-1 shadow-md">{(index === 0 ? ['fixed', 'percent', 'free_addon'] : ['none', 'fixed', 'percent', 'free_addon']).map(type => <DropdownMenu.Item key={type} disabled={type !== 'none' && promotionEffectsForm.some((other, i) => i !== index && other.type === type)} onSelect={() => setPromotionEffectsForm(current => current.map((entry, i) => i === index ? { type: type as EffectForm['type'], value: '', addonName: '' } : entry))} className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none focus:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">{promotionTypeLabels[type as EffectForm['type']]}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
                        {(effect.type === 'fixed' || effect.type === 'percent') && <div className="min-w-0 space-y-2"><Label htmlFor={`promotion-value-${index}`}>{effect.type === 'fixed' ? 'Amount (฿)' : 'Percent (%)'}</Label><Input id={`promotion-value-${index}`} type="number" min={effect.type === 'fixed' ? '0.01' : '1'} max={effect.type === 'percent' ? '100' : undefined} step={effect.type === 'fixed' ? '0.01' : '1'} value={effect.value} onChange={event => setPromotionEffectsForm(current => current.map((entry, i) => i === index ? { ...entry, value: event.target.value } : entry))} required /></div>}
                        {effect.type === 'free_addon' && <div className="min-w-0 space-y-2"><Label>Free add-on</Label><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button type="button" variant="outline" disabled={!availableAddonNames.length} className="w-full justify-between border-input"><span className="truncate">{effect.addonName || 'Choose add-on'}</span><ChevronDown /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="start" sideOffset={5} className="z-50 max-h-[200pt] min-w-36 overflow-y-auto rounded-md border-[0.75pt] border-border bg-background p-1 shadow-md">{availableAddonNames.map(name => <DropdownMenu.Item key={name} onSelect={() => setPromotionEffectsForm(current => current.map((entry, i) => i === index ? { ...entry, addonName: name } : entry))} className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none focus:bg-accent">{name}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>}
                      </div>)}
                      <div className="flex min-w-0 items-end gap-3 lg:col-span-3">
                        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="promotion-categories">Applies to</Label><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button id="promotion-categories" type="button" variant="outline" className="w-full justify-between border-input"><span className="truncate">{promotionCategories === null ? 'All categories' : promotionCategories.length ? promotionCategories.map(category => category || 'Uncategorized').join(', ') : 'Choose categories'}</span><ChevronDown className="shrink-0" /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="start" sideOffset={5} className="z-50 max-h-[200pt] min-w-48 max-w-[calc(100vw-32px)] overflow-y-auto rounded-md border-[0.75pt] border-border bg-background p-1 shadow-md"><DropdownMenu.CheckboxItem checked={promotionCategories === null} onCheckedChange={() => setPromotionCategories(null)} onSelect={event => event.preventDefault()} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none focus:bg-accent"><span className="w-4 text-primary"><DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator></span>All categories</DropdownMenu.CheckboxItem><DropdownMenu.Separator className="my-1 h-px bg-border" />{visibleCategories.map(category => <DropdownMenu.CheckboxItem key={category} checked={promotionCategories?.includes(category) ?? false} onCheckedChange={checked => setPromotionCategories(current => checked ? [...(current || []), category] : (current || []).filter(value => value !== category))} onSelect={event => event.preventDefault()} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none focus:bg-accent"><span className="w-4 text-primary"><DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator></span>{category || 'Uncategorized'}</DropdownMenu.CheckboxItem>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
                        <div className="flex shrink-0 gap-2">{editingPromotionId !== null && <Button type="button" variant="outline" className="border-input" onClick={resetPromotionForm}>Cancel</Button>}<Button type="submit" disabled={busy}>{editingPromotionId === null ? <><Plus /> Add</> : <><SquarePen /> Save changes</>}</Button></div>
                      </div>
                      {promotions.some(promotion => promotion.id === editingPromotionId && promotion.productIds && promotion.categories == null) && <p className="text-xs text-muted-foreground lg:col-span-3">Saving switches this promotion from selected items to the selected categories.</p>}
                </form></CardContent></Card>
                <Card className="gap-0 overflow-hidden border-0 bg-background py-0 shadow-sm [&_tr]:border-border"><CardContent className="px-0">{promotions.length ? <Table><TableHeader><TableRow><TableHead className="first:pl-inset">Promotion</TableHead><TableHead>Discount</TableHead><TableHead>Applies to</TableHead><TableHead className="text-right last:pr-inset">Actions</TableHead></TableRow></TableHeader><TableBody>{promotions.map(promotion => <TableRow key={promotion.id}><TableCell className="font-medium first:pl-inset"><span translate="no">{promotion.name}</span>{promotion.hidden && <span className="ml-2 text-xs font-normal text-muted-foreground">Hidden</span>}</TableCell><TableCell>{effectsOf(promotion).map(effectLabel).join(' + ')}</TableCell><TableCell>{promotion.categories ? promotion.categories.map(category => category || 'Uncategorized').join(', ') : promotion.productIds ? 'Selected items (previous scope)' : 'All categories'}</TableCell><TableCell className="text-right last:pr-inset"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon-sm" className={`rounded-full ${promotion.hidden ? "text-muted-foreground hover:text-muted-foreground" : "text-primary hover:text-primary"}`} aria-label={`${promotion.hidden ? "Show" : "Hide"} ${promotion.name}`} onClick={() => togglePromotion(promotion)}>{promotion.hidden ? <EyeOff /> : <Eye />}</Button><Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Edit ${promotion.name}`} onClick={() => editPromotion(promotion)}><SquarePen /></Button><Button variant="ghost" size="icon-sm" className="rounded-full text-destructive hover:text-destructive" aria-label={`Remove ${promotion.name}`} onClick={() => setDeletingPromotionId(promotion.id)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table> : <p className="p-inset text-sm text-muted-foreground">No promotions yet.</p>}</CardContent></Card>
              </>}
              {tab === 'pos' && <>
                <div className="mb-inset grid min-h-[calc(var(--radius-card)*2)] grid-cols-2 items-center gap-inset sm:grid-cols-3 lg:grid-cols-4"><div className="col-span-2 flex min-w-0 items-center gap-inset lg:col-span-3"><PageHeading title="POS" />{menuCategories.length > 0 && <CategorySelector categories={visibleCategories} value={selectedCategory} onChange={setSelectedCategory} />}</div><Input aria-label="Search products" placeholder="Search your catalog..." value={search} onChange={event => setSearch(event.target.value)} className="col-span-2 h-[calc(var(--radius-card)*2)] w-full rounded-full border-0 bg-background px-4 sm:col-span-1" /></div>
                {activeTableId !== null && <Card className="mb-inset gap-0 border-0 bg-background p-inset shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-3 px-0"><div className="flex items-center gap-2 font-semibold"><DiningTableIcon className="size-5 text-primary" />{activeTable?.name || `Table ${activeTableId}`}{activeTable?.openedAt && <span className="text-xs font-normal text-muted-foreground">{activeTable.guests} guests</span>}</div><div className="flex flex-wrap gap-2">{activeTable && activeTable.version !== activeTableVersion && <Button variant="outline" size="sm" disabled={busy} onClick={() => { if (activeTable.openedAt) { setCart(structuredClone(activeTable.order)); setActiveTableVersion(activeTable.version) } else { setCart([]); setActiveTableId(null); setActiveTableVersion(null); setTab('tables') } }}>Reload saved order</Button>}<Button variant="outline" size="sm" disabled={busy} onClick={leaveTableOrder}>Tables</Button></div></CardContent></Card>}
                {matching.length ? <div className="grid grid-cols-2 content-start gap-inset sm:grid-cols-3 lg:grid-cols-4">
                  {matching.map(product => { const img = product.image || productImages[product.name.trim().toLowerCase()]; return <Card key={product.id} className="gap-0 border-0 bg-background py-0 shadow-sm transition-shadow duration-300 ease-in-out hover:shadow-md">
                    <Button variant="ghost" className="h-full w-full flex-col items-start justify-start gap-inset rounded-card p-inset text-left whitespace-normal text-foreground duration-300 ease-in-out hover:bg-[#f8faff] hover:text-foreground" onClick={() => { if (product.addons.length) { setSelectingProduct(product); setSelectedAddons([]) } else addToCart(product) }}>
                      {img ? <img src={img} alt={product.name} className="mb-auto aspect-square w-full rounded-lg object-cover" /> : <span className="mb-auto grid aspect-square w-full place-items-center rounded-lg bg-[#edf4fc] text-primary"><Package className="size-8" /></span>}
                      <div className="flex w-full flex-col gap-0.5">
                        <span className="line-clamp-1 text-lg leading-tight font-semibold tracking-tight text-foreground" translate="no">{product.name}</span>
                        <span className="text-sm leading-tight font-semibold text-primary">{money(product.price)}</span>
                      </div>
                    </Button>
                  </Card> })}
                </div> : search || selectedCategory !== null ? <Card className="min-h-52 items-center justify-center border-0 bg-background shadow-sm"><CardContent className="text-center"><h2 className="font-semibold">No matching products</h2><p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p></CardContent></Card> : <Card className="relative min-h-[300pt] justify-center overflow-hidden border-0 bg-primary text-white shadow-lg shadow-primary/10"><div aria-hidden="true" className="absolute -right-20 -top-28 size-80 rounded-full bg-white/15 blur-3xl" /><CardContent className="relative z-10 max-w-[315pt]"><span className="mb-7 grid size-12 place-items-center rounded-lg bg-white/10 text-[#a8c7ff]"><Package className="size-6" /></span><p className="mb-2 text-xs font-semibold tracking-[.18em] text-[#9bbcf7]">READY WHEN YOU ARE</p><h2 className="text-3xl font-semibold leading-tight tracking-tight">Start with your first product.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#c5d3e8]">Add products to your catalog, then tap any item here to ring it up.</p><Button variant="secondary" className="mt-7 bg-white text-primary hover:bg-[#eaf1ff]" onClick={() => { setTab('inventory'); openProduct() }}><Plus /> Add a product</Button></CardContent><div aria-hidden="true" className="absolute right-8 top-20 hidden h-56 w-44 rotate-[-10deg] rounded-lg border-[0.75pt] border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-sm sm:block"><div className="mb-5 grid size-12 place-items-center rounded-lg bg-white/15"><Package className="size-6 text-white" /></div><div className="h-2 w-28 rounded-[3pt] bg-white/40" /><div className="mt-3 h-2 w-20 rounded-[3pt] bg-white/20" /><div className="mt-10 h-[0.75pt] bg-white/20" /><div className="mt-5 h-3 w-16 rounded-[3pt] bg-white/60" /></div></Card>}
              </>}
              {tab === 'inventory' && <>
                <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] flex-wrap items-center justify-between gap-3"><PageHeading title="Menu" /><div className="flex flex-wrap items-center gap-2"><MenuImport names={products.map(product => product.name)} onError={error} onImport={async csv => { const result = await api<{ added: number; skipped: number }>('products/import', 'POST', { csv }); await refresh(); setNotice({ text: `${result.added} menu ${result.added === 1 ? 'item' : 'items'} added${result.skipped ? ` · ${result.skipped} skipped` : ''}`, error: false }) }} /><Button className="h-[calc(var(--radius-card)*2)] rounded-full has-[>svg]:px-inset" onClick={() => openProduct()}><Plus /> Add product</Button></div></div>
                {products.length ? <Card className="gap-0 overflow-hidden border-0 bg-background py-0 shadow-sm [&_tr]:border-border">
                  <CardContent className="px-0"><Table><TableHeader><TableRow>{([{ key: 'name', label: 'Product', width: 'w-[28%] first:pl-inset' }, { key: 'category', label: 'Category', width: 'w-[18%]' }] as const).map(column => <TableHead key={column.key} className={column.width} aria-sort={menuSort.key === column.key ? menuSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="inline-flex items-center gap-2 rounded-sm py-2 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Sort ${column.label.toLowerCase()} ${menuSort.key === column.key && menuSort.direction === 'asc' ? 'Z to A' : 'A to Z'}`} onClick={() => sortMenu(column.key)}>{column.label}{menuSort.key !== column.key ? <ArrowUpDown className="size-3.5" aria-hidden="true" /> : menuSort.direction === 'asc' ? <ArrowUp className="size-3.5 text-primary" aria-hidden="true" /> : <ArrowDown className="size-3.5 text-primary" aria-hidden="true" />}</button></TableHead>)}<TableHead className="w-[14%]">Price</TableHead><TableHead className="w-[22%]">Add-ons</TableHead><TableHead className="w-[18%] text-right last:pr-inset">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>{sortedMenu.map(product => <TableRow key={product.id} className={product.hidden ? 'text-muted-foreground' : undefined}><TableCell className="font-medium first:pl-inset"><span translate="no">{product.name}</span>{product.hidden && <span className="ml-2 text-xs font-normal text-muted-foreground">Hidden</span>}</TableCell><TableCell>{product.category || '—'}</TableCell><TableCell>{money(product.price)}</TableCell><TableCell>{product.addons.length ? product.addons.map(addon => `${addon.name} ${money(addon.price)}`).join(', ') : '—'}</TableCell><TableCell className="text-right last:pr-2"><div className="flex items-center justify-end gap-2"><Button variant="ghost" size="icon-sm" className={`rounded-full ${product.hidden ? 'text-muted-foreground hover:text-muted-foreground' : 'text-primary hover:text-primary'}`} aria-label={`${product.hidden ? 'Show' : 'Hide'} ${product.name}`} onClick={() => api(`products/${product.id}`, 'PATCH', { hidden: !product.hidden }).then(refresh).catch(error)}>{product.hidden ? <EyeOff /> : <Eye />}</Button><Button variant="ghost" size="icon-sm" className="translate-x-1 rounded-full" aria-label={`Edit ${product.name}`} onClick={() => openProduct(product)}><SquarePen /></Button><Button variant="ghost" size="icon-sm" className="rounded-full text-destructive hover:text-destructive" aria-label={`Delete ${product.name}`} onClick={() => setDeletingId(product.id)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody>
                  </Table></CardContent>
                </Card> : <Card className="min-h-64 items-center justify-center border-0 bg-background shadow-sm"><CardContent className="flex flex-col items-center text-center"><span className="mb-4 grid size-12 place-items-center rounded-lg bg-[#edf4fc] text-primary"><Utensils className="size-5" /></span><h2 className="font-semibold">No products in your catalog</h2><p className="mt-1 text-sm text-muted-foreground">Add a product to make it available at the register.</p></CardContent></Card>}
              </>}
              {tab === 'reports' && <>
                {reportView === null ? <>
                  <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] items-center"><PageHeading title="Reports" /></div>
                  <div className="grid gap-inset sm:grid-cols-2">{([{ view: 'sales', title: 'Sales report' }, { view: 'menu', title: 'Menu report' }] as const).map(({ view, title }) => <button key={view} type="button" onClick={() => setReportView(view)} className="flex items-center gap-2 rounded-card bg-background p-inset text-left shadow-sm transition-shadow hover:shadow-md">{view === 'menu' ? <ConciergeBell className="size-6 shrink-0 text-primary" /> : <ChartNoAxesColumn className="size-6 shrink-0 text-primary" />}<span className="flex h-9 min-w-0 flex-1 items-center gap-2 text-base font-semibold">{title}<ChevronRight className="size-4 shrink-0" /></span></button>)}</div>
                </> : <>
                <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] flex-wrap items-center justify-between gap-3"><h1 className="text-[21pt] font-bold leading-tight tracking-tight"><button type="button" className="text-muted-foreground transition-colors duration-300 ease-in-out hover:text-primary" onClick={() => setReportView(null)}>Reports</button><span className="mx-2">/</span>{reportView === 'sales' ? 'Sales report' : 'Menu report'}</h1>
                  <Popover.Root open={datePickerOpen} onOpenChange={open => { setDatePickerOpen(open); if (open) { setDraftFrom(reportFrom); setDraftTo(reportTo); setDateAnchor(null); setCalendarMonth(`${reportTo.slice(0, 7)}-01`) } }}>
                    <Popover.Trigger asChild><Button variant="outline" className="h-11 w-full justify-start gap-3 rounded-full border-0 bg-background text-foreground shadow-sm sm:w-auto"><CalendarDays className="text-primary" />{new Date(`${reportFrom}T12:00:00`).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{reportFrom !== reportTo && ` – ${new Date(`${reportTo}T12:00:00`).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}</Button></Popover.Trigger>
                    <Popover.Portal><Popover.Content align="end" sideOffset={8} className="z-50 w-[min(330pt,calc(100vw-24pt))] rounded-card border-[0.75pt] border-border bg-background p-inset shadow-xl outline-none">
                      <div className="mb-4 grid grid-cols-4 gap-2">{[['Today', 1], ['Yesterday', -1], ['7 days', 7], ['14 days', 14]].map(([label, days]) => <Button key={label} variant="outline" size="sm" className="min-w-0 px-1 text-xs" onClick={() => { if (days === -1) { const yesterday = shiftDate(today, -1); setDraftFrom(yesterday); setDraftTo(yesterday); setDateAnchor(null) } else setReportPreset(Number(days)) }}>{label}</Button>)}</div>
                      <div className="mb-3 flex items-center justify-between"><Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setCalendarMonth(dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)))}><ChevronLeft /></Button><strong className="text-sm">{monthDate.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { month: 'long', year: 'numeric' })}</strong><Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setCalendarMonth(dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)))}><ChevronRight /></Button></div>
                      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="py-1">{day}</span>)}</div>
                      <div className="grid grid-cols-7 gap-y-1">{Array.from({ length: monthDate.getDay() + monthLength }, (_, index) => { const number = index - monthDate.getDay() + 1; if (number < 1) return <span key={index} />; const day = `${calendarMonth.slice(0, 7)}-${String(number).padStart(2, '0')}`; const start = day === draftFrom; const end = day === draftTo; const middle = day > draftFrom && day < draftTo; return <button key={day} type="button" disabled={day > today} aria-label={new Date(`${day}T12:00:00`).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={day >= draftFrom && day <= draftTo} onClick={() => selectReportDay(day)} className={`relative flex h-8 items-center justify-center text-sm transition-colors disabled:text-muted-foreground/40 ${middle ? 'bg-primary/10 text-primary' : 'hover:bg-muted'} ${start && !end ? 'before:absolute before:inset-y-0 before:right-0 before:w-1/2 before:bg-primary/10' : ''} ${end && !start ? 'before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:bg-primary/10' : ''}`}><span className={`relative z-10 flex size-8 items-center justify-center rounded-full ${start || end ? 'bg-primary text-white' : ''}`}>{number}</span></button> })}</div>
                      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setDatePickerOpen(false)}>Cancel</Button><Button size="sm" disabled={dayCount(draftFrom, draftTo) > 366} onClick={() => { setReportRange({ from: draftFrom, to: draftTo }); setDatePickerOpen(false) }}>Select</Button></div>
                    </Popover.Content></Popover.Portal>
                  </Popover.Root>
                </div>
                {!validReportRange ? <Alert variant="destructive" className="mb-inset"><AlertDescription>Choose a date range of up to 366 days.</AlertDescription></Alert> : reportView === 'menu' ? <Card className="gap-0 overflow-hidden border-0 bg-background py-0 shadow-sm [&_tr]:border-border"><CardContent className="px-0">{menuRows.length ? <Table><TableHeader><TableRow><TableHead className="first:pl-inset">Menu item</TableHead><TableHead className="text-right">Quantity sold</TableHead><TableHead className="text-right last:pr-inset">Gross sales</TableHead></TableRow></TableHeader><TableBody>{menuRows.map((item, index) => <TableRow key={item.id}><TableCell className="font-medium first:pl-inset" translate="no">{index + 1}. {item.name}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right last:pr-inset">{money(item.gross)}</TableCell></TableRow>)}</TableBody></Table> : <div className="p-inset text-center text-sm text-muted-foreground">No items sold in this date range.</div>}</CardContent></Card> : <>
                <Card className="mb-inset gap-inset border-0 bg-background p-inset shadow-sm">
                  <CardContent className="space-y-inset px-0">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-muted-foreground">Total sales</p><strong className="mt-2 block text-4xl font-bold tracking-tight sm:text-5xl">{money(saleSum)}</strong><p className="mt-2 text-sm text-muted-foreground">{changePercent === null ? 'No sales in the previous period' : <><span className={changePercent >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-destructive'}>{changePercent >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(1)}%</span> compared with {priorFrom} – {priorTo}</>}</p></div><Button variant="secondary" size="icon" className="rounded-full" aria-label="Download sales report CSV" onClick={exportReport} disabled={!filteredSales.length}><Download /></Button></div>
                    <div className="grid gap-inset border-t-[0.75pt] border-border pt-inset xl:grid-cols-2">
                      <SalesChart data={chartSales} title={reportDays === 1 ? 'Hourly sales' : 'Daily sales'} />
                      <div className="grid grid-cols-2 grid-rows-2 gap-3">{[[String(filteredSales.length), 'Total bills'], [money(filteredSales.length ? Math.round(saleSum / filteredSales.length) : 0), 'Avg. basket size'], [money(discountSum), 'Discounts given'], [String(itemCount), 'Items sold']].map(([value, label]) => <div key={label} className="rounded-lg border-[0.75pt] border-border p-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">{value}</p></div>)}</div>
                    </div>
                  </CardContent>
                </Card>
                <div className="mb-inset flex h-[calc(var(--radius-card)*2)] w-full items-center gap-3"><Input aria-label="Search sales" placeholder="Search items or sale number..." value={reportSearch} onChange={event => setReportSearch(event.target.value)} className="h-full min-w-0 flex-1 rounded-full border-0 bg-background px-4 shadow-sm" /><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button aria-label={`Filter payment: ${paymentFilter === 'all' ? 'All payments' : paymentLabel(paymentFilter)}`} className="h-full rounded-full px-4 shadow-sm">Filter<ChevronDown /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-36 rounded-md border-[0.75pt] border-border bg-background p-1 shadow-md duration-200 ease-linear data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2">{['all', ...paymentTypes].map(type => <DropdownMenu.Item key={type} onSelect={() => setPaymentFilter(type)} className="cursor-pointer rounded-md px-3 py-2 text-sm text-primary outline-none focus:bg-accent" aria-label={`Show ${type === 'all' ? 'all payments' : paymentLabel(type)}`}><span translate={type.startsWith('manual:') ? 'no' : undefined}>{type === 'all' ? 'All payments' : paymentLabel(type)}</span>{paymentFilter === type ? ' ✓' : ''}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
                {filteredSales.length ? <Card className="gap-0 overflow-hidden border-0 bg-background py-0 shadow-sm [&_tr]:border-border"><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="first:pl-inset">Date</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead className="text-right last:pr-inset" aria-sort={paymentSort === null ? 'none' : paymentSort === 'asc' ? 'ascending' : 'descending'}><button type="button" className="inline-flex items-center gap-2" onClick={() => setPaymentSort(current => current === 'asc' ? 'desc' : 'asc')}>Payment<ArrowUpDown className="size-3.5" /></button></TableHead></TableRow></TableHeader><TableBody>{sortedSales.map(sale => <Fragment key={sale.id}>
                  <TableRow className={sale.items.length > 1 && renderedSaleId === sale.id ? 'border-b-0' : undefined}>
                    <TableCell className="first:pl-inset">{new Date(sale.date).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB')}</TableCell>
                    <TableCell translate="no">
                      {sale.items.length > 1 ? <button type="button" className="inline-flex items-center gap-2 text-left hover:text-primary" aria-label={`${expandedSaleId === sale.id ? 'Hide' : 'Show'} items for sale ${sale.id}`} aria-expanded={expandedSaleId === sale.id} onClick={() => toggleSaleDetails(sale.id)}>{sale.items.map(item => `${item.quantity} × ${item.name}${item.addons?.length ? ` (${item.addons.map(addon => addon.name).join(', ')})` : ''}`).join(', ')}<ChevronDown className={`size-4 shrink-0 transition-transform duration-250 ease-in-out ${expandedSaleId === sale.id ? 'rotate-180' : ''}`} /></button> : sale.items.map(item => `${item.quantity} × ${item.name}${item.addons?.length ? ` (${item.addons.map(addon => addon.name).join(', ')})` : ''}`).join(', ')}
                    </TableCell>
                    <TableCell>{money(sale.total)}</TableCell>
                    <TableCell className="text-right last:pr-inset"><Badge variant="secondary" className="translate-x-1"><span translate={sale.payment.startsWith('manual:') ? 'no' : undefined}>{paymentLabel(sale.payment)}</span></Badge></TableCell>
                  </TableRow>
                  {sale.items.length > 1 && renderedSaleId === sale.id && <>
                    {sale.items.map((item, index) => {
                      const rowPadding = `px-4 ${index === 0 ? 'pt-3' : 'pt-1'} ${index === sale.items.length - 1 && !sale.discount ? 'pb-3' : 'pb-1'}`
                      return <TableRow key={`${item.id}-${index}`} aria-hidden={expandedSaleId !== sale.id} className={`bg-muted/30 hover:bg-muted/30 ${index < sale.items.length - 1 || !!sale.discount ? 'border-b-0' : ''}`}><TableCell className="h-0 p-0" /><TableCell className="h-0 p-0" translate="no"><AnimatedSize open={expandedSaleId === sale.id}><div className={rowPadding}>{item.quantity} × {item.name}{item.addons?.length ? ` (${item.addons.map(addon => addon.name).join(', ')})` : ''}</div></AnimatedSize></TableCell><TableCell className="h-0 p-0"><AnimatedSize open={expandedSaleId === sale.id}><div className={rowPadding}>{money(item.price * item.quantity)}</div></AnimatedSize></TableCell><TableCell className="h-0 p-0" /></TableRow>
                    })}
                    {!!sale.discount && <TableRow aria-hidden={expandedSaleId !== sale.id} className="bg-muted/30 hover:bg-muted/30"><TableCell className="h-0 p-0" /><TableCell className="h-0 p-0"><AnimatedSize open={expandedSaleId === sale.id}><div className="px-4 pt-1 pb-3">Discount</div></AnimatedSize></TableCell><TableCell className="h-0 p-0"><AnimatedSize open={expandedSaleId === sale.id}><div className="px-4 pt-1 pb-3">−{money(sale.discount)}</div></AnimatedSize></TableCell><TableCell className="h-0 p-0" /></TableRow>}
                  </>}
                </Fragment>)}</TableBody></Table></CardContent></Card> : <Card className="min-h-56 items-center justify-center border-0 bg-background shadow-sm"><CardContent className="text-center"><span className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-[#edf4fc] text-primary"><ChartNoAxesColumn className="size-5" /></span><h2 className="font-semibold">{sales.length ? 'No matching sales' : 'No sales yet'}</h2></CardContent></Card>}
                </>}
                </>}
              </>}
              {tab === 'settings' && <>
                <div className="mb-inset flex min-h-[calc(var(--radius-card)*2)] items-center"><PageHeading title="Settings" /></div>
                <div className="space-y-inset">
                  <Card className="gap-inset border-0 bg-background p-inset shadow-sm">
                    <CardHeader className="px-0"><CardTitle>Username</CardTitle></CardHeader>
                    <CardContent className="px-0"><form onSubmit={saveUsername} className="max-w-[420pt] space-y-2"><Label htmlFor="settings-username">Username</Label><div className="flex items-center gap-2"><Input id="settings-username" autoComplete="username" value={settingsLoaded ? settingsUsername : ''} placeholder="Loading…" readOnly={!editingUsername} className={`min-w-0 flex-1 ${!editingUsername ? 'text-muted-foreground' : ''}`} onChange={event => setSettingsUsername(event.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]+" /><div className="flex shrink-0 items-center"><div aria-hidden={!editingUsername} className={`overflow-hidden transition-[width,opacity] duration-300 ease-in-out motion-reduce:transition-none ${editingUsername ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}><div className="pr-2"><Button type="button" variant="outline" className="w-full border-destructive px-2 text-destructive hover:bg-destructive hover:text-white" disabled={busy || !editingUsername} tabIndex={editingUsername ? 0 : -1} onClick={() => { setSettingsUsername(usernameBeforeEdit.current); setEditingUsername(false) }}>Cancel</Button></div></div><Button type="submit" className="w-16 px-2" disabled={busy || !settingsLoaded}>{editingUsername ? 'Save' : 'Edit'}</Button></div></div></form></CardContent>
                  </Card>
                  <Card className="gap-inset border-0 bg-background p-inset shadow-sm">
                    <CardHeader className="px-0"><CardTitle>Password</CardTitle></CardHeader>
                    <CardContent className="px-0"><form onSubmit={changePassword} className="max-w-[420pt] space-y-4">
                      <div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></div>
                      <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={12} required /></div>
                      <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></div>
                      <Button type="submit" disabled={busy}>Change password</Button>
                    </form></CardContent>
                  </Card>
                  <Card className="gap-inset border-0 bg-background p-inset shadow-sm">
                    <CardHeader className="px-0"><CardTitle>PromptPay</CardTitle></CardHeader>
                    <CardContent className="space-y-3 px-0">
                      <Label htmlFor="promptpay-enabled" className="inline-flex items-center gap-2"><input id="promptpay-enabled" type="checkbox" className="size-4 accent-primary" checked={promptpayEnabled} disabled={busy || !settingsLoaded} onChange={event => togglePromptpay(event.target.checked)} />Use PromptPay</Label>
                      {promptpayEnabled && <form onSubmit={savePromptpay} className="max-w-[420pt] space-y-2"><Label htmlFor="promptpay-id">Phone or national ID</Label><div className="flex items-center gap-2"><Input id="promptpay-id" inputMode="numeric" value={settingsLoaded ? promptpayId : ''} readOnly={!editingPromptpay} className={`min-w-0 flex-1 ${!editingPromptpay ? 'text-muted-foreground' : ''}`} onChange={event => setPromptpayId(event.target.value)} pattern="(0[0-9]{9}|[0-9]{13})?" placeholder={!settingsLoaded ? 'Loading…' : editingPromptpay ? '10-digit phone or 13-digit ID' : 'Not set'} /><div className="flex shrink-0 items-center"><div aria-hidden={!editingPromptpay} className={`overflow-hidden transition-[width,opacity] duration-300 ease-in-out motion-reduce:transition-none ${editingPromptpay ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}><div className="pr-2"><Button type="button" variant="outline" className="w-full border-destructive px-2 text-destructive hover:bg-destructive hover:text-white" disabled={busy || !editingPromptpay} tabIndex={editingPromptpay ? 0 : -1} onClick={() => { setPromptpayId(promptpayBeforeEdit.current); setEditingPromptpay(false) }}>Cancel</Button></div></div><Button type="submit" className="w-16 px-2" disabled={busy || !settingsLoaded}>{editingPromptpay ? 'Save' : 'Edit'}</Button></div></div></form>}
                    </CardContent>
                  </Card>
                  {!promptpayEnabled && settingsLoaded && <Card className="gap-inset border-0 bg-background p-inset shadow-sm">
                    <CardHeader className="px-0"><CardTitle>Other payment methods</CardTitle></CardHeader>
                    <CardContent className="px-0"><form onSubmit={saveManualPayments} className="max-w-[420pt] space-y-3">
                      <p className="text-sm text-muted-foreground">Cash is always available. Add choices such as Scan or EDC.</p>
                      {manualPaymentDraft.map((name, index) => <div key={index} className="flex items-center gap-2"><Input aria-label={`Payment method ${index + 1}`} value={name} maxLength={30} required onChange={event => setManualPaymentDraft(current => current.map((entry, i) => i === index ? event.target.value : entry))} /><Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive" aria-label={`Remove payment method ${index + 1}`} onClick={() => setManualPaymentDraft(current => current.filter((_, i) => i !== index))}><X /></Button></div>)}
                      <div className="flex gap-2"><Button type="button" variant="outline" disabled={manualPaymentDraft.length >= 8 || busy} onClick={() => setManualPaymentDraft(current => [...current, ''])}><Plus /> Add method</Button><Button type="submit" disabled={busy}>Save methods</Button></div>
                    </form></CardContent>
                  </Card>}
                  <Card className="gap-inset border-0 bg-background p-inset shadow-sm"><CardHeader className="px-0"><CardTitle>Restaurant</CardTitle></CardHeader><CardContent className="px-0"><Label htmlFor="dine-in-enabled" className="inline-flex items-center gap-3"><input id="dine-in-enabled" type="checkbox" className="size-4 accent-primary" checked={restaurantEnabled} disabled={busy} onChange={event => toggleRestaurant(event.target.checked)} />Restaurant with dine-in tables</Label></CardContent></Card>
                  <Card className="gap-inset border-0 bg-background p-inset shadow-sm">
                    <CardHeader className="px-0"><CardTitle>Language</CardTitle></CardHeader>
                    <CardContent className="px-0">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild><Button type="button" variant="outline" aria-label={language === 'th' ? 'ภาษา: ไทย' : 'Language: English'} className="w-36 justify-between border-input text-foreground">{language === 'th' ? 'ไทย' : 'English'}<ChevronDown /></Button></DropdownMenu.Trigger>
                        <DropdownMenu.Portal><DropdownMenu.Content align="start" sideOffset={5} className="z-70 min-w-36 rounded-md border-[0.75pt] border-border bg-background p-1 shadow-lg">
                          <DropdownMenu.Item onSelect={() => setLanguage('en')} className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none focus:bg-accent">English</DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => setLanguage('th')} className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none focus:bg-accent">ไทย</DropdownMenu.Item>
                        </DropdownMenu.Content></DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </CardContent>
                  </Card>
                  <Card className="gap-inset border-0 bg-background p-inset shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-3 px-0"><div><h2 className="font-semibold">Sign out</h2></div><Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={logout}><LogOut /> Sign out</Button></CardContent></Card>
                </div>
              </>}
            </section>
            {tab === 'pos' && <Card className="h-fit gap-0 overflow-hidden border-0 bg-background py-0 shadow-sm lg:sticky lg:top-inset">
              <CardHeader className="mx-inset flex flex-row items-center justify-between border-b-[0.75pt] border-border px-0 py-inset"><CardTitle className="relative inline-flex items-center"><ShoppingCart className="size-5 text-primary" />{cart.length > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[8pt] font-bold leading-none text-white">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}</CardTitle><Button variant="ghost" size="sm" onClick={() => { setCart([]); setSelectedPromotionId(null) }} disabled={!cart.length}>Clear</Button></CardHeader>
              <AnimatedSize><CardContent className={cart.length ? "max-h-[38vh] min-h-40 space-y-1 overflow-y-auto" : "flex min-h-40 flex-col items-center justify-center"}>{cart.length ? cart.map(item => { const product = products.find(p => p.id === item.id); if (!product) return null; const img = product.image || productImages[product.name.trim().toLowerCase()]; return <div key={cartKey(item)} className="flex items-center justify-between gap-3 border-b-[0.75pt] border-border py-3"><div className="flex min-w-0 items-center gap-3">{img ? <img src={img} alt={product.name} className="size-10 shrink-0 rounded-lg border-[0.75pt] border-border object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf4fc] text-primary"><Package className="size-5" /></span>}<div className="min-w-0"><p className="truncate text-sm font-semibold" translate="no">{product.name}</p><p className="text-xs text-muted-foreground">{item.addons.map(index => product.addons[index]?.name).filter(Boolean).join(', ') || 'No add-ons'}</p><p className="text-xs text-muted-foreground">{money(product.price + item.addons.reduce((total, index) => total + (product.addons[index]?.price || 0), 0))}</p></div></div><div className="flex items-center gap-1"><Button variant="outline" size="icon-xs" className="rounded-full" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(cartKey(item), -1)}><Minus /></Button><span className="w-6 text-center text-sm font-medium">{item.quantity}</span><Button variant="outline" size="icon-xs" className="rounded-full" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(cartKey(item), 1)}><Plus /></Button></div></div> }) : <div className="flex flex-col items-center justify-center text-center"><span className="mb-3 grid size-12 place-items-center rounded-lg bg-[#f1f4f8] text-[#7b8a9b]"><ShoppingCart className="size-5" /></span><p className="text-sm font-medium">No items added yet</p><p className="mt-1 text-xs text-muted-foreground">Select a product to start this sale.</p></div>}</CardContent></AnimatedSize>
              <AnimatedSize><CardFooter className="flex-col gap-3 py-inset"><div className="flex w-full items-center gap-3 border-t-[0.75pt] border-border pt-3"><Label className="shrink-0">Promotion</Label><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="outline" disabled={!cart.length || !visiblePromotions.length} className="h-10 min-w-0 flex-1 justify-between border-input text-foreground"><span className="truncate">{selectedPromotion ? `${selectedPromotion.name} · −${money(discountAmount)}` : 'No promotion'}</span><ChevronDown className="shrink-0" /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={5} className="z-70 w-[min(250pt,calc(100vw-48pt))] rounded-md border-[0.75pt] border-border bg-background p-1 shadow-lg"><DropdownMenu.Item onSelect={() => setSelectedPromotionId(null)} className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none focus:bg-accent">No promotion</DropdownMenu.Item>{visiblePromotions.map(promotion => { const available = availablePromotions.includes(promotion); const addon = effectsOf(promotion).find(effect => effect.type === 'free_addon'); return <DropdownMenu.Item key={promotion.id} disabled={!available} onSelect={() => setSelectedPromotionId(promotion.id)} className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none focus:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground"><span className="block">{promotion.name} · {effectsOf(promotion).map(effectLabel).join(' + ')}</span>{!available && <span className="block text-xs">{addon ? `Add ${addon.addonName} to an eligible product to use` : 'Add an eligible product to use'}</span>}</DropdownMenu.Item> })}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div><div className="flex w-full items-center justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div>{selectedPromotion && <div className="flex w-full items-center justify-between text-sm text-primary"><span>{selectedPromotion.name}</span><span>−{money(discountAmount)}</span></div>}<div className="flex w-full items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Total</span><strong className="text-2xl tracking-tight">{money(cartTotal)}</strong></div><div className="flex w-full gap-3">{activeTableId !== null && <Button className="min-w-0 flex-1" variant="outline" size="lg" disabled={busy || !tableOrderChanged} onClick={saveCurrentTable}>Update order</Button>}<Button className="min-w-0 flex-1 disabled:bg-[#e7ebf2] disabled:text-[#8c99ab] disabled:opacity-100" size="lg" disabled={!cart.length || busy} onClick={prepareCheckout}>Checkout</Button></div></CardFooter></AnimatedSize>
            </Card>}
          </div>
        </div>
      </SidebarInset>

      <Dialog open={!!selectingProduct} onOpenChange={open => { if (!open) setSelectingProduct(null) }}>
        <DialogContent><DialogHeader><DialogTitle>{selectingProduct?.name}</DialogTitle><DialogDescription>Choose any add-ons for this item.</DialogDescription></DialogHeader>
          <div className="space-y-2">{selectingProduct?.addons.map((addon, index) => <label key={index} className="flex cursor-pointer items-center justify-between rounded-lg border-[0.75pt] border-input p-3"><span className="flex items-center gap-3"><input type="checkbox" checked={selectedAddons.includes(index)} onChange={() => setSelectedAddons(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])} />{addon.name}</span><span>{money(addon.price)}</span></label>)}</div>
          <DialogFooter><Button onClick={() => { if (selectingProduct) addToCart(selectingProduct, selectedAddons); setSelectingProduct(null) }}>Add to basket · {money((selectingProduct?.price || 0) + selectedAddons.reduce((sum, index) => sum + (selectingProduct?.addons[index]?.price || 0), 0))}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-24pt)] grid-cols-[minmax(0,1fr)] gap-inset overflow-y-auto border-0 shadow-xl sm:max-w-[330pt]">
          <DialogHeader className="pr-8"><DialogTitle className="text-xl">{editingId ? 'Edit product' : 'Add product'}</DialogTitle></DialogHeader>
          <form onSubmit={saveProduct} className="min-w-0 space-y-5">
            <div className="space-y-2"><Label htmlFor="product-name" className="gap-1">Product name<span className="text-destructive">*</span></Label><Input className="h-10" id="product-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required maxLength={120} /></div>
            <div className="space-y-2"><Label htmlFor="product-category">Category <span className="text-muted-foreground">(optional)</span></Label><Input className="h-10" id="product-category" placeholder="e.g. Drinks" value={form.category} maxLength={60} onChange={event => setForm({ ...form, category: event.target.value })} />{suggestedCategories.length > 0 && <div className="space-y-2"><p className="text-xs text-muted-foreground">Existing categories</p><div className="flex flex-wrap gap-2">{suggestedCategories.map(category => <Button key={category} type="button" size="sm" variant="outline" className="max-w-full border-input" onClick={() => setForm(current => ({ ...current, category }))}><span className="truncate" translate="no">{category}</span></Button>)}</div></div>}</div>
            <div className="space-y-2"><Label htmlFor="product-price" className="gap-1">Price<span className="text-destructive">*</span></Label><Input className="h-10" id="product-price" type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} required /></div>
            <div className="space-y-3"><div className="flex items-center justify-between"><Label>Add-ons</Label><Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, addons: [...form.addons, { name: '', price: '' }] })} disabled={form.addons.length >= 20}><Plus /> Add add-on</Button></div>
              {form.addons.map((addon, index) => <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_72pt_24pt] items-center gap-2"><Input aria-label={`Add-on ${index + 1} name`} placeholder="Cream cheese" value={addon.name} maxLength={80} required onChange={event => setForm({ ...form, addons: form.addons.map((value, i) => i === index ? { ...value, name: event.target.value } : value) })} /><Input aria-label={`Add-on ${index + 1} price in baht`} type="number" min="0" step="0.01" placeholder="฿10" value={addon.price} required onChange={event => setForm({ ...form, addons: form.addons.map((value, i) => i === index ? { ...value, price: event.target.value } : value) })} /><Button type="button" variant="ghost" size="icon" className="size-6 text-destructive" aria-label={`Remove add-on ${index + 1}`} onClick={() => setForm({ ...form, addons: form.addons.filter((_, i) => i !== index) })}><X /></Button></div>)}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label htmlFor="product-image">Picture</Label>{form.image && <button type="button" className="text-xs leading-none font-medium text-primary hover:underline" onClick={() => setForm({ ...form, image: '', imageName: '' })}>Remove</button>}</div>
              <div className="flex items-center gap-2">
                {form.image ? <img src={form.image} alt="Preview" className="size-10 shrink-0 rounded-lg border-[0.75pt] border-border object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf4fc] text-primary"><Package className="size-5" /></span>}
                <label htmlFor="product-image" className="flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2.5 rounded-md border-[0.75pt] border-input bg-transparent p-[4pt] pl-3 text-sm shadow-xs has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[2.25pt] has-[:focus-visible]:ring-ring/50">
                  <input id="product-image" type="file" accept="image/*" className="sr-only" onChange={event => { selectImage(event.target.files?.[0]); event.target.value = '' }} />
                  <span className="truncate text-muted-foreground">{form.imageName || 'No file chosen'}</span>
                  <span className="flex h-full shrink-0 items-center justify-center rounded-[4pt] bg-secondary px-3 text-sm font-medium text-primary">Choose File</span>
                </label>
              </div>
            </div>
            <DialogFooter className="pt-1"><Button size="lg" type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add product'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId !== null} onOpenChange={open => { if (!open) setDeletingId(null) }}>
        <AlertDialogContent className="gap-inset border-0 shadow-xl sm:max-w-[330pt]">
          <AlertDialogHeader className="gap-2 text-left sm:place-items-start">
            <AlertDialogTitle className="text-xl">Remove product?</AlertDialogTitle>
            <AlertDialogDescription>The product will leave the catalog. Past sales remain available.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-1">
            <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
            <AlertDialogAction size="lg" onClick={deleteProduct}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingPromotionId !== null} onOpenChange={open => { if (!open) setDeletingPromotionId(null) }}>
        <AlertDialogContent className="gap-inset border-0 shadow-xl sm:max-w-[330pt]"><AlertDialogHeader className="gap-2 text-left sm:place-items-start"><AlertDialogTitle className="text-xl">Remove promotion?</AlertDialogTitle><AlertDialogDescription>It will no longer appear at checkout. Past sales remain available.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="pt-1"><AlertDialogCancel size="lg">Cancel</AlertDialogCancel><AlertDialogAction size="lg" onClick={deletePromotion}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={checkout} onOpenChange={setCheckout}>
        <DialogContent className="max-h-[calc(100dvh-32px)] gap-inset overflow-y-auto border-0 shadow-xl sm:max-w-[330pt]">
          <DialogHeader className="pr-8"><DialogTitle className="text-xl">Checkout</DialogTitle><DialogDescription>Total: {money(cartTotal)}</DialogDescription></DialogHeader>
          <RadioGroup value={payment} onValueChange={value => setPayment(value as Payment)} className="grid grid-cols-2 gap-2">
            {(promptpayEnabled ? ['cash', 'promptpay'] : ['cash', ...manualPayments.map(name => `manual:${name}`)]).map(method => <Label key={method} htmlFor={`payment-${method}`} className="flex items-center gap-2 rounded-xl border-[0.75pt] border-input p-3 transition-colors has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"><RadioGroupItem value={method} id={`payment-${method}`} disabled={method === 'promptpay' && (cartTotal === 0 || !promptpayConfigured)} /><span translate={method.startsWith('manual:') ? 'no' : undefined}>{paymentLabel(method)}</span></Label>)}
          </RadioGroup>
          <AnimatedSize>{payment === 'cash' ? <div className="space-y-3">
            <div className="flex items-center justify-between"><Label htmlFor="received">Amount received</Label><Button variant="ghost" size="sm" className="h-7 text-muted-foreground" disabled={!received || busy} onClick={() => setReceived('')}>Clear</Button></div>
            <Input className="h-20 rounded-xl border-0 bg-muted/50 px-4 text-right text-4xl font-semibold tracking-tight shadow-none focus-visible:ring-inset md:text-4xl" id="received" type="text" inputMode="none" readOnly value={received} placeholder="0.00" disabled={busy} onKeyDown={event => { if (!event.ctrlKey && !event.metaKey && (/^[0-9.]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete')) { event.preventDefault(); setReceived(value => cashKeyValue(value, event.key)) } }} />
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Cash amount number pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'Backspace'].map(key => <Button key={key} type="button" variant="outline" className="h-14 rounded-xl border-0 bg-muted/60 text-2xl font-medium text-foreground shadow-none transition-colors hover:bg-accent hover:text-primary active:bg-primary/15" disabled={busy} aria-label={key === 'Backspace' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key} onClick={() => setReceived(value => cashKeyValue(value, key))}>{key === 'Backspace' ? <Delete className="size-5" /> : key}</Button>)}</div>
            <div className="flex items-center justify-between px-1 py-2 text-sm"><span className="text-muted-foreground">Change</span><strong className={toCents(received) >= cartTotal ? 'text-primary' : 'text-muted-foreground'}>{toCents(received) >= cartTotal ? money(toCents(received) - cartTotal) : 'Insufficient'}</strong></div>
          </div> : payment === 'promptpay' ? <div className="flex flex-col items-center gap-3 text-center"><div className="relative size-60">{promptpayQr && <img src={promptpayQr} alt={`PromptPay QR code for ${money(cartTotal)}`} width={240} height={240} className={`size-60 ${qrImageLoaded ? '' : 'opacity-0'}`} onLoad={() => setQrImageLoaded(true)} onError={() => setQrError('Could not display QR code')} />}{qrError ? <p className="absolute inset-0 grid place-items-center text-sm text-destructive">{qrError}</p> : !qrImageLoaded && <><Skeleton className="absolute inset-0 size-60" /><span className="sr-only" role="status">Generating QR code</span></>}</div><p className="text-sm text-muted-foreground">Confirm payment in your bank app before recording the sale.</p></div> : <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Confirm payment before recording the sale.</p>}</AnimatedSize>
          <DialogFooter className="pt-1"><Button className="w-full rounded-xl" size="lg" disabled={busy || !cart.length || (selectedPromotionId !== null && !selectedPromotion) || (payment === 'promptpay' && (!promptpayQr || !qrImageLoaded || !!qrError))} onClick={completeSale}>Record sale</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

function PageHeading({ title }: { title: string }) {
  return <h1 className="text-[21pt] font-bold leading-tight tracking-tight">{title}</h1>
}

function SalesChart({ data, title }: { data: { day: string; total: number; bills: number }[]; title: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const maximum = Math.max(100, ...data.map(day => day.total))
  const points = data.map((day, index) => ({ x: data.length === 1 ? 350 : 48 + index * 604 / (data.length - 1), y: 190 - day.total * 145 / maximum, ...day }))
  const selected = hovered === null ? null : points[hovered]
  const tooltipX = selected ? Math.max(48, Math.min(442, selected.x - 105)) : 0
  const tooltipY = selected ? selected.y < 110 ? selected.y + 14 : selected.y - 96 : 0
  const compact = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value / 100)
  return <div className="min-w-0">
    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{title}</span><span>Sales (฿)</span></div>
    <svg viewBox="0 0 700 230" role="img" aria-label={`${title} from ${data[0]?.day} to ${data.at(-1)?.day}`} className="h-auto w-full max-w-[600pt]">
      {[0, 0.5, 1].map(tick => <g key={tick}><line x1="48" x2="652" y1={190 - tick * 145} y2={190 - tick * 145} stroke="#e8e8ec" strokeWidth="1" /><text x="665" y={194 - tick * 145} fill="#6e6e73" fontSize="12">{compact(maximum * tick)}</text></g>)}
      {points.length > 1 && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#0047ab" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((point, index) => <g key={point.day}>
        {(points.length <= 31 || index === 0 || index === points.length - 1 || hovered === index) && <circle cx={point.x} cy={point.y} r="4" fill="#0047ab" />}
        <circle cx={point.x} cy={point.y} r="11" fill="transparent" className="cursor-pointer" tabIndex={0} aria-label={`${point.day}: sales ${money(point.total)}, ${point.bills} bills, average basket ${money(point.bills ? Math.round(point.total / point.bills) : 0)}`} onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => setHovered(index)} />
      </g>)}
      <text x="48" y="220" fill="#6e6e73" fontSize="12">{data[0]?.day}</text>
      {data.length > 1 && <text x="652" y="220" textAnchor="end" fill="#6e6e73" fontSize="12">{data.at(-1)?.day}</text>}
      {selected && <g pointerEvents="none">
        <rect x={tooltipX} y={tooltipY} width="210" height="90" rx="8" fill="white" stroke="#d1d1d6" />
        <text x={tooltipX + 12} y={tooltipY + 19} fill="#6e6e73" fontSize="12">{selected.day}</text>
        <text x={tooltipX + 12} y={tooltipY + 38} fill="#1d1d1f" fontSize="12">Sales: {money(selected.total)}</text>
        <text x={tooltipX + 12} y={tooltipY + 57} fill="#1d1d1f" fontSize="12">Bills (QTY): {selected.bills}</text>
        <text x={tooltipX + 12} y={tooltipY + 76} fill="#1d1d1f" fontSize="12">Avg. basket size: {money(selected.bills ? Math.round(selected.total / selected.bills) : 0)}</text>
      </g>}
    </svg>
  </div>
}
