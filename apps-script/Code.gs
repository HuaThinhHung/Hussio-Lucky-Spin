const SHEET_ID_ = '1qx27OZ71bVo1MrLxd4unpUKKhRGesaCkE_FW5qJKcIE';

function doGet() {
  // ALLOWALL lets hussio.com embed the wheel in an iframe (e.g. a Shopify page).
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('HUSSIO — Black Friday')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// The campaign is website-only: customers verify a Shopify order (WebsiteOrders.gs).
// The old lucky-code tabs (MA_QUAY, QUA_TANG) are archived by the setup menu.
// Menu items must name public functions (a trailing "_" hides a function from menus too).
function onOpen() {
  SpreadsheetApp.getUi().createMenu('HUSSIO')
    .addItem('Tra cứu đơn website','menuLookupOrder')
    .addItem('Đánh dấu đã đóng gói quà','menuMarkPacked')
    .addItem('Huỷ quà (đơn huỷ/hoàn)','menuCancelGift')
    .addSeparator()
    .addItem('Nạp size từ file tồn kho','menuImportSizes')
    .addItem('Tạo / cập nhật bảng website','menuSetupWebsite')
    .addSeparator()
    .addItem('Cài đặt kết nối Shopify','menuSetupShopify')
    .addItem('Kiểm tra kết nối Shopify','menuTestShopify').addToUi();
}

function book_(){return SpreadsheetApp.openById(SHEET_ID_);}
function rows_(sheet,width){return sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues();}
function config_(){return Object.fromEntries(rows_(book_().getSheetByName('CAU_HINH'),3).map(r=>[r[0],r[1]]));}
function locked_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return error_('RATE_LIMITED','Hệ thống đang bận. Thử lại sau vài giây.');try{return fn();}finally{lock.releaseLock();}}
function error_(code,message){return {ok:false,error:code,message:message};}
function prompt_(title,message){const ui=SpreadsheetApp.getUi(),r=ui.prompt(title,message,ui.ButtonSet.OK_CANCEL);return r.getSelectedButton()===ui.Button.OK?r.getResponseText().trim():null;}
