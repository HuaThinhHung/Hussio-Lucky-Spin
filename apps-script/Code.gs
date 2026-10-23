const SHEET_ID_ = '1qx27OZ71bVo1MrLxd4unpUKKhRGesaCkE_FW5qJKcIE';
const PRIZE_IDS_ = ['socks','hat','belt','v10','v20','v30','v40','v50'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('HUSSIO — Black Friday')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Only these customer operations are exposed. All staff helpers end in underscore
// and therefore cannot be invoked by google.script.run in the public web app.
function customerRequest(action, body) {
  if (!['validate','spin'].includes(action)) return error_('VALIDATION','Thao tác không hợp lệ.');
  const code = String(body && body.code || '').trim().toUpperCase();
  if (!/^HUS-[A-F0-9]{24}$/.test(code)) return error_('INVALID_CODE','Mã quay không hợp lệ.');
  return locked_(function () {
    const sheet = book_().getSheetByName('MA_QUAY');
    const rows = rows_(sheet,13);
    const index = rows.findIndex(r => r[0] === code);
    if (index < 0) return error_('INVALID_CODE','Mã quay không hợp lệ.');
    const row = rows[index];
    if (row[3] === 'CANCELLED') return error_('CANCELLED','Mã đã bị hủy. Liên hệ CS HUSSIO.');
    // Replay before campaign checks: an existing winner can always retrieve a result.
    if (row[9]) {
      const result = JSON.parse(row[9]);
      if (row[10]) { result.rewardStatus = 'FULFILLED'; result.rewardStatusLabel = 'Đã trao quà'; }
      return action === 'validate' ? {ok:true,state:'ALREADY_SPUN',result:result} : {ok:true,repeated:true,result:result};
    }
    if (row[3] !== 'ACTIVE' || row[4] === true || !row[1] || Number(row[2]) < 1300000)
      return error_('PENDING_APPROVAL','Mã chưa được cấp cho đơn hàng đủ điều kiện.');
    if (!row[12] || !Number.isFinite(new Date(row[12]).getTime()) || new Date(row[12]).getTime() <= Date.now())
      return error_('EXPIRED','Mã đã hết hạn.');
    const config = config_();
    if (!open_(config)) return error_('CAMPAIGN_PAUSED','Chương trình chưa mở hoặc đã tạm dừng.');
    const pool = pool_(rows);
    if (!pool.length) return error_('NO_PRIZES','Quỹ quà đã hết. Vui lòng liên hệ HUSSIO.');
    if (action === 'validate') return {ok:true,state:'READY',customerName:'Bạn',spinsAvailable:1,expiresAt:iso_(row[12]),askNameConsent:false};
    let pick = Math.random() * pool.reduce((sum,p) => sum + p.weight,0);
    const prize = pool.find(p => (pick -= p.weight) < 0) || pool[pool.length-1];
    const now = new Date().toISOString();
    const result = {spinId:Utilities.getUuid(),prizeId:prize.id,prizeName:prize.name,
      prizeHeadline:prize.name,prizeType:PRIZE_IDS_.indexOf(prize.id)<3?'PRODUCT_POOL':'VOUCHER',
      segmentIndex:PRIZE_IDS_.indexOf(prize.id),segmentCount:8,spunAt:now,
      rewardStatus:'WON',rewardStatusLabel:'Chờ nhận quà',voucher:null,product:null};
    row[3]='USED'; row[4]=true; row[6]=now; row[7]=prize.id; row[8]=prize.name; row[9]=JSON.stringify(result);
    // One authoritative row write. Stock is derived from this same ledger, never
    // decremented in a second write that could fail independently.
    sheet.getRange(index+2,1,1,13).setValues([row]);
    SpreadsheetApp.flush();
    return {ok:true,repeated:false,result:result};
  });
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('HUSSIO')
    .addItem('Cấp mã cho đơn hàng','issueCode_')
    .addItem('Tra cứu mã / đơn hàng','lookupCode_')
    .addItem('Xác nhận đã trao quà','fulfillCode_')
    .addItem('Hủy mã chưa quay','cancelCode_').addToUi();
}

function issueCode_() {
  const ui=SpreadsheetApp.getUi();
  const order=prompt_('Cấp mã','Nhập mã đơn hàng (duy nhất):'); if (!order) return;
  const amountText=prompt_('Giá trị đơn','Nhập số tiền bằng số, ví dụ 1300000:'); if (!amountText) return;
  const amount=Number(amountText);
  if (!Number.isFinite(amount)||amount<1300000) { ui.alert('Đơn hàng phải từ 1.300.000đ.'); return; }
  const result=locked_(function(){
    const config=config_(); if (!open_(config)) return error_('CAMPAIGN_PAUSED','Hãy cấu hình ngày bắt đầu/kết thúc, quỹ quà và mở chương trình trong CAU_HINH.');
    const sheet=book_().getSheetByName('MA_QUAY'), rows=rows_(sheet,13);
    const existing=rows.find(r=>String(r[1]).toUpperCase()===order.toUpperCase());
    if(existing) return {ok:true,message:'Đơn đã có mã: '+existing[0]+' — '+existing[3]};
    const index=rows.findIndex(r=>r[3]==='PENDING'&&!r[1]&&!r[9]);
    if(index<0) return error_('NO_PRIZES','Đã cấp hết 500 mã.');
    const available=pool_(rows).reduce((sum,p)=>sum+p.remaining,0);
    const reserved=rows.filter(r=>r[3]==='ACTIVE'&&!r[9]&&new Date(r[12]).getTime()>Date.now()).length;
    if(available<=reserved) return error_('NO_PRIZES','Quỹ quà đã được giữ cho các mã đang có hiệu lực. Bổ sung quà trước khi cấp thêm mã.');
    const row=rows[index]; row[1]=safeText_(order); row[2]=amount; row[3]='ACTIVE';
    row[5]=new Date().toISOString(); row[11]=Session.getActiveUser().getEmail(); row[12]=new Date(config.ENDS_AT).toISOString();
    sheet.getRange(index+2,1,1,13).setValues([row]); SpreadsheetApp.flush();
    return {ok:true,message:'Mã gửi khách: '+row[0]};
  }); ui.alert(result.message);
}

function lookupCode_() {
  const value=prompt_('Tra cứu','Nhập mã quay hoặc mã đơn hàng:'); if(!value) return;
  const row=rows_(book_().getSheetByName('MA_QUAY'),13).find(r=>String(r[0]).toUpperCase()===value.toUpperCase()||String(r[1]).toUpperCase()===value.toUpperCase());
  SpreadsheetApp.getUi().alert(row ? 'Mã: '+row[0]+'\nĐơn: '+row[1]+'\nTrạng thái: '+row[3]+'\nQuà: '+(row[8]||'Chưa quay')+'\nĐã trao: '+(row[10]||'Chưa') : 'Không tìm thấy.');
}

function fulfillCode_() {
  const code=prompt_('Trao quà','Sau khi đối chiếu đơn hàng, nhập mã quay cần xác nhận đã trao:'); if(!code) return;
  const ui=SpreadsheetApp.getUi();
  const preview=rows_(book_().getSheetByName('MA_QUAY'),13).find(r=>r[0]===code.toUpperCase());
  if(!preview||!preview[9]) {ui.alert('Mã chưa có kết quả.');return;}
  if(ui.alert('Xác nhận trao '+preview[8], 'Đơn '+preview[1]+' — '+preview[0],ui.ButtonSet.YES_NO)!==ui.Button.YES) return;
  const result=locked_(function(){
    const sheet=book_().getSheetByName('MA_QUAY'),rows=rows_(sheet,13),index=rows.findIndex(r=>r[0]===code.toUpperCase());
    if(index<0||rows[index][3]!=='USED'||!rows[index][9]) return error_('INVALID_CODE','Mã chưa có kết quả hợp lệ.');
    const row=rows[index]; if(row[10]) return error_('USED','Đã trao quà trước đó: '+row[10]);
    row[10]=new Date().toISOString(); row[11]=Session.getActiveUser().getEmail();
    sheet.getRange(index+2,1,1,13).setValues([row]); SpreadsheetApp.flush();
    return {ok:true,message:'Đã xác nhận trao '+row[8]+'.'};
  }); ui.alert(result.message);
}

function cancelCode_() {
  const code=prompt_('Hủy mã chưa quay','Nhập mã của đơn đã hủy/hoàn:'); if(!code)return;
  const result=locked_(function(){
    const sheet=book_().getSheetByName('MA_QUAY'),rows=rows_(sheet,13),index=rows.findIndex(r=>r[0]===code.toUpperCase());
    if(index<0) return error_('INVALID_CODE','Không tìm thấy mã.');
    const row=rows[index]; if(row[9])return error_('USED','Mã đã quay; cần chủ cửa hàng xử lý đối soát. Không hủy tự động.');
    row[3]='CANCELLED'; sheet.getRange(index+2,1,1,13).setValues([row]); SpreadsheetApp.flush();
    return {ok:true,message:'Đã hủy mã.'};
  }); SpreadsheetApp.getUi().alert(result.message);
}

function book_(){return SpreadsheetApp.openById(SHEET_ID_);}
function rows_(sheet,width){return sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues();}
function config_(){return Object.fromEntries(rows_(book_().getSheetByName('CAU_HINH'),3).map(r=>[r[0],r[1]]));}
function open_(c){const start=new Date(c.STARTS_AT).getTime(),end=new Date(c.ENDS_AT).getTime();return c.STATUS==='OPEN'&&Number.isFinite(start)&&Number.isFinite(end)&&Date.now()>=start&&Date.now()<end;}
function pool_(ledger){
  const counts={}; ledger.forEach(r=>{if(r[9]&&r[7])counts[r[7]]=(counts[r[7]]||0)+1;});
  const seen=new Set();
  return rows_(book_().getSheetByName('QUA_TANG'),5).filter(r=>{
    if(seen.has(r[0]))throw new Error('Trùng mã quà'); seen.add(r[0]); return PRIZE_IDS_.includes(r[0]);
  }).map(r=>({id:r[0],name:String(r[1]),limit:Number(r[2]),weight:Number(r[3]),enabled:r[4]===true}))
    .map(p=>({...p,remaining:p.limit-(counts[p.id]||0)}))
    .filter(p=>p.enabled&&Number.isSafeInteger(p.limit)&&p.limit>(counts[p.id]||0)&&Number.isFinite(p.weight)&&p.weight>0);
}
function locked_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return error_('RATE_LIMITED','Hệ thống đang bận. Thử lại sau vài giây.');try{return fn();}finally{lock.releaseLock();}}
function error_(code,message){return {ok:false,error:code,message:message};}
function iso_(value){return new Date(value).toISOString();}
function safeText_(text){return /^[=+@-]/.test(text)?"'"+text:text;}
function prompt_(title,message){const ui=SpreadsheetApp.getUi(),r=ui.prompt(title,message,ui.ButtonSet.OK_CANCEL);return r.getSelectedButton()===ui.Button.OK?r.getResponseText().trim():null;}
