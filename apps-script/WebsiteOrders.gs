// HUSSIO Lucky Spin — website-only flow.
// Customer enters the Shopify order number + phone/email used at checkout →
// the order is verified on Shopify → exactly one spin → gift, size and colour
// are written to WEB_RESULTS (and optionally onto the Shopify order).
// Shopify credentials live ONLY in Script Properties, never in the Sheet or page.

const WEB_SHEETS_ = {results: 'WEB_RESULTS', limits: 'WEB_GIFT_LIMITS', variants: 'WEB_GIFT_VARIANTS'};
const WEB_HEADERS_ = {
  results: ['Ngày quay', 'Mã đơn', 'SĐT/email khách nhập', 'Tiền hàng (sau giảm)', 'Quà trúng', 'Size', 'Màu', 'SKU quà',
    'Trạng thái quà', 'Ghi lên Shopify', 'Shopify ID', 'ID quà', 'Kết quả JSON', 'Ghi chú CS'],
  limits: ['ID quà', 'Tên quà', 'Hạn mức', 'Ghi chú', 'Bật', 'Trọng số'],
  variants: ['SKU', 'ID quà', 'Nhóm top/pants/any', 'Size', 'Màu', 'Số lượng dành cho quà', 'Bật'],
};
// WEB_RESULTS columns (0-based).
const WR_ = {date: 0, order: 1, contact: 2, amount: 3, giftName: 4, size: 5, color: 6, sku: 7, status: 8, shopify: 9,
  orderId: 10, giftId: 11, json: 12, note: 13};
const WEB_STATUS_ = {
  CHO_DONG_GOI: {reward: 'WON', label: 'Chờ đóng gói gửi kèm đơn'},
  GUI_RIENG: {reward: 'WON', label: 'HUSSIO sẽ liên hệ gửi quà'},
  DA_DONG_GOI: {reward: 'FULFILLED', label: 'Đã đóng gói gửi kèm đơn'},
  HUY: {reward: 'VOID', label: 'Quà đã huỷ'},
};
// Settings added to CAU_HINH by setup (key, default, help).
const WEB_SETTINGS_ = [
  ['SPIN_UNTIL', '', 'Hạn cuối được quay (ISO). Để trống = ENDS_AT + 3 ngày cho đơn đặt sát giờ kết thúc'],
  ['ALLOW_SHIPPED_ORDERS', 'TRUE', 'TRUE: đơn đã giao vận chuyển vẫn quay, quà ghi GUI_RIENG để CS gửi riêng. FALSE: chặn'],
  ['ZALO_URL', '', 'Link Zalo OA HUSSIO, ví dụ https://zalo.me/<id>. Hiện nút "Nhắn Zalo" sau khi quay'],
];
// COD orders stay PENDING until delivered, so only refunded/voided payments are rejected.
const WEB_REJECTED_PAYMENTS_ = ['VOIDED', 'REFUNDED', 'EXPIRED'];
// Fulfilment states where the warehouse can still pack the gift into the parcel.
const WEB_PACKABLE_ = ['UNFULFILLED', 'ON_HOLD', 'SCHEDULED', 'OPEN', 'PENDING_FULFILLMENT'];
const WEB_SPIN_GRACE_DAYS_ = 3;
const WEB_MAX_FAILURES_ = 5;
const SHOPIFY_API_VERSION_ = '2026-10';

// ---------------------------------------------------------------------------
// Public entry points (google.script.run and the JSON API). Everything else
// ends in "_" so the public web app cannot call it.

/** Wheel data: gifts in Sheet order with the sizes still in stock. */
function customerCatalog() {
  return webGuarded_(webCatalog_);
}

/** action: 'validate' | 'spin'; body: {code, contact, top, pants}. */
function customerOrderRequest(action, body) {
  return webGuarded_(function () { return webOrderRequest_(action, body || {}); });
}

/** JSON API for a page hosted elsewhere (quay.hussio-vn.com): POST {action, ...body} as text/plain. */
function doPost(e) {
  let request = {};
  try { request = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { request = {}; }
  const action = String(request.action || '');
  const result = action === 'catalog' ? customerCatalog() : customerOrderRequest(action, request);
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function webGuarded_(fn) {
  try {
    return fn();
  } catch (err) {
    console.error(err && err.stack || err);
    return error_('SERVER_ERROR', 'Hệ thống đang bận hoặc chưa kết nối được đơn hàng. Vui lòng thử lại sau ít phút.');
  }
}

// ---------------------------------------------------------------------------
// Customer flow

function webCatalog_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('web:catalog');
  if (hit) return JSON.parse(hit);
  const config = config_(), book = book_();
  const gifts = webPool_(book, webLedger_(book)).map(function (gift) {
    const groups = gift.variants.map(function (v) { return v.group; });
    const live = gift.remaining > 0 ? gift.variants.filter(function (v) { return v.remaining > 0; }) : [];
    return {
      id: gift.id,
      name: gift.name,
      group: groups.indexOf('any') >= 0 ? 'any' : groups.indexOf('pants') >= 0 ? 'pants' : 'top',
      sizes: webUnique_(live.filter(function (v) { return v.group !== 'any' && v.size; }).map(function (v) { return v.size; })),
      available: live.length > 0,
    };
  });
  const result = {ok: true, open: webWindow_(config).state === 'OPEN', contactUrl: webSafeUrl_(config.ZALO_URL), gifts: gifts};
  cache.put('web:catalog', JSON.stringify(result), 30);
  return result;
}

function webOrderRequest_(action, body) {
  if (action !== 'validate' && action !== 'spin') return error_('VALIDATION', 'Thao tác không hợp lệ.');
  const orderName = webOrderName_(body.code), contact = String(body.contact || '').trim();
  if (!orderName || !contact || contact.length > 160) return webInvalid_();
  const sizes = {top: webSize_(body.top), pants: webSize_(body.pants)};
  const cache = CacheService.getScriptCache(), failKey = 'web:fail:' + orderName;
  if (Number(cache.get(failKey) || 0) >= WEB_MAX_FAILURES_)
    return error_('LOCKED', 'Bạn đã nhập sai nhiều lần. Vui lòng thử lại sau 30 phút hoặc nhắn HUSSIO để được hỗ trợ.');

  // A customer re-opening the page with the same contact sees the saved result
  // without another Shopify call — even after the campaign has ended.
  const book = book_();
  const saved = webLedger_(book).filter(function (r) {
    return webOrderName_(r[WR_.order]) === orderName && webSameContact_(r[WR_.contact], contact);
  })[0];
  if (saved) return webReplay_(action, saved);

  const config = config_(), campaign = webWindow_(config);
  if (campaign.state === 'NOT_STARTED') return error_('CAMPAIGN_NOT_STARTED', 'Chương trình chưa bắt đầu. Vui lòng quay lại sau.');
  const order = websiteOrder_(orderName);
  if (!order || !orderContact_(order, contact)) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 1800);
    return webInvalid_();
  }

  const outcome = locked_(function () {
    const ledger = webLedger_(book);
    const previous = ledger.filter(function (r) { return r[WR_.orderId] === order.id; })[0];
    if (previous) return webReplay_(action, previous);
    if (campaign.state === 'ENDED') return error_('CAMPAIGN_ENDED', 'Chương trình đã kết thúc.');
    if (campaign.state !== 'OPEN') return error_('CAMPAIGN_PAUSED', 'Chương trình đang tạm dừng. Vui lòng quay lại sau.');
    const problem = webEligibility_(order, config, campaign);
    if (problem) return problem;
    const packWithOrder = WEB_PACKABLE_.indexOf(order.displayFulfillmentStatus) >= 0;
    if (!packWithOrder && String(config.ALLOW_SHIPPED_ORDERS).toUpperCase() === 'FALSE')
      return error_('ORDER_SHIPPED', 'Đơn hàng đã được giao cho đơn vị vận chuyển nên không thể gửi quà kèm. Vui lòng nhắn HUSSIO để được hỗ trợ.');

    const gifts = webPool_(book, ledger);
    const anySize = webEligible_(gifts, null), forSizes = webEligible_(gifts, sizes);
    if (!anySize.length) return error_('NO_PRIZES', 'Quỹ quà đã hết. Vui lòng nhắn HUSSIO để được hỗ trợ.');
    if (action === 'validate') {
      if ((sizes.top || sizes.pants) && !forSizes.length) return webSizeGone_();
      return {ok: true, state: 'READY', customerName: 'Bạn', spinsAvailable: 1, expiresAt: new Date(campaign.until).toISOString(), askNameConsent: false};
    }
    if (!forSizes.length) return webSizeGone_();

    const pick = webDraw_(forSizes), gift = pick.gift, variant = pick.variant, now = new Date();
    const status = packWithOrder ? 'CHO_DONG_GOI' : 'GUI_RIENG';
    const result = {
      spinId: Utilities.getUuid(), prizeId: gift.id, prizeName: gift.name, prizeHeadline: gift.name,
      prizeType: /^giảm/i.test(gift.name) ? 'VOUCHER' : 'PRODUCT_POOL',
      segmentIndex: gift.index, segmentCount: gifts.length, spunAt: now.toISOString(),
      rewardStatus: WEB_STATUS_[status].reward, rewardStatusLabel: WEB_STATUS_[status].label,
      voucher: null, product: null, orderName: order.name,
      gift: {name: gift.name, size: variant.size, color: variant.color, sku: variant.sku, packWithOrder: packWithOrder},
    };
    const writeOrder = PropertiesService.getScriptProperties().getProperty('SHOPIFY_WRITE_ORDER') === 'true';
    // One ledger row is both the result and the stock deduction: a retry finds
    // this row, and no second write can drift from it.
    const storedContact = contact.indexOf('@') >= 0 ? contact.toLowerCase() : orderPhone_(contact);
    book.getSheetByName(WEB_SHEETS_.results).appendRow([now, webText_(order.name), webText_(storedContact),
      Number(order.currentSubtotalPriceSet.shopMoney.amount), webText_(gift.name), webText_(variant.size),
      webText_(variant.color), webText_(variant.sku), status, writeOrder ? 'ĐANG GHI' : 'CHƯA BẬT', order.id, gift.id,
      JSON.stringify(result), '']);
    SpreadsheetApp.flush();
    cache.remove('web:catalog');
    return {ok: true, repeated: false, result: result, writeOrder: writeOrder};
  });

  if (outcome.ok && outcome.writeOrder) webAnnotateOrder_(order, outcome.result.gift);
  if (outcome.ok) delete outcome.writeOrder;
  return outcome;
}

function webEligibility_(order, config, campaign) {
  const money = order.currentSubtotalPriceSet && order.currentSubtotalPriceSet.shopMoney;
  const min = Number(config.MIN_ORDER) || 1300000, created = new Date(order.createdAt).getTime();
  if (order.test || order.sourceName !== 'web')
    return error_('INVALID_CODE', 'Chương trình chỉ áp dụng cho đơn đặt trên website hussio.com.');
  if (order.cancelledAt || WEB_REJECTED_PAYMENTS_.indexOf(order.displayFinancialStatus) >= 0)
    return error_('CANCELLED', 'Đơn hàng đã huỷ hoặc hoàn tiền nên không còn lượt quay.');
  if (!money || money.currencyCode !== 'VND' || Number(money.amount) < min)
    return error_('INVALID_CODE', 'Đơn hàng chưa đạt ' + webMoney_(min) + ' tiền hàng (sau giảm giá) để nhận lượt quay.');
  if (!(created >= campaign.start && created < campaign.end))
    return error_('INVALID_CODE', 'Đơn hàng được đặt ngoài thời gian chương trình.');
  return null;
}

function webReplay_(action, row) {
  const result = JSON.parse(row[WR_.json]), status = WEB_STATUS_[row[WR_.status]];
  if (status) { result.rewardStatus = status.reward; result.rewardStatusLabel = status.label; }
  return action === 'validate' ? {ok: true, state: 'ALREADY_SPUN', result: result} : {ok: true, repeated: true, result: result};
}

/** Campaign window. Orders must be placed in [STARTS_AT, ENDS_AT); spinning stays open until SPIN_UNTIL. */
function webWindow_(config) {
  const start = new Date(config.STARTS_AT).getTime(), end = new Date(config.ENDS_AT).getTime();
  const until = config.SPIN_UNTIL ? new Date(config.SPIN_UNTIL).getTime() : end + WEB_SPIN_GRACE_DAYS_ * 864e5;
  if (![start, end, until].every(Number.isFinite) || end <= start || until < end) return {state: 'PAUSED'};
  const now = Date.now(), base = {start: start, end: end, until: until};
  if (config.STATUS !== 'OPEN') return Object.assign({state: 'PAUSED'}, base);
  if (now < start) return Object.assign({state: 'NOT_STARTED'}, base);
  if (now >= until) return Object.assign({state: 'ENDED'}, base);
  return Object.assign({state: 'OPEN'}, base);
}

// ---------------------------------------------------------------------------
// Gift pool: WEB_GIFT_LIMITS caps each gift, WEB_GIFT_VARIANTS holds the
// SKU/size/colour stock. Used stock is derived from WEB_RESULTS (HUY rows free it).

function webPool_(book, ledger) {
  const usedSku = {}, usedGift = {};
  ledger.forEach(function (r) {
    if (!r[WR_.json] || r[WR_.status] === 'HUY') return;
    usedSku[r[WR_.sku]] = (usedSku[r[WR_.sku]] || 0) + 1;
    usedGift[r[WR_.giftId]] = (usedGift[r[WR_.giftId]] || 0) + 1;
  });
  const gifts = [], byId = {};
  rows_(webSheet_(book, 'limits'), 6).forEach(function (r) {
    const id = String(r[0]).trim(), limit = r[2] === '' ? NaN : Number(r[2]), weight = r[5] === '' ? 1 : Number(r[5]);
    // Only an enabled row with a real limit claims the ID, so a stray duplicate cannot hide it.
    if (!id || r[4] !== true || !Number.isSafeInteger(limit) || limit < 0 || !(weight > 0) || byId[id]) return;
    const gift = {id: id, name: String(r[1]).trim(), weight: weight, index: gifts.length,
      remaining: Math.max(0, limit - (usedGift[id] || 0)), variants: []};
    byId[id] = gift;
    gifts.push(gift);
  });
  const bySku = {};
  rows_(webSheet_(book, 'variants'), 7).forEach(function (r) {
    const sku = String(r[0]).trim(), gift = byId[String(r[1]).trim()], group = String(r[2]).trim().toLowerCase();
    const quantity = Number(r[5]);
    if (!sku || !gift || r[6] !== true || ['top', 'pants', 'any'].indexOf(group) < 0 || !Number.isSafeInteger(quantity) || quantity <= 0) return;
    // The same SKU listed twice for one gift adds up; for another gift it is ignored.
    if (bySku[sku]) { if (bySku[sku].giftId === gift.id) bySku[sku].quantity += quantity; return; }
    const variant = {sku: sku, giftId: gift.id, group: group, size: webSize_(r[3]), color: String(r[4]).trim(), quantity: quantity};
    bySku[sku] = variant;
    gift.variants.push(variant);
  });
  gifts.forEach(function (gift) {
    gift.variants.forEach(function (v) { v.remaining = Math.max(0, v.quantity - (usedSku[v.sku] || 0)); });
  });
  return gifts;
}

/** Gifts with at least one variant in stock that fits the sizes (sizes = null: any size). */
function webEligible_(gifts, sizes) {
  return gifts.map(function (gift) {
    const variants = gift.remaining <= 0 ? [] : gift.variants.filter(function (v) {
      if (v.remaining <= 0) return false;
      if (!sizes || v.group === 'any') return true;
      return !!v.size && v.size === (v.group === 'pants' ? sizes.pants : sizes.top);
    });
    return {gift: gift, variants: variants};
  }).filter(function (entry) { return entry.variants.length > 0; });
}

/** Gift by its weight (default 1, so colours/SKUs don't raise a gift's odds), then a variant by remaining stock. */
function webDraw_(eligible) {
  const entry = webPick_(eligible, function (e) { return e.gift.weight; });
  return {gift: entry.gift, variant: webPick_(entry.variants, function (v) { return v.remaining; })};
}

function webPick_(items, weightOf) {
  const total = items.reduce(function (sum, item) { return sum + weightOf(item); }, 0);
  let ticket = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    ticket -= weightOf(items[i]);
    if (ticket < 0) return items[i];
  }
  return items[items.length - 1];
}

function webLedger_(book) { return rows_(webSheet_(book, 'results'), WEB_HEADERS_.results.length); }

function webSheet_(book, key) {
  const sheet = book.getSheetByName(WEB_SHEETS_[key]);
  if (!sheet) throw new Error('Thiếu tab ' + WEB_SHEETS_[key] + '. Chạy menu HUSSIO → Tạo / cập nhật bảng website.');
  return sheet;
}

// ---------------------------------------------------------------------------
// Shopify

function websiteOrder_(orderName) {
  const data = shopifyGraphql_('query LuckyOrder($query: String!) { orders(first: 5, query: $query) { nodes { id name email phone note '
    + 'createdAt cancelledAt test sourceName displayFinancialStatus displayFulfillmentStatus '
    + 'currentSubtotalPriceSet { shopMoney { amount currencyCode } } shippingAddress { phone } billingAddress { phone } } } }',
    {query: 'name:"#' + orderName + '"'});
  const exact = data.orders.nodes.filter(function (o) { return webOrderName_(o.name) === orderName; });
  return exact.length === 1 ? exact[0] : null;
}

function orderContact_(order, contact) {
  if (contact.indexOf('@') >= 0) return !!order.email && String(order.email).trim().toLowerCase() === contact.toLowerCase();
  const phone = orderPhone_(contact);
  return !!phone && [order.phone, order.shippingAddress && order.shippingAddress.phone, order.billingAddress && order.billingAddress.phone]
    .some(function (value) { return orderPhone_(value) === phone; });
}

function orderPhone_(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.indexOf('84') === 0 && digits.length === 11) digits = '0' + digits.slice(2);
  if (digits.length === 9 && /^[35789]/.test(digits)) digits = '0' + digits;
  return /^0\d{9}$/.test(digits) ? digits : '';
}

/** Best effort: tag the order and append a note so the warehouse packs the gift. Never undoes the spin. */
function webAnnotateOrder_(order, gift) {
  let status;
  try {
    const details = [gift.size && 'Size ' + gift.size, gift.color, gift.sku && 'SKU ' + gift.sku].filter(Boolean).join(' · ');
    const line = '[LUCKY SPIN] Quà tặng kèm: ' + gift.name + (details ? ' · ' + details : '')
      + (gift.packWithOrder ? '' : ' (đơn đã giao, CS gửi riêng)');
    const tagged = shopifyGraphql_('mutation LuckyTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }',
      {id: order.id, tags: ['LUCKY-SPIN', ('QUA-' + gift.sku).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40)]});
    const noted = shopifyGraphql_('mutation LuckyNote($input: OrderInput!) { orderUpdate(input: $input) { userErrors { message } } }',
      {input: {id: order.id, note: order.note ? order.note + '\n' + line : line}});
    const problems = tagged.tagsAdd.userErrors.concat(noted.orderUpdate.userErrors).map(function (e) { return e.message; });
    status = problems.length ? 'LỖI: ' + problems.join('; ') : 'ĐÃ GHI';
  } catch (err) {
    console.error(err && err.stack || err);
    status = 'LỖI: ' + String(err && err.message || err).slice(0, 180);
  }
  locked_(function () {
    const sheet = book_().getSheetByName(WEB_SHEETS_.results), ledger = rows_(sheet, WEB_HEADERS_.results.length);
    const index = ledger.findIndex(function (r) { return r[WR_.orderId] === order.id; });
    if (index >= 0) sheet.getRange(index + 2, WR_.shopify + 1).setValue(status);
    return {ok: true};
  });
}

function shopifyGraphql_(query, variables) {
  const props = PropertiesService.getScriptProperties(), domain = shopifyDomain_(props);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = UrlFetchApp.fetch('https://' + domain + '/admin/api/' + SHOPIFY_API_VERSION_ + '/graphql.json', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: {'X-Shopify-Access-Token': shopifyToken_(props, domain, attempt > 0)},
      payload: JSON.stringify({query: query, variables: variables}),
    });
    const code = response.getResponseCode();
    // A cached client-credentials token can be revoked early: fetch a fresh one once.
    if (code === 401 && attempt === 0 && !props.getProperty('SHOPIFY_ADMIN_ACCESS_TOKEN')) continue;
    if (code !== 200) throw new Error('Shopify HTTP ' + code + ': ' + response.getContentText().slice(0, 200));
    const body = JSON.parse(response.getContentText());
    if (body.errors) throw new Error('Shopify GraphQL: ' + JSON.stringify(body.errors).slice(0, 300));
    return body.data;
  }
  throw new Error('Shopify từ chối token (401). Kiểm tra Client ID/Secret và app đã được cài trên cửa hàng.');
}

/** Static Admin token if set, else the Dev Dashboard client-credentials grant (24h token, cached ≤ 6h). */
function shopifyToken_(props, domain, refresh) {
  const fixed = props.getProperty('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if (fixed) return fixed;
  const id = props.getProperty('SHOPIFY_CLIENT_ID'), secret = props.getProperty('SHOPIFY_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Chưa cấu hình Shopify: thiếu SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET trong Script Properties.');
  const cache = CacheService.getScriptCache();
  if (!refresh) {
    const hit = cache.get('shopify:token');
    if (hit) return hit;
  }
  const response = UrlFetchApp.fetch('https://' + domain + '/admin/oauth/access_token', {
    method: 'post', muteHttpExceptions: true,
    payload: {client_id: id, client_secret: secret, grant_type: 'client_credentials'},
  });
  if (response.getResponseCode() !== 200)
    throw new Error('Shopify token HTTP ' + response.getResponseCode() + ': ' + response.getContentText().slice(0, 200));
  const body = JSON.parse(response.getContentText());
  if (!body.access_token) throw new Error('Shopify không trả access_token.');
  cache.put('shopify:token', body.access_token, Math.max(60, Math.min(21600, Number(body.expires_in || 86399) - 600)));
  return body.access_token;
}

function shopifyDomain_(props) {
  let domain = String(props.getProperty('SHOPIFY_SHOP_DOMAIN') || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domain && domain.indexOf('.') < 0) domain += '.myshopify.com';
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
    throw new Error('SHOPIFY_SHOP_DOMAIN phải có dạng ten-cua-hang.myshopify.com (không phải hussio.com).');
  return domain;
}

// ---------------------------------------------------------------------------
// Small helpers

function webOrderName_(value) {
  const name = String(value || '').trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9-]{1,40}$/.test(name) ? name : '';
}
function webSameContact_(saved, typed) {
  const a = String(saved || '').trim(), b = String(typed || '').trim();
  if (a.indexOf('@') >= 0 || b.indexOf('@') >= 0) return a.toLowerCase() === b.toLowerCase();
  return !!orderPhone_(a) && orderPhone_(a) === orderPhone_(b);
}
function webSize_(value) { return String(value == null ? '' : value).trim().toUpperCase().slice(0, 12); }
function webUnique_(values) { return values.filter(function (v, i) { return values.indexOf(v) === i; }); }
function webMoney_(amount) { return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function webSafeUrl_(value) { const url = String(value || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(url) ? url : ''; }
/** Forces plain text so "0901…" keeps its 0 and "329-11" is not read as a date or formula. */
function webText_(value) { const text = String(value == null ? '' : value); return text ? "'" + text : ''; }
function webInvalid_() { return error_('INVALID_CODE', 'Không tìm thấy đơn phù hợp. Kiểm tra lại mã đơn và SĐT/email đã dùng khi đặt hàng.'); }
function webSizeGone_() { return error_('SIZE_UNAVAILABLE', 'Size bạn chọn vừa hết quà. Vui lòng chọn size khác.'); }
