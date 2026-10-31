export type ImportedMenuItem = { name: string; price: number; category: string; addons: { name: string; price: number }[] }
export function parseMenuCsv(text: string): ImportedMenuItem[]
