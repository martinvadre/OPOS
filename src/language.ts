export type Language = 'en' | 'th'

export const thai: Record<string, string> = {
  'Settings': 'ตั้งค่า', 'Language': 'ภาษา', 'English': 'อังกฤษ', 'Thai': 'ไทย',
  'POS': 'ขายสินค้า', 'Tables': 'โต๊ะ', 'Reports': 'รายงาน', 'Menu': 'เมนู', 'Dashboard': 'ภาพรวม',
  'Welcome back': 'ยินดีต้อนรับกลับ', 'Create an account': 'สร้างบัญชี',
  'Sign in to open your register.': 'เข้าสู่ระบบเพื่อเริ่มขาย', 'Start your own register.': 'เริ่มใช้เครื่องคิดเงินของคุณ',
  'Username': 'ชื่อผู้ใช้', 'Password': 'รหัสผ่าน', 'Confirm password': 'ยืนยันรหัสผ่าน',
  'Username updated': 'อัปเดตชื่อผู้ใช้แล้ว', 'Password changed': 'เปลี่ยนรหัสผ่านแล้ว',
  'PromptPay ID updated': 'อัปเดต PromptPay ID แล้ว',
  'PromptPay enabled': 'เปิดใช้ PromptPay แล้ว', 'PromptPay disabled': 'ปิดใช้ PromptPay แล้ว',
  'Use PromptPay': 'ใช้ PromptPay', 'Other payment methods': 'วิธีชำระเงินอื่น',
  'Cash is always available. Add choices such as Scan or EDC.': 'ใช้เงินสดได้เสมอ เพิ่มตัวเลือก เช่น Scan หรือ EDC',
  'Add method': 'เพิ่มวิธีชำระเงิน', 'Save methods': 'บันทึกวิธีชำระเงิน',
  'Payment methods updated': 'อัปเดตวิธีชำระเงินแล้ว',
  'Use unique payment names of 1–30 characters, excluding Cash and PromptPay': 'ใช้ชื่อวิธีชำระเงินที่ไม่ซ้ำกัน ความยาว 1–30 ตัวอักษร และไม่ใช้ชื่อ Cash หรือ PromptPay',
  'Payment method unavailable. Refresh and try again.': 'วิธีชำระเงินนี้ใช้ไม่ได้แล้ว โปรดรีเฟรชแล้วลองอีกครั้ง',
  'Passwords do not match': 'รหัสผ่านไม่ตรงกัน', 'New passwords do not match': 'รหัสผ่านใหม่ไม่ตรงกัน',
  'Sign in': 'เข้าสู่ระบบ', 'Sign up': 'สมัครสมาชิก', "Don't have an account?": 'ยังไม่มีบัญชี?', 'Have an account?': 'มีบัญชีแล้ว?',
  'Loading OPOS…': 'กำลังโหลด OPOS…', 'Register ready': 'พร้อมขาย',
  'Promotions': 'โปรโมชัน', 'Promotion': 'โปรโมชัน', 'Name': 'ชื่อ', 'Type': 'ประเภท',
  'Amount (฿)': 'จำนวนเงิน (฿)', 'Percent (%)': 'เปอร์เซ็นต์ (%)', 'Free add-on': 'ของเพิ่มฟรี',
  'Choose add-on': 'เลือกของเพิ่ม', 'Applies to': 'ใช้กับ', 'All categories': 'ทุกหมวดหมู่',
  'Choose categories': 'เลือกหมวดหมู่', 'Uncategorized': 'ไม่มีหมวดหมู่', 'None': 'ไม่มี',
  'Baht off': 'ลดเป็นบาท', 'Percent off': 'ลดเป็นเปอร์เซ็นต์', 'Add': 'เพิ่ม',
  'Save changes': 'บันทึกการเปลี่ยนแปลง', 'Cancel': 'ยกเลิก', 'Discount': 'ส่วนลด',
  'Actions': 'การจัดการ', 'Hidden': 'ซ่อนอยู่', 'No promotions yet.': 'ยังไม่มีโปรโมชัน',
  'Remove promotion?': 'ลบโปรโมชันหรือไม่?',
  'No promotion': 'ไม่มีโปรโมชัน', 'Selected items (previous scope)': 'สินค้าที่เลือกไว้ก่อนหน้า',
  'Add an eligible product to use': 'เพิ่มสินค้าที่ร่วมรายการเพื่อใช้โปรโมชัน',
  'Show': 'แสดง', 'Hide': 'ซ่อน', 'A to Z': 'ก ถึง ฮ', 'Z to A': 'ฮ ถึง ก',
  'Saving switches this promotion from selected items to the selected categories.': 'เมื่อบันทึก โปรโมชันนี้จะใช้กับหมวดหมู่ที่เลือกแทนสินค้าที่เคยเลือก',
  'Search products': 'ค้นหาสินค้า', 'Search your catalog...': 'ค้นหาในเมนู...',
  'Reload saved order': 'โหลดรายการที่บันทึกใหม่', 'No matching products': 'ไม่พบสินค้าที่ตรงกัน',
  'Try another search or category.': 'ลองค้นหาหรือเลือกหมวดหมู่อื่น',
  'READY WHEN YOU ARE': 'พร้อมเริ่มขาย', 'Start with your first product.': 'เริ่มด้วยสินค้าชิ้นแรก',
  'Add products to your catalog, then tap any item here to ring it up.': 'เพิ่มสินค้าในเมนู แล้วแตะสินค้าเพื่อเริ่มขาย',
  'Add a product': 'เพิ่มสินค้า', 'Add product': 'เพิ่มสินค้า', 'Import CSV': 'นำเข้า CSV',
  'Stock': 'สต็อก', 'Stock item': 'รายการสต็อก', 'Add stock item': 'เพิ่มรายการสต็อก',
  'Stock recipe': 'สูตรวัตถุดิบ', 'Add ingredient': 'เพิ่มวัตถุดิบ', 'Remove ingredient': 'ลบวัตถุดิบ',
  'Recipe cost': 'ต้นทุนต่อรายการ', 'Quantity per item': 'ปริมาณต่อรายการ',
  'On hand': 'คงเหลือ', 'Latest purchase': 'ซื้อล่าสุด', 'Restock': 'เติมสต็อก',
  'Search stock': 'ค้นหาสต็อก', 'Search stock…': 'ค้นหาสต็อก…', 'No matching stock items': 'ไม่พบรายการสต็อกที่ตรงกัน',
  'Unit': 'หน่วย', 'Purchase quantity': 'ปริมาณที่ซื้อ', 'Purchase cost (฿)': 'ราคาซื้อ (฿)',
  'Add ingredients and packaging on the Stock page first.': 'เพิ่มวัตถุดิบและบรรจุภัณฑ์ในหน้าสต็อกก่อน',
  'Add ingredients and packaging to start tracking stock.': 'เพิ่มวัตถุดิบและบรรจุภัณฑ์เพื่อเริ่มติดตามสต็อก',
  'Enter a valid stock quantity and purchase cost': 'กรอกปริมาณและราคาซื้อให้ถูกต้อง',
  'Enter valid recipe quantities and stock items': 'เลือกรายการสต็อกและกรอกปริมาณในสูตรให้ถูกต้อง',
  'Stock item already exists': 'มีรายการสต็อกนี้แล้ว',
  'Product': 'สินค้า', 'Category': 'หมวดหมู่', 'Price': 'ราคา', 'Add-ons': 'ของเพิ่ม',
  'Priority': 'ลำดับความสำคัญ', 'High': 'สูง', 'Medium': 'ปานกลาง', 'Low': 'ต่ำ',
  'High items appear first at checkout.': 'สินค้าที่มีลำดับสูงจะแสดงก่อนในหน้าขาย',
  '(optional)': '(ไม่บังคับ)', 'e.g. Drinks': 'เช่น เครื่องดื่ม', 'Existing categories': 'หมวดหมู่ที่มีอยู่',
  'No products in your catalog': 'ยังไม่มีสินค้าในเมนู',
  'Add a product to make it available at the register.': 'เพิ่มสินค้าเพื่อให้พร้อมขาย',
  'Edit product': 'แก้ไขสินค้า', 'Product name': 'ชื่อสินค้า', 'Add add-on': 'เพิ่มของเพิ่ม',
  'Picture': 'รูปภาพ', 'Remove': 'ลบ', 'Choose File': 'เลือกไฟล์', 'No file chosen': 'ยังไม่ได้เลือกไฟล์',
  'Preview': 'ตัวอย่าง', 'Remove product?': 'ลบสินค้าหรือไม่?',
  'The product will leave the catalog. Past sales remain available.': 'สินค้าจะถูกลบจากเมนู แต่ประวัติการขายยังอยู่',
  'It will no longer appear at checkout. Past sales remain available.': 'สินค้าจะไม่ปรากฏตอนขาย แต่ประวัติการขายยังอยู่',
  'Clear': 'ล้าง', 'No add-ons': 'ไม่มีของเพิ่ม', 'No items added yet': 'ยังไม่มีสินค้าในตะกร้า',
  'Select a product to start this sale.': 'เลือกสินค้าเพื่อเริ่มขาย', 'Subtotal': 'ยอดก่อนส่วนลด',
  'Total': 'รวม', 'Update order': 'อัปเดตรายการ', 'Checkout': 'ชำระเงิน',
  'Choose any add-ons for this item.': 'เลือกของเพิ่มสำหรับสินค้านี้',
  'Payment': 'การชำระเงิน', 'Cash': 'เงินสด', 'Amount received': 'จำนวนเงินที่รับ',
  'Insufficient': 'เงินไม่พอ', 'Delete last digit': 'ลบหลักสุดท้าย', 'Decimal point': 'จุดทศนิยม',
  'Could not display QR code': 'ไม่สามารถแสดงคิวอาร์โค้ด',
  'Change': 'เงินทอน', 'Record sale': 'บันทึกการขาย',
  'Confirm payment in your bank app before recording the sale.': 'ตรวจสอบการชำระเงินในแอปธนาคารก่อนบันทึกการขาย',
  'Confirm payment before recording the sale.': 'ตรวจสอบการชำระเงินก่อนบันทึกการขาย',
  'Generating QR code': 'กำลังสร้างคิวอาร์โค้ด',
  'Gross sales': 'ยอดขายรวม', 'Total sales': 'ยอดขายทั้งหมด', 'Sales (฿)': 'ยอดขาย (฿)',
  'Hourly sales': 'ยอดขายรายชั่วโมง', 'Daily sales': 'ยอดขายรายวัน',
  'Total bills': 'จำนวนบิล', 'Avg. basket size': 'ยอดเฉลี่ยต่อบิล',
  'Dine-in guests': 'ลูกค้านั่งร้าน', 'Dine-in avg. per guest': 'ยอดเฉลี่ยต่อลูกค้านั่งร้าน',
  'Discounts given': 'ส่วนลดที่ให้', 'Items sold': 'จำนวนสินค้าที่ขาย',
  'No sales in the previous period': 'ไม่มีการขายในช่วงก่อนหน้า',
  'Sales report': 'รายงานการขาย', 'Menu report': 'รายงานเมนู', 'Today': 'วันนี้', 'Yesterday': 'เมื่อวาน',
  'No matching sales': 'ไม่พบรายการขายที่ตรงกัน', 'No sales yet': 'ยังไม่มีรายการขาย',
  'Search sales': 'ค้นหารายการขาย', 'Search items or sale number...': 'ค้นหาสินค้าหรือเลขที่รายการ...',
  'All payments': 'ทุกวิธีชำระเงิน', 'Download sales report CSV': 'ดาวน์โหลดรายงานการขาย CSV',
  'Previous month': 'เดือนก่อนหน้า', 'Next month': 'เดือนถัดไป',
  'Sun': 'อา.', 'Mon': 'จ.', 'Tue': 'อ.', 'Wed': 'พ.', 'Thu': 'พฤ.', 'Fri': 'ศ.', 'Sat': 'ส.',
  'Items': 'รายการ', 'Menu item': 'สินค้า', 'Quantity sold': 'จำนวนที่ขาย',
  'Date': 'วันที่', 'Filter': 'กรอง', 'Select': 'เลือก',
  'Choose a date range of up to 366 days.': 'เลือกช่วงวันที่ได้สูงสุด 366 วัน',
  'No items sold in this date range.': 'ไม่มีสินค้าที่ขายในช่วงวันที่นี้',
  'Current password': 'รหัสผ่านปัจจุบัน', 'New password': 'รหัสผ่านใหม่',
  'Confirm new password': 'ยืนยันรหัสผ่านใหม่', 'Change password': 'เปลี่ยนรหัสผ่าน',
  'Phone or national ID': 'เบอร์โทรหรือเลขบัตรประชาชน',
  '10-digit phone or 13-digit ID': 'เบอร์โทร 10 หลัก หรือเลขบัตร 13 หลัก',
  'Not set': 'ยังไม่ได้ตั้งค่า', 'Loading…': 'กำลังโหลด…', 'Edit': 'แก้ไข', 'Save': 'บันทึก',
  'Restaurant': 'ร้านอาหาร', 'Restaurant with dine-in tables': 'ร้านอาหารที่มีโต๊ะนั่ง',
  'Sign out': 'ออกจากระบบ',
  'Available': 'ว่าง', 'Occupied': 'ไม่ว่าง', 'Add table': 'เพิ่มโต๊ะ', 'No tables yet': 'ยังไม่มีโต๊ะ',
  'Table size': 'ขนาดโต๊ะ', 'Square': 'สี่เหลี่ยมจัตุรัส', 'Rectangle': 'สี่เหลี่ยมผืนผ้า', 'Joined squares': 'โต๊ะจัตุรัสต่อกัน',
  'Chair layout': 'การจัดเก้าอี้', 'Top': 'ด้านบน', 'Right': 'ด้านขวา', 'Bottom': 'ด้านล่าง', 'Left': 'ด้านซ้าย',
  'Rotate table': 'หมุนโต๊ะ',
  'Edit grid': 'แก้ไขขนาดผัง', 'Columns': 'คอลัมน์', 'Rows': 'แถว',
  'Move tables inside the new grid before resizing': 'ย้ายโต๊ะให้อยู่ในขนาดผังใหม่ก่อนปรับขนาด',
  'Table setup': 'ตั้งค่าโต๊ะ', 'Chairs': 'เก้าอี้', 'Row': 'แถว', 'Column': 'คอลัมน์',
  'Set the table names, chair counts, and positions on the floor.': 'ตั้งชื่อโต๊ะ จำนวนเก้าอี้ และตำแหน่งในผังร้าน',
  'Combine tables': 'รวมโต๊ะ', 'Combined': 'รวมโต๊ะแล้ว',
  'The selected tables will share one order and bill.': 'โต๊ะที่เลือกจะใช้รายการอาหารและบิลเดียวกัน',
  'Select a table': 'เลือกโต๊ะ', 'Guests': 'จำนวนลูกค้า', 'Seats': 'ที่นั่ง',
  'Avg. per guest': 'ยอดเฉลี่ยต่อคน', 'Move table': 'ย้ายโต๊ะ', 'Destination table': 'โต๊ะปลายทาง',
  'The guests and saved order will move to the selected table.': 'ลูกค้าและรายการที่บันทึกจะย้ายไปยังโต๊ะที่เลือก',
  'Add an available table with enough seats to move this order.': 'เพิ่มโต๊ะว่างที่มีที่นั่งเพียงพอเพื่อย้ายรายการนี้',
  'No items yet': 'ยังไม่มีสินค้า', 'View order': 'ดูรายการ', 'Add items': 'เพิ่มสินค้า',
  'Close table': 'ปิดโต๊ะ', 'Open table': 'เปิดโต๊ะ', 'Edit table': 'แก้ไขโต๊ะ',
  'The table will be removed from the floor.': 'โต๊ะนี้จะถูกลบออก', 'Refresh tables': 'รีเฟรชโต๊ะ',
  'Import menu': 'นำเข้าเมนู', 'Download template': 'ดาวน์โหลดตัวอย่าง',
  'Drop your CSV file here': 'วางไฟล์ CSV ที่นี่', 'Choose another file': 'เลือกไฟล์อื่น',
  'Choose CSV': 'เลือก CSV', 'Please wait…': 'โปรดรอ…', 'Importing…': 'กำลังนำเข้า…',
  'Status': 'สถานะ', 'Duplicate name': 'ชื่อซ้ำ', 'New': 'ใหม่',
  'Menu CSV file': 'ไฟล์ CSV เมนู', 'Menu categories': 'หมวดหมู่เมนู', 'All': 'ทั้งหมด',
  'CSV · up to 500 items · 1 MB maximum': 'CSV · สูงสุด 500 รายการ · ไม่เกิน 1 MB',
  'Prices are in baht. Blank prices become ฿0. Existing item names are skipped.': 'ราคาเป็นบาท ช่องราคาที่ว่างจะเป็น ฿0 และข้ามชื่อสินค้าที่มีอยู่แล้ว',
  'Columns: Product, Category, Price, Add-ons. Product names are required; Price can be blank. Add-ons: Cream cheese:10|Pearls:5.': 'คอลัมน์: สินค้า หมวดหมู่ ราคา ของเพิ่ม ต้องใส่ชื่อสินค้า ส่วนราคาเว้นว่างได้ ตัวอย่างของเพิ่ม: Cream cheese:10|Pearls:5',
}

const originalText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()
const attributes = ['aria-label', 'placeholder', 'title', 'alt'] as const

export function translate(value: string) {
  const match = /^(\s*)(.*?)(\s*)$/s.exec(value)
  if (!match) return value
  const translated = thai[match[2]]
    ?? match[2].replace(/^(\d+) guests$/, '$1 คน')
      .replace(/^(\d+) seats$/, '$1 ที่นั่ง')
      .replace(/^(\d+) new items? · (\d+) skipped$/, 'ใหม่ $1 รายการ · ข้าม $2 รายการ')
      .replace(/^Add (\d+) items?$/, 'เพิ่ม $1 รายการ')
  return match[1] + translated + match[3]
}

export function applyLanguage(language: Language) {
  document.documentElement.lang = language === 'th' ? 'th' : 'en'
  const visit = (root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) {
      const node = root as Text
      if (node.parentElement?.closest('[translate="no"]')) return
      const current = node.nodeValue || ''
      const previous = originalText.get(node)
      if (language === 'th') {
        if (previous !== undefined && current === translate(previous)) return
        originalText.set(node, current)
        const next = translate(current)
        if (next !== current) node.nodeValue = next
      } else if (previous !== undefined && current === translate(previous)) {
        node.nodeValue = previous
      }
      return
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return
    const element = root as Element
    if (element.closest('[translate="no"]')) return
    for (const attribute of attributes) {
      const current = element.getAttribute(attribute)
      if (current === null) continue
      let originals = originalAttributes.get(element)
      const previous = originals?.get(attribute)
      if (language === 'th') {
        if (previous !== undefined && current === translate(previous)) continue
        if (!originals) { originals = new Map(); originalAttributes.set(element, originals) }
        originals.set(attribute, current)
        const next = translate(current)
        if (next !== current) element.setAttribute(attribute, next)
      } else if (previous !== undefined && current === translate(previous)) {
        element.setAttribute(attribute, previous)
      }
    }
    for (const child of element.childNodes) visit(child)
  }
  visit(document.body)
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') visit(mutation.target)
      else if (mutation.type === 'attributes') visit(mutation.target)
      else for (const node of mutation.addedNodes) visit(node)
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes] })
  return () => observer.disconnect()
}
