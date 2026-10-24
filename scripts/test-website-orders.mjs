// Runs the real Apps Script files against in-memory Sheets, Cache, Properties
// and a fake Shopify Admin API. No network, no real Sheet or Shopify writes.
//   node scripts/test-website-orders.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const FILES = ['Code.gs', 'WebCatalog.gs', 'WebsiteOrders.gs', 'WebsiteAdmin.gs'];
const SHEET_ID = '1qx27OZ71bVo1MrLxd4unpUKKhRGesaCkE_FW5qJKcIE';
const DAY = 864e5;

class FakeSheet {
  constructor(name, rows = []) { this.name = name; this.data = rows.map((r) => [...r]); }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  setFrozenRows() {}
  set(row, col, value) {
    while (this.data.length < row) this.data.push([]);
    const target = this.data[row - 1];
    while (target.length < col) target.push('');
    // Sheets stores "'text" as plain text without the apostrophe.
    target[col - 1] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
  }
  appendRow(values) { const row = this.data.length + 1; values.forEach((v, j) => this.set(row, j + 1, v)); }
  getRange(row, col = 1, rows = 1, cols = 1) {
    const range = {setNumberFormat: () => range};
    if (typeof row === 'string') return range;
    return Object.assign(range, {
      getValues: () => Array.from({length: rows}, (_, i) => Array.from({length: cols}, (_, j) => this.data[row - 1 + i]?.[col - 1 + j] ?? '')),
      getValue: () => this.data[row - 1]?.[col - 1] ?? '',
      setValues: (values) => { values.forEach((r, i) => r.forEach((v, j) => this.set(row + i, col + j, v))); return range; },
      setValue: (value) => { this.set(row, col, value); return range; },
    });
  }
}

function fakeBook(sheets) {
  const map = new Map(sheets.map((s) => [s.name, s]));
  return {
    getName: () => 'book',
    getSheetByName: (name) => map.get(name) ?? null,
    getSheets: () => [...map.values()],
    insertSheet(name) { const s = new FakeSheet(name); map.set(name, s); return s; },
    remove: (name) => map.delete(name),
  };
}

const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

function makeWorld({config = {}, props = {}, limits, variants, orders, fresh = false} = {}) {
  const book = fakeBook([
    new FakeSheet('CAU_HINH', [['Thiết lập', 'Giá trị', 'Hướng dẫn'],
      ...Object.entries({STATUS: 'OPEN', STARTS_AT: iso(-10), ENDS_AT: iso(10), MIN_ORDER: 1300000, ...config}).map(([k, v]) => [k, v, ''])]),
    new FakeSheet('WEB_GIFT_LIMITS', [['ID quà', 'Tên quà', 'Hạn mức', 'Ghi chú', 'Bật'], ...(limits ?? [
      ['gift-77', 'ÁO POLO LUCUS V2', 3, '', true],
      ['gift-102', 'QUẦN DÀI JEAN LƯNG THUN PAGANIC', 1, '', true],
      ['gift-65', 'ÁO KHOÁC CARO TIZI', 5, '', true],
      ['socks', 'Tặng vớ', 1, '', true],
      ['v10', 'Giảm 10.000đ', 0, '', false],
    ])]),
    new FakeSheet('WEB_GIFT_VARIANTS', [['SKU', 'ID quà', 'Nhóm', 'Size', 'Màu', 'SL', 'Bật'], ...(variants ?? [
      ['329-11', 'gift-77', 'top', 'XL', 'TRẮNG', 1, true],
      ['329-12', 'gift-77', 'top', 'XXL', 'TRẮNG', 2, true],
      ['329-4', 'gift-77', 'top', 'XXL', 'ĐEN', 0, true],
      ['P-30', 'gift-102', 'pants', 30, 'XANH', 1, true],
      ['socks', 'socks', 'any', '', '', 1, true],
      ['v10', 'v10', 'any', '', '', 5, true],
    ])]),
  ]);
  if (fresh) ['WEB_GIFT_LIMITS', 'WEB_GIFT_VARIANTS'].forEach(book.remove);
  // The tab exists but is empty until setup writes the header.
  book.insertSheet('WEB_RESULTS');
  const inventory = fakeBook([new FakeSheet('TOTAL', [
    ['Mã', 'Tên', 'Size', 'Màu', 'SL'],
    ['329-11', 'Áo Polo Lucus V2', 'XL', 'TRẮNG', 2],
    ['329-12', 'ÁO POLO LUCUS V2', 'XXL', 'TRẮNG', 5],
    ['329-12', 'ÁO POLO LUCUS V2', 'XXL', 'TRẮNG', 1],
    ['T-1', 'Áo khoác caro TIZI', 'L', 'ĐEN', 4],
  ])]);

  const cache = new Map(), properties = new Map(Object.entries({
    SHOPIFY_SHOP_DOMAIN: 'sbczjd-yj.myshopify.com', SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 'secret', ...props,
  }));
  const shopify = {orders: orders ?? [], calls: [], tokenRequests: 0, failNextGraphql401: false, mutations: []};

  const context = vm.createContext({
    console: {log() {}, warn() {}, error() {}},
    SpreadsheetApp: {
      openById: (id) => (id === SHEET_ID ? book : inventory),
      flush() {},
      getUi() { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); },
    },
    CacheService: {getScriptCache: () => ({get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k)})},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: (k) => properties.get(k) ?? null,
      setProperty: (k, v) => properties.set(k, v),
      setProperties: (o) => Object.entries(o).forEach(([k, v]) => properties.set(k, v)),
      deleteProperty: (k) => properties.delete(k),
    })},
    LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
    Utilities: {getUuid: () => 'spin-' + Math.random().toString(16).slice(2, 8)},
    Session: {getActiveUser: () => ({getEmail: () => 'cs@hussio.com'})},
    ContentService: {createTextOutput: (s) => ({setMimeType: () => ({body: s})}), MimeType: {JSON: 'json'}},
    UrlFetchApp: {fetch(url, options) {
      shopify.calls.push(url);
      const reply = (code, body) => ({getResponseCode: () => code, getContentText: () => JSON.stringify(body)});
      if (url.endsWith('/admin/oauth/access_token')) {
        assert.equal(options.payload.grant_type, 'client_credentials');
        shopify.tokenRequests++;
        return reply(200, {access_token: 'tok-' + shopify.tokenRequests, expires_in: 86399});
      }
      assert.match(url, /^https:\/\/sbczjd-yj\.myshopify\.com\/admin\/api\/2026-10\/graphql\.json$/);
      if (shopify.failNextGraphql401) { shopify.failNextGraphql401 = false; return reply(401, {errors: 'expired'}); }
      const {query, variables} = JSON.parse(options.payload);
      if (query.includes('LuckyOrder')) {
        const name = variables.query.match(/name:"#(.+)"/)[1];
        return reply(200, {data: {orders: {nodes: shopify.orders.filter((o) => o.name === '#' + name)}}});
      }
      if (query.includes('LuckyTag') || query.includes('LuckyNote')) {
        shopify.mutations.push({query, variables});
        return reply(200, {data: query.includes('LuckyTag') ? {tagsAdd: {userErrors: []}} : {orderUpdate: {userErrors: []}}});
      }
      if (query.includes('LuckyCheck')) {
        return reply(200, {data: {shop: {name: 'HUSSIO', myshopifyDomain: 'sbczjd-yj.myshopify.com'},
          currentAppInstallation: {accessScopes: [{handle: 'read_orders'}]}, orders: {nodes: [{name: '#1283', email: null, phone: null, shippingAddress: null}]}}});
      }
      throw new Error('Unexpected Shopify call ' + query.slice(0, 40));
    }},
  });
  for (const file of FILES) vm.runInContext(fs.readFileSync(`apps-script/${file}`, 'utf8'), context, {filename: file});
  // Objects built inside the VM have their own Array/Object prototypes; return plain data to the asserts.
  for (const name of ['customerCatalog', 'customerOrderRequest']) {
    const original = context[name];
    context[name] = (...args) => JSON.parse(JSON.stringify(original(...args)));
  }
  context.setupWebsiteOrders_();
  return {context, book, cache, properties, shopify, ledger: () => book.getSheetByName('WEB_RESULTS').data.slice(1)};
}

const order = (overrides = {}) => ({
  id: 'gid://shopify/Order/1', name: '#1284', email: 'Khach@Example.com', phone: null, note: 'Giao giờ hành chính',
  createdAt: iso(-1), cancelledAt: null, test: false, sourceName: 'web',
  displayFinancialStatus: 'PENDING', displayFulfillmentStatus: 'UNFULFILLED',
  currentSubtotalPriceSet: {shopMoney: {amount: '1347000.0', currencyCode: 'VND'}},
  shippingAddress: {phone: '+84 901 234 567'}, billingAddress: null, ...overrides,
});

let checks = 0;
function check(name, fn) { fn(); checks++; console.log('  ✓ ' + name); }

console.log('Website Lucky Spin (Apps Script) — mocked Sheets + Shopify');

check('setup writes the 14-column header, the weight column and the new settings', () => {
  const {book, context} = makeWorld();
  assert.equal(book.getSheetByName('WEB_RESULTS').data[0].length, 14);
  assert.equal(book.getSheetByName('WEB_GIFT_LIMITS').data[0][5], 'Trọng số');
  assert.ok(['SPIN_UNTIL', 'ALLOW_SHIPPED_ORDERS', 'ZALO_URL'].every((k) => k in context.config_()));
  assert.match(context.setupWebsiteOrders_(), /không cần thay đổi/);
});

check('a brand-new Sheet gets 55 unique gifts (46 garments + 9 accessories/vouchers), all off', () => {
  const {book} = makeWorld({fresh: true});
  const ids = book.getSheetByName('WEB_GIFT_LIMITS').data.slice(1).map((r) => r[0]);
  assert.equal(ids.length, 55);
  assert.equal(new Set(ids).size, 55);
  assert.ok(book.getSheetByName('WEB_GIFT_LIMITS').data.slice(1).every((r) => r[2] === 0 && r[4] === false));
  const any = book.getSheetByName('WEB_GIFT_VARIANTS').data.slice(1).filter((r) => r[2] === 'any').map((r) => r[0]);
  assert.deepEqual(any, ['socks', 'hat', 'belt', 'v10', 'v20', 'v30', 'v40', 'v50', 'box']);
});

check('a duplicate gift row with a blank limit does not hide the real row', () => {
  const {context} = makeWorld({limits: [['socks', 'Tặng vớ', '', '', true], ['socks', 'Tặng vớ', 2, '', true]], variants: [['socks', 'socks', 'any', '', '', 2, true]]});
  assert.equal(context.customerCatalog().gifts[0].available, true);
});

check('catalog lists gifts in Sheet order with in-stock sizes; disabled gifts are hidden', () => {
  const {context} = makeWorld({config: {ZALO_URL: 'https://zalo.me/123'}});
  const catalog = context.customerCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(catalog.open, true);
  assert.equal(catalog.contactUrl, 'https://zalo.me/123');
  assert.deepEqual(catalog.gifts.map((g) => g.id), ['gift-77', 'gift-102', 'gift-65', 'socks']);
  assert.deepEqual(JSON.parse(JSON.stringify(catalog.gifts[0])), {id: 'gift-77', name: 'ÁO POLO LUCUS V2', group: 'top', sizes: ['XL', 'XXL'], available: true});
  assert.deepEqual([...catalog.gifts[1].sizes], ['30']);
  assert.equal(catalog.gifts[1].group, 'pants');
  assert.equal(catalog.gifts[2].available, false, 'a gift with no sizes entered is shown dimmed');
  assert.equal(catalog.gifts[3].group, 'any');
});

check('COD order (payment PENDING) of 1.347.000đ is eligible — the main real-store case', () => {
  const {context} = makeWorld({orders: [order()]});
  const reply = context.customerOrderRequest('validate', {code: '#1284', contact: '0901234567'});
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.state, 'READY');
});

check('phone in any format (+84, 84, spaces) and e-mail in any case all verify', () => {
  const {context} = makeWorld({orders: [order()]});
  for (const contact of ['+84901234567', '84 901 234 567', '0901.234.567', 'khach@example.COM'])
    assert.equal(context.customerOrderRequest('validate', {code: '1284', contact}).ok, true, contact);
});

check('wrong contact → generic error; 5 failures lock the order for 30 minutes', () => {
  const {context} = makeWorld({orders: [order()]});
  for (let i = 0; i < 5; i++) assert.equal(context.customerOrderRequest('validate', {code: '1284', contact: '0909999999'}).error, 'INVALID_CODE');
  assert.equal(context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'}).error, 'LOCKED');
});

check('spin writes ONE row: order, contact as text, gift, size, colour, SKU, packing status', () => {
  const world = makeWorld({orders: [order()]});
  const reply = world.context.customerOrderRequest('spin', {code: '#1284', contact: '0901234567', top: 'xl'});
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.repeated, false);
  const rows = world.ledger();
  assert.equal(rows.length, 1);
  const [, name, contact, amount, giftName, size, color, sku, status, shopifyState, orderId] = rows[0];
  assert.deepEqual([name, contact, amount, status, shopifyState, orderId], ['#1284', '0901234567', 1347000, 'CHO_DONG_GOI', 'CHƯA BẬT', 'gid://shopify/Order/1']);
  assert.ok(['ÁO POLO LUCUS V2', 'Tặng vớ'].includes(giftName), giftName);
  if (giftName === 'ÁO POLO LUCUS V2') assert.deepEqual([size, color, sku], ['XL', 'TRẮNG', '329-11']);
  assert.equal(reply.result.gift.packWithOrder, true);
  assert.equal(reply.result.orderName, '#1284');
  assert.equal(reply.writeOrder, undefined, 'internal flags never reach the browser');
});

check('only gifts matching the chosen sizes (or size-free gifts) can be drawn', () => {
  for (let i = 0; i < 25; i++) {
    const world = makeWorld({orders: [order()]});
    const {result} = world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XXL', pants: '30'});
    assert.ok(['ÁO POLO LUCUS V2', 'QUẦN DÀI JEAN LƯNG THUN PAGANIC', 'Tặng vớ'].includes(result.prizeName));
    if (result.prizeName === 'ÁO POLO LUCUS V2') assert.deepEqual([result.gift.size, result.gift.sku], ['XXL', '329-12']);
    if (result.prizeName.startsWith('QUẦN')) assert.equal(result.gift.size, '30');
  }
});

check('re-opening the page shows the saved result: same contact without Shopify, other contact via Shopify', () => {
  const world = makeWorld({orders: [order()]});
  const first = world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'});
  const callsBefore = world.shopify.calls.length;
  const again = world.context.customerOrderRequest('validate', {code: '#1284', contact: '+84901234567'});
  assert.equal(again.state, 'ALREADY_SPUN');
  assert.equal(world.shopify.calls.length, callsBefore, 'ledger replay needs no Shopify call');
  const byEmail = world.context.customerOrderRequest('spin', {code: '1284', contact: 'khach@example.com', top: 'M'});
  assert.equal(byEmail.repeated, true);
  assert.equal(byEmail.result.spinId, first.result.spinId);
  assert.equal(world.ledger().length, 1, 'never a second row for the same order');
});

check('stock runs out per size: later customers see SIZE_UNAVAILABLE, catalog drops the size', () => {
  const world = makeWorld({
    limits: [['gift-77', 'ÁO POLO LUCUS V2', 5, '', true]],
    variants: [['329-11', 'gift-77', 'top', 'XL', 'TRẮNG', 1, true], ['329-12', 'gift-77', 'top', 'XXL', 'TRẮNG', 2, true]],
    orders: [order(), order({id: 'gid://shopify/Order/2', name: '#1285'})],
  });
  assert.deepEqual([...world.context.customerCatalog().gifts[0].sizes], ['XL', 'XXL']);
  assert.equal(world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'}).result.gift.size, 'XL');
  assert.deepEqual([...world.context.customerCatalog().gifts[0].sizes], ['XXL'], 'catalog cache is refreshed after a spin');
  assert.equal(world.context.customerOrderRequest('validate', {code: '1285', contact: '0901234567', top: 'XL'}).error, 'SIZE_UNAVAILABLE');
  assert.equal(world.context.customerOrderRequest('validate', {code: '1285', contact: '0901234567'}).state, 'READY', 'no size yet: still eligible');
  assert.equal(world.context.customerOrderRequest('spin', {code: '1285', contact: '0901234567', top: 'XXL'}).ok, true);
});

check('gift limit (Hạn mức) caps a gift even when variants still have stock; HUY returns stock', () => {
  const world = makeWorld({
    limits: [['gift-77', 'ÁO POLO LUCUS V2', 1, '', true]],
    variants: [['329-12', 'gift-77', 'top', 'XXL', 'TRẮNG', 9, true]],
    orders: [order(), order({id: 'gid://shopify/Order/2', name: '#1285'})],
  });
  assert.equal(world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XXL'}).ok, true);
  assert.equal(world.context.customerOrderRequest('spin', {code: '1285', contact: '0901234567', top: 'XXL'}).error, 'NO_PRIZES');
  world.book.getSheetByName('WEB_RESULTS').data[1][8] = 'HUY';
  world.cache.delete('web:catalog');
  assert.equal(world.context.customerCatalog().gifts[0].available, true);
  assert.equal(world.context.customerOrderRequest('spin', {code: '1285', contact: '0901234567', top: 'XXL'}).ok, true);
  assert.equal(world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XXL'}).repeated, true, 'a cancelled gift does not give the order a new spin');
});

check('ineligible orders: cancelled, voided, < 1.3M, not website, test, placed before the campaign', () => {
  const cases = [
    [{cancelledAt: iso(0)}, 'CANCELLED'],
    [{displayFinancialStatus: 'VOIDED'}, 'CANCELLED'],
    [{displayFinancialStatus: 'REFUNDED'}, 'CANCELLED'],
    [{currentSubtotalPriceSet: {shopMoney: {amount: '1299000.0', currencyCode: 'VND'}}}, 'INVALID_CODE'],
    [{sourceName: 'pos'}, 'INVALID_CODE'],
    [{test: true}, 'INVALID_CODE'],
    [{createdAt: iso(-20)}, 'INVALID_CODE'],
  ];
  for (const [overrides, error] of cases) {
    const {context} = makeWorld({orders: [order(overrides)]});
    const reply = context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'});
    assert.equal(reply.error, error, JSON.stringify(overrides));
  }
  const {context} = makeWorld({orders: [order({displayFinancialStatus: 'PAID'})]});
  assert.equal(context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'}).ok, true, 'prepaid orders work too');
});

check('already-shipped order: gift marked GUI_RIENG by default, blocked when ALLOW_SHIPPED_ORDERS = FALSE', () => {
  const world = makeWorld({orders: [order({displayFulfillmentStatus: 'FULFILLED'})]});
  const reply = world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'});
  assert.equal(reply.result.gift.packWithOrder, false);
  assert.equal(world.ledger()[0][8], 'GUI_RIENG');
  const strict = makeWorld({config: {ALLOW_SHIPPED_ORDERS: 'FALSE'}, orders: [order({displayFulfillmentStatus: 'FULFILLED'})]});
  assert.equal(strict.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'}).error, 'ORDER_SHIPPED');
});

check('campaign window: paused/not started/ended block new spins but saved results stay viewable', () => {
  assert.equal(makeWorld({config: {STATUS: 'PAUSED'}, orders: [order()]}).context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'}).error, 'CAMPAIGN_PAUSED');
  assert.equal(makeWorld({config: {STARTS_AT: iso(1)}, orders: [order()]}).context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'}).error, 'CAMPAIGN_NOT_STARTED');
  const world = makeWorld({config: {STARTS_AT: iso(-10), ENDS_AT: iso(-0.5)}, orders: [order()]});
  assert.equal(world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'}).ok, true, 'within the 3-day grace period after ENDS_AT');
  world.book.getSheetByName('CAU_HINH').data.push(['SPIN_UNTIL', iso(-0.1), '']);
  assert.equal(world.context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'}).state, 'ALREADY_SPUN');
  world.shopify.orders.push(order({id: 'gid://shopify/Order/9', name: '#1290'}));
  assert.equal(world.context.customerOrderRequest('validate', {code: '1290', contact: '0901234567'}).error, 'CAMPAIGN_ENDED');
  assert.equal(makeWorld({config: {ENDS_AT: ''}}).context.customerCatalog().open, false);
});

check('Shopify token: client credentials once, cached, refreshed once after a 401', () => {
  const world = makeWorld({orders: [order(), order({id: 'gid://shopify/Order/2', name: '#1285'})]});
  world.context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'});
  world.context.customerOrderRequest('validate', {code: '1285', contact: '0901234567'});
  assert.equal(world.shopify.tokenRequests, 1);
  world.shopify.failNextGraphql401 = true;
  assert.equal(world.context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'}).ok, true);
  assert.equal(world.shopify.tokenRequests, 2);
  const fixed = makeWorld({props: {SHOPIFY_ADMIN_ACCESS_TOKEN: 'shpat_x'}, orders: [order()]});
  fixed.context.customerOrderRequest('validate', {code: '1284', contact: '0901234567'});
  assert.equal(fixed.shopify.tokenRequests, 0, 'a static token skips the grant');
});

check('SHOPIFY_WRITE_ORDER=true: tag + appended note on the order, sheet shows ĐÃ GHI', () => {
  const world = makeWorld({props: {SHOPIFY_WRITE_ORDER: 'true'}, orders: [order()],
    limits: [['gift-77', 'ÁO POLO LUCUS V2', 3, '', true]], variants: [['329-11', 'gift-77', 'top', 'XL', 'TRẮNG', 1, true]]});
  world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'});
  const [tag, note] = world.shopify.mutations;
  assert.deepEqual(tag.variables.tags, ['LUCKY-SPIN', 'QUA-329-11']);
  assert.equal(note.variables.input.note, 'Giao giờ hành chính\n[LUCKY SPIN] Quà tặng kèm: ÁO POLO LUCUS V2 · Size XL · TRẮNG · SKU 329-11');
  assert.equal(world.ledger()[0][9], 'ĐÃ GHI');
});

check('Shopify outage → friendly SERVER_ERROR, nothing written', () => {
  const world = makeWorld({orders: [order()]});
  world.context.websiteOrder_ = () => { throw new Error('Shopify HTTP 503'); };
  const reply = world.context.customerOrderRequest('spin', {code: '1284', contact: '0901234567', top: 'XL'});
  assert.equal(reply.error, 'SERVER_ERROR');
  assert.equal(world.ledger().length, 0);
});

check('input guards: bad action, bad order number, long contact', () => {
  const {context} = makeWorld({orders: [order()]});
  assert.equal(context.customerOrderRequest('confirm', {}).error, 'VALIDATION');
  assert.equal(context.customerOrderRequest('validate', {code: '12 84; drop', contact: '0901234567'}).error, 'INVALID_CODE');
  assert.equal(context.customerOrderRequest('validate', {code: '1284', contact: 'x'.repeat(161)}).error, 'INVALID_CODE');
});

check('doPost JSON API routes catalog / validate / spin', () => {
  const {context} = makeWorld({orders: [order()]});
  const post = (body) => JSON.parse(context.doPost({postData: {contents: JSON.stringify(body)}}).body);
  assert.equal(post({action: 'catalog'}).ok, true);
  assert.equal(post({action: 'validate', code: '1284', contact: '0901234567'}).state, 'READY');
  assert.equal(post({action: 'nope'}).error, 'VALIDATION');
  assert.equal(JSON.parse(context.doPost({postData: {contents: 'not json'}}).body).error, 'VALIDATION');
});

check('weights: weight 0 removes a gift, blank weight counts as 1', () => {
  const world = makeWorld({
    limits: [['a', 'A', 9, '', true, 0], ['b', 'B', 9, '', true, '']],
    variants: [['a', 'a', 'any', '', '', 9, true], ['b', 'b', 'any', '', '', 9, true]],
  });
  assert.deepEqual(world.context.customerCatalog().gifts.map((g) => g.id), ['b']);
});

check('size import matches names without accents/"ÁO", keeps the larger duplicate count, rows stay off', () => {
  const world = makeWorld({variants: [['socks', 'socks', 'any', '', '', 1, true]]});
  const alerts = [];
  world.context.webImportSizes_({alert: (...a) => alerts.push(a), ButtonSet: {OK: 'OK'}});
  const rows = world.book.getSheetByName('WEB_GIFT_VARIANTS').data.slice(2);
  assert.deepEqual(rows.map((r) => r.slice(0, 7)), [
    ['329-11', 'gift-77', 'top', 'XL', 'TRẮNG', 2, false],
    ['329-12', 'gift-77', 'top', 'XXL', 'TRẮNG', 5, false],
    ['T-1', 'gift-65', 'top', 'L', 'ĐEN', 4, false],
  ]);
  assert.match(alerts[0][1], /QUẦN DÀI JEAN LƯNG THUN PAGANIC/);
  assert.equal(world.context.webNameKey_('Sơ mi Logo'), world.context.webNameKey_('ÁO SƠ MI LOGO'));
});

check('staff menu functions refuse to run outside the Sheet UI (public web app)', () => {
  const {context} = makeWorld();
  assert.throws(() => context.menuCancelGift(), /getUi/);
});

console.log(`${checks} checks passed. Mocked services only — no live Shopify or Sheets writes.`);
