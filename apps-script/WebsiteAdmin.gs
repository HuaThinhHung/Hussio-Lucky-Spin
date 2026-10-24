// Staff tools for the website flow (menu HUSSIO in the Sheet).
// Menu items can only call PUBLIC functions, so each menu* wrapper first gets
// the Sheet UI: from the public web app there is no UI and the call throws.

const WEB_DEFAULT_SHOP_DOMAIN_ = 'sbczjd-yj.myshopify.com';
const WEB_INVENTORY_SHEET_ID_ = '1AFa3FZjqyJriYnebq1-OhuaqVuzLUND4ypas87-r3dY';

function menuLookupOrder() { webStaff_(webLookupOrder_); }
function menuMarkPacked() { webStaff_(function (ui) { webSetStatus_(ui, 'DA_DONG_GOI'); }); }
function menuCancelGift() { webStaff_(function (ui) { webSetStatus_(ui, 'HUY'); }); }
function menuImportSizes() { webStaff_(webImportSizes_); }
function menuSetupWebsite() { webStaff_(function (ui) { ui.alert(setupWebsiteOrders_()); }); }
function menuSetupShopify() { webStaff_(webSetupShopify_); }
function menuTestShopify() { webStaff_(function (ui) { ui.alert(webTestShopify_()); }); }

function webStaff_(fn) {
  const ui = SpreadsheetApp.getUi();
  try {
    fn(ui);
  } catch (err) {
    console.error(err && err.stack || err);
    ui.alert('Lỗi: ' + (err && err.message || err));
  }
}

/** Creates or upgrades the website tabs and settings. Never deletes data or opens the campaign. */
function setupWebsiteOrders_() {
  const book = book_(), notes = [];
  const results = book.getSheetByName(WEB_SHEETS_.results) || book.insertSheet(WEB_SHEETS_.results);
  const width = WEB_HEADERS_.results.length;
  const header = results.getLastRow() ? results.getRange(1, 1, 1, width).getValues()[0] : [];
  if (header.join('|') !== WEB_HEADERS_.results.join('|')) {
    if (results.getLastRow() > 1)
      throw new Error('WEB_RESULTS đã có dữ liệu theo mẫu cột cũ. Đổi tên tab đó (ví dụ WEB_RESULTS_CU) rồi chạy lại.');
    results.getRange(1, 1, 1, width).setValues([WEB_HEADERS_.results]);
    notes.push('Đã tạo tiêu đề WEB_RESULTS (' + width + ' cột).');
  }
  results.setFrozenRows(1);
  results.getRange('B:C').setNumberFormat('@');
  results.getRange('F:H').setNumberFormat('@');

  let limits = book.getSheetByName(WEB_SHEETS_.limits);
  if (!limits) {
    limits = book.insertSheet(WEB_SHEETS_.limits);
    // WEB_CATALOG_ = 46 garments from "7.Gifts list" + the accessories/vouchers of the old wheel.
    const seed = WEB_CATALOG_.map(function (p) { return [p.id, p.name, 0, 'Chưa phân bổ quỹ quà', false, 1]; });
    limits.getRange(1, 1, 1, 6).setValues([WEB_HEADERS_.limits]);
    limits.getRange(2, 1, seed.length, 6).setValues(seed);
    notes.push('Đã tạo WEB_GIFT_LIMITS với ' + seed.length + ' quà (hạn mức 0, chưa bật).');
  } else if (String(limits.getRange(1, 6).getValue()) !== WEB_HEADERS_.limits[5]) {
    limits.getRange(1, 6).setValue(WEB_HEADERS_.limits[5]);
    notes.push('Đã thêm cột Trọng số (để trống = 1) vào WEB_GIFT_LIMITS.');
  }
  limits.setFrozenRows(1);

  let variants = book.getSheetByName(WEB_SHEETS_.variants);
  if (!variants) {
    variants = book.insertSheet(WEB_SHEETS_.variants);
    variants.getRange(1, 1, 1, 7).setValues([WEB_HEADERS_.variants]);
    const seed = WEB_CATALOG_.reduce(function (all, p) {
      return all.concat(p.variants.map(function (v) { return [webText_(v.sku), p.id, p.category, webText_(v.size), webText_(v.color), 0, false]; }));
    }, []);
    variants.getRange(2, 1, seed.length, 7).setValues(seed);
    notes.push('Đã tạo WEB_GIFT_VARIANTS (số lượng 0, chưa bật).');
  }
  variants.setFrozenRows(1);
  variants.getRange('A:A').setNumberFormat('@');
  variants.getRange('D:E').setNumberFormat('@');

  const configSheet = book.getSheetByName('CAU_HINH'), config = config_();
  const missing = WEB_SETTINGS_.filter(function (s) { return !(s[0] in config); });
  if (missing.length) {
    configSheet.getRange(configSheet.getLastRow() + 1, 1, missing.length, 3).setValues(missing);
    notes.push('Đã thêm cài đặt: ' + missing.map(function (s) { return s[0]; }).join(', ') + ' vào CAU_HINH.');
  }
  CacheService.getScriptCache().remove('web:catalog');
  return notes.length ? notes.join('\n') : 'Các bảng website đã đầy đủ, không cần thay đổi.';
}

/** Copies SKU/size/colour rows for gifts whose name appears in the inventory file. New rows stay off for review. */
function webImportSizes_(ui) {
  const sourceId = PropertiesService.getScriptProperties().getProperty('INVENTORY_SHEET_ID') || WEB_INVENTORY_SHEET_ID_;
  const source = SpreadsheetApp.openById(sourceId), sheet = source.getSheetByName('TOTAL') || source.getSheets()[0];
  const stock = {};
  rows_(sheet, 5).forEach(function (r) {
    const sku = String(r[0]).trim(), quantity = Number(r[4]) || 0;
    if (!sku || !String(r[1]).trim()) return;
    // The file lists some SKUs twice (odd-size block + full stock); keep the larger count.
    if (!stock[sku] || quantity > stock[sku].quantity)
      stock[sku] = {sku: sku, key: webNameKey_(r[1]), size: webSize_(r[2]), color: String(r[3]).trim(), quantity: quantity};
  });
  const book = book_(), variants = webSheet_(book, 'variants'), current = rows_(variants, 7);
  const known = {}, sizeless = {};
  current.forEach(function (r) { known[String(r[0]).trim()] = true; if (String(r[2]).trim().toLowerCase() === 'any') sizeless[String(r[1]).trim()] = true; });
  const matched = [], missing = [], rows = [];
  rows_(webSheet_(book, 'limits'), 6).forEach(function (r) {
    const id = String(r[0]).trim(), key = webNameKey_(r[1]);
    if (!id || sizeless[id]) return;
    const found = Object.keys(stock).map(function (sku) { return stock[sku]; }).filter(function (s) { return s.key === key; });
    if (!found.length) { missing.push(String(r[1])); return; }
    matched.push(String(r[1]) + ' (' + webUnique_(found.map(function (s) { return s.size; })).join('/') + ')');
    found.forEach(function (s) {
      if (known[s.sku]) return;
      known[s.sku] = true;
      rows.push([webText_(s.sku), id, /^QUAN /.test(key) ? 'pants' : 'top', webText_(s.size), webText_(s.color), s.quantity, false]);
    });
  });
  if (rows.length) variants.getRange(variants.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  CacheService.getScriptCache().remove('web:catalog');
  ui.alert('Nạp size từ "' + source.getName() + '"',
    'Khớp ' + matched.length + ' quà, thêm ' + rows.length + ' dòng SKU mới vào WEB_GIFT_VARIANTS (đang TẮT).\n'
    + (matched.length ? 'Đã khớp: ' + matched.join(', ') + '\n' : '')
    + '\nSố lượng đang lấy theo tồn bán hàng: sửa cột F thành số chiếc dành cho quà rồi tick Bật.\n'
    + (missing.length ? '\nChưa có trong file tồn (' + missing.length + '), cần nhập size tay: ' + missing.join(', ') : ''),
    ui.ButtonSet.OK);
}

function webLookupOrder_(ui) {
  const row = webPromptRow_(ui, 'Tra cứu đơn website');
  if (!row) return;
  const r = row.values;
  ui.alert('Đơn ' + r[WR_.order],
    'Quà: ' + r[WR_.giftName] + (r[WR_.size] ? '\nSize: ' + r[WR_.size] : '') + (r[WR_.color] ? '\nMàu: ' + r[WR_.color] : '')
    + '\nSKU: ' + r[WR_.sku] + '\nTrạng thái: ' + r[WR_.status] + '\nGhi lên Shopify: ' + r[WR_.shopify]
    + '\nNgày quay: ' + r[WR_.date] + '\nKhách nhập: ' + r[WR_.contact] + (r[WR_.note] ? '\nGhi chú CS: ' + r[WR_.note] : ''),
    ui.ButtonSet.OK);
}

/** DA_DONG_GOI after packing; HUY when the order is cancelled/refunded (the gift returns to stock). */
function webSetStatus_(ui, status) {
  const row = webPromptRow_(ui, status === 'HUY' ? 'Huỷ quà (đơn huỷ/hoàn)' : 'Đánh dấu đã đóng gói quà');
  if (!row) return;
  const r = row.values;
  if (r[WR_.status] === status || r[WR_.status] === 'HUY') { ui.alert('Đơn ' + r[WR_.order] + ' đang ở trạng thái ' + r[WR_.status] + '.'); return; }
  const question = status === 'HUY' ? 'Huỷ quà ' + r[WR_.giftName] + ' của đơn ' + r[WR_.order] + '? Quà sẽ được trả lại quỹ.'
    : 'Xác nhận đã đóng gói ' + r[WR_.giftName] + ' ' + r[WR_.size] + ' vào đơn ' + r[WR_.order] + '?';
  if (ui.alert(question, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const result = locked_(function () {
    const sheet = book_().getSheetByName(WEB_SHEETS_.results);
    const current = sheet.getRange(row.index, 1, 1, WEB_HEADERS_.results.length).getValues()[0];
    if (current[WR_.orderId] !== r[WR_.orderId]) return error_('VALIDATION', 'Dữ liệu vừa thay đổi, vui lòng thử lại.');
    sheet.getRange(row.index, WR_.status + 1).setValue(status);
    const note = String(current[WR_.note] || ''), stamp = Session.getActiveUser().getEmail() + ' ' + new Date().toLocaleString();
    sheet.getRange(row.index, WR_.note + 1).setValue((note ? note + '\n' : '') + status + ' — ' + stamp);
    return {ok: true, message: 'Đã cập nhật đơn ' + r[WR_.order] + ' → ' + status + '.'};
  });
  CacheService.getScriptCache().remove('web:catalog');
  ui.alert(result.message);
}

function webPromptRow_(ui, title) {
  const name = webOrderName_(prompt_(title, 'Nhập mã đơn website (ví dụ #1284):'));
  if (!name) return null;
  const ledger = webLedger_(book_());
  const index = ledger.findIndex(function (r) { return webOrderName_(r[WR_.order]) === name; });
  if (index < 0) { ui.alert('Đơn #' + name + ' chưa quay.'); return null; }
  return {index: index + 2, values: ledger[index]};
}

function webSetupShopify_(ui) {
  const props = PropertiesService.getScriptProperties();
  const domain = prompt_('Kết nối Shopify (1/3)', 'Tên miền myshopify của cửa hàng. Để trống = ' + WEB_DEFAULT_SHOP_DOMAIN_);
  if (domain === null) return;
  props.setProperty('SHOPIFY_SHOP_DOMAIN', domain || WEB_DEFAULT_SHOP_DOMAIN_);
  shopifyDomain_(props);
  const clientId = prompt_('Kết nối Shopify (2/3)',
    'Client ID của app (Dev Dashboard → app → Settings).\nĐể trống nếu bạn dùng Admin API access token (shpat_…).');
  if (clientId === null) return;
  if (clientId) {
    const secret = prompt_('Kết nối Shopify (3/3)', 'Client secret của app:');
    if (!secret) return;
    props.setProperties({SHOPIFY_CLIENT_ID: clientId, SHOPIFY_CLIENT_SECRET: secret});
    props.deleteProperty('SHOPIFY_ADMIN_ACCESS_TOKEN');
  } else {
    const token = prompt_('Kết nối Shopify (3/3)', 'Admin API access token (bắt đầu bằng shpat_):');
    if (!token) return;
    props.setProperty('SHOPIFY_ADMIN_ACCESS_TOKEN', token);
    props.deleteProperty('SHOPIFY_CLIENT_ID');
    props.deleteProperty('SHOPIFY_CLIENT_SECRET');
  }
  const write = ui.alert('Ghi quà lên đơn Shopify?',
    'Sau mỗi lượt quay, thêm tag LUCKY-SPIN và dòng ghi chú quà (tên, size, màu, SKU) vào đơn để kho đóng gói kèm. Cần quyền write_orders.',
    ui.ButtonSet.YES_NO) === ui.Button.YES;
  props.setProperty('SHOPIFY_WRITE_ORDER', write ? 'true' : 'false');
  CacheService.getScriptCache().remove('shopify:token');
  ui.alert(webTestShopify_());
}

/** Read-only check: credentials, scopes and whether customer contact fields are readable. */
function webTestShopify_() {
  const props = PropertiesService.getScriptProperties();
  const data = shopifyGraphql_('query LuckyCheck { shop { name myshopifyDomain } currentAppInstallation { accessScopes { handle } } '
    + 'orders(first: 1, reverse: true, sortKey: CREATED_AT, query: "source_name:web") { nodes { name email phone shippingAddress { phone } } } }', {});
  const scopes = data.currentAppInstallation.accessScopes.map(function (s) { return s.handle; });
  const has = function (scope) { return scopes.indexOf(scope) >= 0 || scopes.indexOf(scope.replace('read_', 'write_')) >= 0; };
  const order = data.orders.nodes[0], write = props.getProperty('SHOPIFY_WRITE_ORDER') === 'true';
  const lines = ['Kết nối OK: ' + data.shop.name + ' (' + data.shop.myshopifyDomain + ')',
    'Đọc đơn (read_orders): ' + (has('read_orders') ? 'CÓ' : 'THIẾU — khách sẽ không xác minh được đơn'),
    'Ghi quà lên đơn: ' + (!write ? 'TẮT' : scopes.indexOf('write_orders') >= 0 ? 'BẬT, có write_orders' : 'BẬT nhưng THIẾU write_orders')];
  if (order) {
    const phone = order.phone || (order.shippingAddress && order.shippingAddress.phone);
    lines.push('Đơn website gần nhất ' + order.name + ': đọc được email ' + (order.email ? 'CÓ' : 'KHÔNG') + ', SĐT ' + (phone ? 'CÓ' : 'KHÔNG'));
    if (!order.email && !phone)
      lines.push('→ Bật Protected customer data (Name, Email, Phone, Address) cho app trong Dev Dashboard rồi cài lại phiên bản app.');
  } else {
    lines.push('Chưa thấy đơn website nào để kiểm tra quyền đọc SĐT/email.');
  }
  return lines.join('\n');
}

/** Upper-case, accent-free name without a leading "ÁO " so "Sơ mi X" matches "ÁO SƠ MI X". */
function webNameKey_(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D')
    .toUpperCase().replace(/\s+/g, ' ').trim().replace(/^AO /, '');
}
