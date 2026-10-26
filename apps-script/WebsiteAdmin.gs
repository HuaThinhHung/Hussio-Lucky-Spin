// Staff tools for the website flow (menu HUSSIO in the Sheet).
// Menu items can only call PUBLIC functions, so each menu* wrapper first gets
// the Sheet UI: from the public web app there is no UI and the call throws.

const WEB_DEFAULT_SHOP_DOMAIN_ = 'sbczjd-yj.myshopify.com';
const WEB_INVENTORY_SHEET_ID_ = '1AFa3FZjqyJriYnebq1-OhuaqVuzLUND4ypas87-r3dY';

function menuLookupOrder() { webStaff_(webLookupOrder_); }
function menuMarkPacked() { webStaff_(function (ui) { webSetStatus_(ui, 'DA_DONG_GOI'); }); }
function menuCancelGift() { webStaff_(function (ui) { webSetStatus_(ui, 'HUY'); }); }
function menuImportSizes() { webStaff_(webImportSizes_); }
function menuSetupWebsite() { webStaff_(function (ui) { ui.alert(setupWebsiteOrders_() + '\n\n' + webLayoutWorkbook_()); }); }
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

// ---------------------------------------------------------------------------
// Workbook layout: one tab per job, in working order. TONG_QUAN and TON_QUA are
// formulas only (rebuilt on every run); the data tabs keep their rows untouched.

// Tabs of the old lucky-code flow (customer typed a HUS-… code). Hidden and renamed, never deleted.
const WEB_LEGACY_TABS_ = [['MA_QUAY', 'CU_MA_QUAY'], ['QUA_TANG', 'CU_QUA_TANG'], ['HUONG_DAN', 'CU_HUONG_DAN']];
const WEB_DASHBOARD_TAB_ = 'TONG_QUAN';
const WEB_STOCK_TAB_ = 'TON_QUA';
const WEB_TABS_ = [[WEB_DASHBOARD_TAB_, '#111111'], ['CAU_HINH', '#9e9e9e'], [WEB_SHEETS_.limits, '#d92d32'],
  [WEB_SHEETS_.variants, '#d92d32'], [WEB_STOCK_TAB_, '#f4b400'], [WEB_SHEETS_.results, '#0f9d58']];
const WEB_CONFIG_HELP_ = {
  STATUS: 'OPEN = cho quay · PAUSED = tạm dừng. Giữ PAUSED đến khi quay thử xong',
  STARTS_AT: 'Đơn phải được ĐẶT từ lúc này, ví dụ 2026-11-27T00:00:00+07:00',
  ENDS_AT: 'Đơn phải được ĐẶT trước lúc này (bắt buộc), ví dụ 2026-11-30T23:59:59+07:00',
  MIN_ORDER: 'Tiền hàng sau giảm tối thiểu để được quay (VND)',
  WEB_APP_URL: 'Link /exec của web app Apps Script; dán vào NEXT_PUBLIC_SHEET_API_URL của quay.hussio-vn.com',
};
const WEB_GUIDE_ = [
  ['1. Quỹ quà', 'WEB_GIFT_LIMITS: mỗi quà 1 dòng, thứ tự dòng = thứ tự ô trên vòng quay. Nhập Hạn mức (tổng số chiếc được phát) rồi tick Bật. Trọng số = tỷ lệ tương đối (trống = 1, 0 = không bốc).'],
  ['2. Size / SKU', 'WEB_GIFT_VARIANTS: mỗi SKU/size/màu 1 dòng. Nhóm: top (áo), pants (quần), any (vớ, mũ, thắt lưng, voucher, hộp — không cần size). Nhập Số lượng dành cho quà rồi tick Bật. Có thể dùng HUSSIO → Nạp size từ file tồn kho.'],
  ['3. Kiểm tra tồn', 'TON_QUA tự tính quà còn lại và báo quà nào đã bật nhưng chưa có size. Không sửa tay tab này.'],
  ['4. Thời gian', 'CAU_HINH: STARTS_AT / ENDS_AT là khoảng thời gian ĐẶT ĐƠN. SPIN_UNTIL trống = ENDS_AT + 3 ngày cho đơn đặt sát giờ.'],
  ['5. Shopify', 'HUSSIO → Cài đặt kết nối Shopify, rồi HUSSIO → Kiểm tra kết nối Shopify (cần read_orders và quyền đọc SĐT/email khách).'],
  ['6. Web app', 'Apps Script → Deploy → New deployment → Web app (Execute as: Me · Who has access: Anyone). Dán link /exec vào CAU_HINH → WEB_APP_URL và vào biến NEXT_PUBLIC_SHEET_API_URL của quay.hussio-vn.com.'],
  ['7. Thử rồi mở', 'Đặt 1 đơn web thật ≥ 1.300.000đ, quay thử, kiểm tra dòng mới ở WEB_RESULTS, rồi HUSSIO → Huỷ quà cho đơn thử. Cuối cùng đổi STATUS = OPEN.'],
  ['8. Hằng ngày', 'WEB_RESULTS: mỗi đơn 1 dòng. CHO_DONG_GOI → kho đóng quà vào đơn (lọc tag LUCKY-SPIN trên Shopify) rồi HUSSIO → Đánh dấu đã đóng gói. GUI_RIENG → đơn đã giao, CS gửi quà riêng. Đơn huỷ/hoàn → HUSSIO → Huỷ quà (quà về lại quỹ).'],
  ['Lưu ý', 'Không sửa tay cột Quà/Size/SKU/JSON ở WEB_RESULTS. Không chia sẻ Sheet cho khách. Các tab CU_… (mã quay HUS-… cũ) đã ẩn và không còn dùng.'],
];

/** Archives the old tabs, rebuilds TONG_QUAN + TON_QUA and orders the tabs. Never deletes gift or result rows. */
function webLayoutWorkbook_() {
  const book = book_(), notes = [];
  const limits = webSheet_(book, 'limits'), variants = webSheet_(book, 'variants'), results = webSheet_(book, 'results');

  const configSheet = book.getSheetByName('CAU_HINH'), help = Object.assign({}, WEB_CONFIG_HELP_);
  WEB_SETTINGS_.forEach(function (s) { help[s[0]] = s[2]; });
  const settings = rows_(configSheet, 3);
  for (let i = settings.length - 1; i >= 0; i--) {
    const key = String(settings[i][0]).trim();
    // DEPLOYMENT was a hand-kept note that nothing reads; it kept showing NOT_DEPLOYED.
    if (key === 'DEPLOYMENT') { configSheet.deleteRow(i + 2); notes.push('Đã bỏ dòng DEPLOYMENT (không dùng) khỏi CAU_HINH.'); continue; }
    if (help[key] && settings[i][2] !== help[key]) configSheet.getRange(i + 2, 3).setValue(help[key]);
  }
  const statusRow = rows_(configSheet, 1).findIndex(function (r) { return String(r[0]).trim() === 'STATUS'; });
  if (statusRow >= 0) configSheet.getRange(statusRow + 2, 2).setDataValidation(webListRule_(['OPEN', 'PAUSED'], false));

  // A typed "TRUE" is text, which the pool ignores (it needs a real checkbox value).
  webCheckboxes_(limits, 5, notes);
  webCheckboxes_(variants, 7, notes);
  webValidate_(limits, 6, SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0)
    .setHelpText('Trọng số: để trống = 1, 0 = không bốc quà này').build());
  webValidate_(variants, 3, webListRule_(['top', 'pants', 'any'], false));
  [limits, variants, results].forEach(function (sheet) { sheet.getRange('1:1').setFontWeight('bold'); });

  const stock = book.getSheetByName(WEB_STOCK_TAB_) || book.insertSheet(WEB_STOCK_TAB_);
  webResetTab_(stock);
  const stockRows = webStockRows_();
  stock.getRange(1, 1, stockRows.length, stockRows[0].length).setValues(stockRows);
  stock.getRange('1:1').setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  stock.getRange('A1').setNote('Tự tính từ WEB_GIFT_LIMITS, WEB_GIFT_VARIANTS và WEB_RESULTS (đơn HUY trả quà về quỹ). Không nhập vào tab này.');
  stock.setFrozenRows(1);
  stock.setColumnWidth(2, 260);
  stock.setColumnWidth(8, 180);
  stock.setColumnWidth(9, 24);
  stock.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Đang quay được').setBackground('#d9f2e3').setRanges([stock.getRange('H2:H')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Chưa có size còn hàng').setBackground('#fde2e1').setRanges([stock.getRange('H2:H')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Hết hạn mức').setBackground('#fff1cc').setRanges([stock.getRange('H2:H')]).build(),
  ]);
  webWarnOnEdit_(stock, 'TON_QUA tự tính — sửa ở WEB_GIFT_LIMITS / WEB_GIFT_VARIANTS');

  const dashboard = book.getSheetByName(WEB_DASHBOARD_TAB_) || book.insertSheet(WEB_DASHBOARD_TAB_);
  webResetTab_(dashboard);
  const board = webDashboardRows_();
  dashboard.getRange(1, 1, board.length, 5).setValues(board);
  dashboard.getRange('A1').setFontSize(14).setFontWeight('bold');
  dashboard.getRange('B1').setFontColor('#777777').setFontStyle('italic');
  board.forEach(function (row, i) {
    if (WEB_DASHBOARD_SECTIONS_.indexOf(row[0]) >= 0) dashboard.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  });
  dashboard.getRange(3, 4, 1, 2).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  dashboard.getRange(4, 4, WEB_GUIDE_.length, 1).setFontWeight('bold');
  dashboard.getRange(4, 5, WEB_GUIDE_.length, 1).setWrap(true);
  dashboard.getRange(1, 1, board.length, 5).setVerticalAlignment('top');
  dashboard.getRange('B8').setNumberFormat('#,##0"đ"');
  [300, 250, 24, 120, 620].forEach(function (width, i) { dashboard.setColumnWidth(i + 1, width); });
  dashboard.setFrozenRows(1);
  webWarnOnEdit_(dashboard, 'TONG_QUAN tự tính — sửa ở CAU_HINH và các tab WEB_…');
  notes.push('Đã làm mới TONG_QUAN (bảng theo dõi + hướng dẫn) và TON_QUA (tồn quà theo quà / SKU).');

  WEB_TABS_.forEach(function (tab, i) {
    const sheet = book.getSheetByName(tab[0]);
    if (!sheet) return;
    book.setActiveSheet(sheet);
    book.moveActiveSheet(i + 1);
    sheet.setTabColor(tab[1]);
  });
  book.setActiveSheet(dashboard);

  // Hidden last: activating a hidden sheet would show it again.
  WEB_LEGACY_TABS_.forEach(function (names) {
    const sheet = book.getSheetByName(names[0]) || book.getSheetByName(names[1]);
    if (!sheet) return;
    if (sheet.getName() === names[0] && !book.getSheetByName(names[1])) sheet.setName(names[1]);
    if (!sheet.isSheetHidden()) {
      sheet.hideSheet();
      notes.push('Đã ẩn tab cũ ' + sheet.getName() + ' (hệ thống mã quay HUS-… cũ, dữ liệu vẫn giữ nguyên).');
    }
  });
  return notes.join('\n');
}

const WEB_DASHBOARD_SECTIONS_ = ['CHƯƠNG TRÌNH', 'KẾT QUẢ QUAY', 'QUỸ QUÀ (chi tiết ở TON_QUA)', 'SẴN SÀNG MỞ CHƯƠNG TRÌNH?'];

/** TONG_QUAN: live counts on the left (A:B), the step-by-step guide on the right (D:E). */
function webDashboardRows_() {
  const R = WEB_SHEETS_.results, T = WEB_STOCK_TAB_;
  const cfg = function (key) { return 'IFERROR(VLOOKUP("' + key + '",CAU_HINH!A:B,2,FALSE),"")'; };
  const orRequired = function (key) { return '=IF(' + cfg(key) + '="","⚠ Chưa điền",' + cfg(key) + ')'; };
  const results = function (index) { return R + '!' + webColumn_(index) + '2:' + webColumn_(index); };
  const status = function (code) { return '=COUNTIF(' + results(WR_.status) + ',"' + code + '")'; };
  const playable = 'COUNTIF(' + T + '!H2:H,"Đang quay được")';
  const left = [
    ['HUSSIO · LUCKY SPIN WEBSITE', 'Tự cập nhật — không nhập vào tab này'],
    ['', ''],
    [WEB_DASHBOARD_SECTIONS_[0], ''],
    ['Trạng thái (STATUS)', '=' + cfg('STATUS')],
    ['Nhận đơn đặt từ (STARTS_AT)', orRequired('STARTS_AT')],
    ['Nhận đơn đặt đến (ENDS_AT)', orRequired('ENDS_AT')],
    ['Hạn cuối được quay (SPIN_UNTIL)', '=IF(' + cfg('SPIN_UNTIL') + '="","ENDS_AT + 3 ngày",' + cfg('SPIN_UNTIL') + ')'],
    ['Tiền hàng tối thiểu', '=' + cfg('MIN_ORDER')],
    ['Web app (/exec)', '=IF(' + cfg('WEB_APP_URL') + '="","⚠ Chưa triển khai",' + cfg('WEB_APP_URL') + ')'],
    ['', ''],
    [WEB_DASHBOARD_SECTIONS_[1], ''],
    ['Tổng đơn đã quay', '=COUNTA(' + results(WR_.order) + ')'],
    ['Quay hôm nay', '=COUNTIFS(' + results(WR_.date) + ',">="&TODAY())'],
    ['Chờ đóng gói gửi kèm (CHO_DONG_GOI)', status('CHO_DONG_GOI')],
    ['CS gửi quà riêng (GUI_RIENG)', status('GUI_RIENG')],
    ['Đã đóng gói (DA_DONG_GOI)', status('DA_DONG_GOI')],
    ['Đã huỷ quà (HUY)', status('HUY')],
    ['Ghi lên Shopify bị lỗi', '=COUNTIF(' + results(WR_.shopify) + ',"LỖI*")'],
    ['', ''],
    [WEB_DASHBOARD_SECTIONS_[2], ''],
    ['Quà đang bật', '=COUNTIF(' + T + '!C2:C,"BẬT")'],
    ['Quà đang quay được', '=' + playable],
    ['Quà bật nhưng chưa có size còn hàng', '=COUNTIF(' + T + '!H2:H,"Chưa có size còn hàng")'],
    ['Quà còn lại (theo hạn mức)', '=SUMIFS(' + T + '!F2:F,' + T + '!H2:H,"Đang quay được")'],
    ['', ''],
    [WEB_DASHBOARD_SECTIONS_[3], ''],
    ['Đã điền STARTS_AT và ENDS_AT', '=IF(AND(' + cfg('STARTS_AT') + '<>"",' + cfg('ENDS_AT') + '<>""),"✅ Xong","⚠ Chưa")'],
    ['Có quà đang quay được', '=IF(' + playable + '>0,"✅ Xong","⚠ Chưa")'],
    ['Đã triển khai web app', '=IF(' + cfg('WEB_APP_URL') + '<>"","✅ Xong","⚠ Chưa")'],
    ['Kết nối Shopify', 'HUSSIO → Kiểm tra kết nối Shopify'],
    ['Đang mở cho khách quay', '=IF(' + cfg('STATUS') + '="OPEN","✅ OPEN","⏸ "&' + cfg('STATUS') + '&" — đổi STATUS = OPEN khi sẵn sàng")'],
  ];
  const right = [['', ''], ['', ''], ['HƯỚNG DẪN', 'VIỆC CẦN LÀM']].concat(WEB_GUIDE_);
  const rows = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    rows.push((left[i] || ['', '']).concat([''], right[i] || ['', '']));
  return rows;
}

/** TON_QUA: per gift (A:H) and per SKU (J:P), used stock counted from WEB_RESULTS except HUY rows. */
function webStockRows_() {
  const L = WEB_SHEETS_.limits, V = WEB_SHEETS_.variants, R = WEB_SHEETS_.results;
  const results = function (index) { return R + '!' + webColumn_(index) + '2:' + webColumn_(index); };
  const used = function (column, keys) { return 'COUNTIFS(' + results(column) + ',' + keys + ',' + results(WR_.status) + ',"<>HUY")'; };
  const fromLimits = function (body) { return '=ARRAYFORMULA(IF(' + L + '!A2:A="",,' + body + '))'; };
  const fromVariants = function (body) { return '=ARRAYFORMULA(IF(' + V + '!A2:A="",,' + body + '))'; };
  // MAP evaluates each gift independently; SUMIFS with an array criterion does
  // not reliably spill per gift. P already deducts usage for each enabled SKU.
  const sizeStock = 'MAP(A2:A,LAMBDA(giftKey,IF(giftKey="",,SUMIF(K2:K,giftKey,P2:P))))';
  return [
    ['ID quà', 'Tên quà', 'Bật', 'Hạn mức', 'Đã trúng', 'Còn lại (hạn mức)', 'Chiếc theo size còn lại', 'Tình trạng', '',
      'SKU', 'ID quà', 'Size', 'Màu', 'Số lượng (đang bật)', 'Đã trúng', 'Còn lại'],
    [
      fromLimits(L + '!A2:A'),
      fromLimits(L + '!B2:B'),
      fromLimits('IF(' + L + '!E2:E=TRUE,"BẬT","tắt")'),
      fromLimits('IFERROR(' + L + '!C2:C*1,0)'),
      fromLimits(used(WR_.giftId, 'A2:A')),
      fromLimits('IF(D2:D>E2:E,D2:D-E2:E,0)'),
      '=' + sizeStock,
      fromLimits('IF(C2:C<>"BẬT","Đang tắt",IF((' + L + '!F2:F<>"")*(' + L + '!F2:F=0),"Trọng số 0",IF(F2:F=0,"Hết hạn mức",IF(G2:G=0,"Chưa có size còn hàng","Đang quay được"))))'),
      '',
      fromVariants(V + '!A2:A'),
      fromVariants(V + '!B2:B'),
      fromVariants(V + '!D2:D'),
      fromVariants(V + '!E2:E'),
      fromVariants('IF(' + V + '!G2:G=TRUE,IFERROR(' + V + '!F2:F*1,0),0)'),
      fromVariants(used(WR_.sku, 'J2:J')),
      fromVariants('IF(N2:N>O2:O,N2:N-O2:O,0)'),
    ],
  ];
}

function webResetTab_(sheet) {
  const all = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
  all.breakApart();
  sheet.clear();
  all.clearDataValidations();
  all.clearNote();
}

/** Turns typed "TRUE"/"FALSE" into real checkbox values and shows the column as checkboxes (data rows only). */
function webCheckboxes_(sheet, column, notes) {
  if (sheet.getLastRow() < 2) return;
  const range = sheet.getRange(2, column, sheet.getLastRow() - 1, 1), values = range.getValues();
  let fixed = 0;
  const cleaned = values.map(function (r) {
    const text = typeof r[0] === 'string' ? r[0].trim().toUpperCase() : null;
    if (text === 'TRUE' || text === 'FALSE') { fixed++; return [text === 'TRUE']; }
    return [r[0]];
  });
  if (fixed) {
    range.setValues(cleaned);
    notes.push('Đã chuyển ' + fixed + ' ô "TRUE/FALSE" dạng chữ thành ô tick ở ' + sheet.getName() + '.');
  }
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

/** Validation on existing data rows only: an empty validated row would move getLastRow and the next append. */
function webValidate_(sheet, column, rule) {
  if (sheet.getLastRow() >= 2) sheet.getRange(2, column, sheet.getLastRow() - 1, 1).setDataValidation(rule);
}

function webListRule_(values, allowInvalid) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(allowInvalid).build();
}

function webWarnOnEdit_(sheet, description) {
  if (!sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) sheet.protect().setDescription(description).setWarningOnly(true);
}

/** 0-based column index → letter (A–Z is enough for these tabs). */
function webColumn_(index) { return String.fromCharCode(65 + index); }

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
