// kt_bot.js  (v2 FULL)  -  KT BOT
// relay theke signal -> market switch -> UP/DOWN click -> result track -> martingale
// Quotex page e F12 Console e paste kore Enter dao. Paste korlei nijei chalu hoy. Abar paste korle bondho hoy.
(function(){
if(window._ktClean){try{window._ktClean();}catch(e){}window._ktClean=null;return;}
// purono bot gulo thakle soriye dei (noile duita ekshathe trade korbe)
try{clearInterval(window._ktPoll);clearInterval(window._ktPoll2);clearInterval(window._ktResultTimer);clearTimeout(window._ktSnapTimer);clearTimeout(window._ktExpiryTimer);}catch(e){}
["_ktBotBox","_ktBox2","_ktBotScanner","_ktBotStyle","_ktBuyBtn","_ktSellBtn"].forEach(function(k){try{if(window[k])window[k].remove();}catch(e){}window[k]=null;});

// ───────────── CONFIG ─────────────
var RELAY_URL="http://127.0.0.1:8765";
var POLL_MS=500;                 // relay ke proti 0.5s e jiggesh kore
var MAX_SIGNAL_AGE=20000;        // 20s er purono signal e trade hobe na
var DEFAULT_OTC=true;            // EA "otc" na pathale OTC dhore (panel er OTC button diye bodlano jay)
try{var so=localStorage.getItem("_ktOtc");if(so!==null)DEFAULT_OTC=(so==="1");}catch(e){}
var STRICT_OTC=true;             // true = OTC chaile shudhu OTC market e-i trade (real e jabe na)
var SYMBOL_MAP={"XAUUSD":"Gold","GOLD":"Gold"};
var SEL_UP="#trade-button-up", SEL_DOWN="#trade-button-down";
var MAX_TRADES_PER_SIGNAL=5;     // EA jototai bolu, ekbare max eto click (safety)
var PROFIT_TARGET=0;             // net profit eto hole bot bondho (0 = off)
var TRADE_AMT=1;                 // balance pora na gele fallback stake
var VOICE=true;
var SNAP_DELAY=1000, RESULT_POLL_MS=500, RESULT_POLL_MAX=8, CLICK_GAP=200;

var MARKETS=["AUD/CAD (OTC)","EUR/USD (OTC)","GBP/USD (OTC)","USD/JPY (OTC)","USD/BDT (OTC)",
"AUD/CAD","EUR/USD","GBP/USD","USD/JPY","BTC/USD","Gold (OTC)",
"USD/BRL (OTC)","USD/TRY (OTC)","USD/MXN (OTC)","USD/CLP (OTC)","USD/RUB (OTC)","USD/ARS (OTC)",
"USD/ZAR (OTC)","USD/IDR (OTC)","USD/CNY (OTC)","USD/KRW (OTC)","USD/HKD (OTC)","USD/PHP (OTC)",
"USD/THB (OTC)","USD/VND (OTC)","USD/EUR (OTC)","USD/GBP (OTC)","USD/AUD (OTC)","USD/CAD (OTC)",
"USD/CHF (OTC)","USD/NZD (OTC)","USD/HUF (OTC)","USD/CZK (OTC)","USD/PLN (OTC)","USD/ILS (OTC)",
"USD/MYR (OTC)","USD/SGD (OTC)","USD/INR (OTC)","USD/RON (OTC)"];
var curMarket=MARKETS[0];
try{var sv=localStorage.getItem("_ktMarket");if(sv&&MARKETS.indexOf(sv)>-1)curMarket=sv;}catch(e){}

// ───────────── PANEL ─────────────
var st=document.createElement("style");
st.textContent="@keyframes ktPulse{0%,100%{box-shadow:0 0 14px rgba(0,200,100,.6)}50%{box-shadow:0 0 28px rgba(0,200,100,1)}}";
document.head.appendChild(st);
var box=document.createElement("div");box.id="_ktBox";
box.style.cssText="position:fixed;top:130px;right:18px;z-index:2147483647;background:#0d0d0d;border:2px solid #00dc64;border-radius:16px;padding:12px 10px 10px;width:190px;text-align:center;font-family:Arial,sans-serif;cursor:move;user-select:none;animation:ktPulse 2s infinite;";
function mk(css,txt){var d=document.createElement("div");d.style.cssText=css||"";if(txt!==undefined)d.textContent=txt;box.appendChild(d);return d;}
function mkBtn(txt,css,title){var b=document.createElement("button");b.textContent=txt;b.style.cssText=css;if(title)b.title=title;return b;}
var closeBtn=mkBtn("✕","position:absolute;top:4px;right:8px;background:none;border:none;color:#555;font-size:13px;cursor:pointer;");
box.appendChild(closeBtn);
mk("color:#00dc64;font-size:11px;font-weight:bold;letter-spacing:1px;","KT BOT ⚡ v2");
var liveBadge=mk("background:#001a0a;border:1px solid #00dc64;border-radius:20px;padding:2px 10px;font-size:10px;color:#555;margin:5px 0;letter-spacing:1px;","● CONNECTING");
var sig=mk("background:#1a1a1a;border-radius:12px;padding:9px 6px;margin-bottom:4px;font-size:24px;font-weight:bold;color:#aaa;border:1.5px solid #333;","WAIT");
var confTxt=mk("font-size:9px;color:#6a8;margin-bottom:3px;min-height:14px;","relay signal wait...");
var statusDiv=mk("font-size:10px;font-weight:bold;color:#ffaa00;margin-bottom:3px;min-height:15px;background:#1a1200;border-radius:6px;padding:2px 6px;","");
var expDiv=mk("font-size:11px;color:#888;margin-bottom:3px;min-height:15px;","");
var balDiv=mk("font-size:9px;color:#4488ff;margin-bottom:4px;background:#0a0a1a;border-radius:6px;padding:2px 6px;","Balance: --");
var dbgDiv=mk("font-size:8px;color:#555;margin-bottom:3px;min-height:11px;","");
var mktRow=mk("display:flex;gap:4px;margin-bottom:5px;");
var mktSel=document.createElement("select");
mktSel.style.cssText="flex:1;min-width:0;background:#111;color:#00dc64;border:1px solid #224;border-radius:6px;font-size:10px;padding:3px 2px;";
MARKETS.forEach(function(m){var o=document.createElement("option");o.value=m;o.textContent=m;if(m===curMarket)o.selected=true;mktSel.appendChild(o);});
var mktGo=mkBtn("⇄","padding:3px 7px;background:#0a1a2a;color:#4488ff;border:1px solid #224;border-radius:6px;font-size:12px;cursor:pointer;","Market switch now");
var otcBtn=mkBtn("","padding:3px 6px;background:#0a1a2a;border:1px solid #224;border-radius:6px;font-size:9px;cursor:pointer;","EA otc na bolle OTC market e trade korbe kina");
function otcLabel(){otcBtn.textContent="OTC:"+(DEFAULT_OTC?"ON":"OFF");otcBtn.style.color=DEFAULT_OTC?"#00dc64":"#ff8844";}
otcLabel();
mktRow.appendChild(mktSel);mktRow.appendChild(mktGo);mktRow.appendChild(otcBtn);
var nxt=mk("font-size:10px;color:#777;margin-bottom:4px;","Signal: --");
var pbar=mk("height:3px;background:#1a1a1a;border-radius:3px;margin-bottom:6px;overflow:hidden;");
var pfill=document.createElement("div");pfill.style.cssText="height:100%;width:0%;background:#00dc64;border-radius:3px;transition:width .5s linear;";pbar.appendChild(pfill);
var autoTxt=mk("font-size:10px;font-weight:bold;color:#00aa44;margin-bottom:3px;min-height:14px;","");
var plTxt=mk("font-size:11px;font-weight:bold;color:#00aa44;margin-bottom:4px;","P/L: $0.00");
var stats=mk("display:flex;justify-content:space-between;margin-bottom:6px;");
function statBox(label){var s=document.createElement("div");s.style.cssText="background:#111;border-radius:6px;padding:4px 0;width:30%;text-align:center;";var n=document.createElement("div");n.style.cssText="font-size:13px;font-weight:bold;color:#fff;";n.textContent="0";var l=document.createElement("div");l.style.cssText="font-size:8px;color:#555;";l.textContent=label;s.appendChild(n);s.appendChild(l);stats.appendChild(s);return n;}
var winN=statBox("WIN"),lossN=statBox("LOSS"),totN=statBox("TOT");
var mtgDiv=mk("font-size:9px;color:#6a8;margin-bottom:6px;background:#0a1a0a;border-radius:6px;padding:4px 6px;","MTG ekhane na - EA bole kotota trade");
var btnRow=mk("display:flex;gap:4px;");
var btn=mkBtn("STOP","flex:1;padding:7px 0;background:#cc0000;color:#fff;font-weight:bold;font-size:12px;border:none;border-radius:8px;cursor:pointer;");
var resetBtn=mkBtn("↺","padding:7px 8px;background:#1a1a1a;color:#666;font-size:14px;border:1px solid #333;border-radius:8px;cursor:pointer;","Reset stats");
var scanBtn=mkBtn("🔍","padding:7px 7px;background:#0a1a2a;color:#4488ff;font-size:12px;border:1px solid #224;border-radius:8px;cursor:pointer;","Button + balance check");
[btn,resetBtn,scanBtn].forEach(function(b){btnRow.appendChild(b);});
document.body.appendChild(box);

// drag
(function(){var drag=false,ox=0,oy=0;
box.addEventListener("mousedown",function(e){if(/BUTTON|SELECT|INPUT|OPTION/.test(e.target.tagName))return;drag=true;ox=e.clientX-box.offsetLeft;oy=e.clientY-box.offsetTop;e.preventDefault();});
document.addEventListener("mouseup",function(){drag=false;});
document.addEventListener("mousemove",function(e){if(!drag)return;box.style.left=(e.clientX-ox)+"px";box.style.top=(e.clientY-oy)+"px";box.style.right="auto";});})();

// ───────────── STATE ─────────────
var running=true,lastId=0,firstPoll=true,pollBusy=false,tradeBusy=false,waitingResult=false;
var quietUntil=0;                       // auto-check trade er result na asha porjonto real signal niba na
var resultPhase=false;                  // trade expiry hoye gechhe, result ber hocche
var upC=0,dnC=0,totC=0,netPL=0,pollTimer=null,watchTimer=null,resTimer=null;

function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function speak(t){if(!VOICE)return;try{window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(t);u.lang="en-US";u.rate=1.1;window.speechSynthesis.speak(u);}catch(e){}}
function setStatus(t,c){statusDiv.textContent=t;statusDiv.style.color=c||"#ffaa00";}
function setBadge(ok){
  if(!running){liveBadge.textContent="● STOPPED";liveBadge.style.color="#888";return;}
  liveBadge.textContent=ok?"● KT BOT OK":"● RELAY OFF";liveBadge.style.color=ok?"#00dc64":"#ff4444";
}
function updatePL(){plTxt.textContent="P/L: "+(netPL<0?"-":"")+"$"+Math.abs(netPL).toFixed(2);plTxt.style.color=netPL>=0?"#00aa44":"#ff4444";}

// ───────────── BALANCE + BUTTONS ─────────────
function getBalance(){
  var el=document.querySelector(".pVBHU");
  if(el){var v=parseFloat(el.textContent.replace(/[^0-9.]/g,""));if(!isNaN(v)&&v>0)return v;}
  var sels=[".balance-value","[class*='balance__value']","[class*='balance-amount']",".account-balance",".js-balance-demo","[class*='js-balance']"];
  for(var i=0;i<sels.length;i++){var e2=document.querySelector(sels[i]);if(e2){var v2=parseFloat(e2.textContent.replace(/[^0-9.]/g,""));if(!isNaN(v2)&&v2>0)return v2;}}
  var all=document.querySelectorAll("div,span");
  for(var j=0;j<all.length;j++){var t=all[j].textContent.trim();if(all[j].children.length===0&&/^\$?\s?[\d,]+\.\d{2}$/.test(t)&&!box.contains(all[j])){var v3=parseFloat(t.replace(/[^0-9.]/g,""));if(!isNaN(v3)&&v3>0)return v3;}}
  return null;
}
function getBtn(up){
  var el=document.querySelector(up?SEL_UP:SEL_DOWN);if(el)return el;
  var sels=up?["button.call-btn","button.btn-call","[class*='call'][class*='btn']","button[data-type='call']",".deals-btn--call","[class*='btn-up']","button.up",".button-call"]
             :["button.put-btn","button.btn-put","[class*='put'][class*='btn']","button[data-type='put']",".deals-btn--put","[class*='btn-down']","button.down",".button-put"];
  for(var i=0;i<sels.length;i++){var e=document.querySelector(sels[i]);if(e&&!box.contains(e))return e;}
  var names=up?["up","call","higher","buy"]:["down","put","lower","sell"];
  var bs=document.querySelectorAll("button");
  for(var j=0;j<bs.length;j++){if(box.contains(bs[j]))continue;var tx=(bs[j].textContent||"").toLowerCase().trim();if(names.indexOf(tx)>-1)return bs[j];}
  return null;
}

// ───────────── MARKET SWITCH ─────────────
function normM(t){return (t||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace("OTC","");}
function isOtc(t){return /OTC/i.test(t||"");}
// "AUD/CAD (OTC) 92%" -> "AUDCAD",  "Gold (OTC)" -> "GOLD"  (payout % thakleo mile jabe)
function pairKey(t){
  t=(t||"").replace(/\s+/g," ").trim();
  var m=t.match(/[A-Za-z]{3,6}\s?\/\s?[A-Za-z]{3,6}/);
  if(m)return m[0].toUpperCase().replace(/[^A-Z]/g,"");
  m=t.match(/^[A-Za-z][A-Za-z ]{1,20}?(?=\s*\(|\s*\d|$)/);
  return m?m[0].toUpperCase().replace(/[^A-Z]/g,""):normM(t);
}
function visible(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
function realClick(el){["pointerdown","mousedown","pointerup","mouseup","click"].forEach(function(ev){el.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true,view:window}));});}
function waitFor(fn,timeout,step){
  return new Promise(function(resolve){
    var t0=Date.now();
    (function tick(){var v=null;try{v=fn();}catch(e){}if(v){resolve(v);return;}if(Date.now()-t0>=timeout){resolve(null);return;}setTimeout(tick,step||150);})();
  });
}
// ekhon kon asset select ache (chart er upore). Shobcheye bhitorer (choto) element ta nei.
function findAssetHeader(){
  var re=/[A-Z]{3,6}\s?\/\s?[A-Z]{3,6}|OTC/i;
  var els=document.querySelectorAll("div,span,button"),best=null,bTop=1e9,bLen=1e9;
  for(var i=0;i<els.length;i++){
    var el=els[i];
    if(box.contains(el)||el.children.length>3)continue;
    var t=(el.textContent||"").trim();
    if(t.length<4||t.length>30||!re.test(t)||!visible(el))continue;
    var top=el.getBoundingClientRect().top;
    if(top>=160)continue;
    if(top<bTop-2||(Math.abs(top-bTop)<=2&&t.length<bLen)){best=el;bTop=top;bLen=t.length;}
  }
  return best;
}
async function switchMarket(name){
  var want=pairKey(name),wantOtc=isOtc(name);
  setStatus("Switching: "+name);
  var hdr=findAssetHeader();
  if(!hdr){setStatus("❌ Asset menu not found","#ff4444");dbgDiv.textContent="Chart er upore pair er nam e ekbar click korun";return false;}
  dbgDiv.textContent="Header: "+(hdr.textContent||"").trim().slice(0,22);
  if(pairKey(hdr.textContent)===want&&isOtc(hdr.textContent)===wantOtc){setStatus("✓ Already "+name,"#00ff66");return true;}
  var before=[].slice.call(document.querySelectorAll("input"));
  realClick(hdr.closest("button")||hdr);
  function findPick(){
    var els=document.querySelectorAll("div,li,span,button,a,p"),best=null,bLen=1e9;
    for(var k=0;k<els.length;k++){
      var it=els[k];
      if(box.contains(it)||it===hdr||it.contains(hdr)||!visible(it))continue;
      var tx=(it.textContent||"").trim();
      if(tx.length<4||tx.length>70||pairKey(tx)!==want)continue;
      if(STRICT_OTC&&isOtc(tx)!==wantOtc)continue;
      if(tx.length<bLen){best=it;bLen=tx.length;}
    }
    return best;
  }
  var pick=await waitFor(findPick,1500);               // list shorashori dekha gele
  var inp=null;
  if(!pick){
    inp=await waitFor(function(){var all=document.querySelectorAll("input");for(var i=0;i<all.length;i++)if(before.indexOf(all[i])===-1&&visible(all[i])&&!box.contains(all[i]))return all[i];return null;},1200);
    if(inp){
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;
      setter.call(inp,name.replace(/\s*\(OTC\)/i,""));
      inp.dispatchEvent(new Event("input",{bubbles:true}));
      pick=await waitFor(findPick,2500);
    }
  }
  if(!pick){
    var seen=[],e2=document.querySelectorAll("div,li,span");
    for(var q=0;q<e2.length&&seen.length<4;q++){var t2=(e2[q].textContent||"").trim();if(!box.contains(e2[q])&&visible(e2[q])&&e2[q].children.length===0&&/[A-Z]{3}/.test(t2)&&t2.length<24)seen.push(t2);}
    document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    setStatus("❌ "+name+" not found","#ff4444");
    dbgDiv.textContent="List: "+(seen.join(" | ")||"khali")+(inp?" [search ok]":" [no search]");
    return false;
  }
  realClick(pick.closest("li,[role=button],button")||pick);
  var ok=await waitFor(function(){var h=(hdr.isConnected&&visible(hdr))?hdr:findAssetHeader();return h&&pairKey(h.textContent)===want&&isOtc(h.textContent)===wantOtc;},3000);
  setStatus(ok?"✓ Market: "+name:"⚠ Market badlayni: "+name,ok?"#00ff66":"#ff4444");
  return !!ok;
}

// ───────────── SIGNAL -> MARKET NAME ─────────────
function mapSymbol(sym,otc){
  var u=(sym||"").toUpperCase().replace(/[^A-Z]/g,"");
  var base=SYMBOL_MAP[u]||SYMBOL_MAP[u.slice(0,6)]||null;
  if(!base){if(u.length<6)return null;u=u.slice(0,6);base=u.slice(0,3)+"/"+u.slice(3);}   // EURUSDm -> EUR/USD
  var useOtc=(otc===undefined||otc===null)?DEFAULT_OTC:!!otc;                              // EA ja bole seta-i
  return useOtc?base+" (OTC)":base;
}
function tfSecs(tf){var m=String(tf||"1m").match(/^(\d+)\s*(s|m|h|d)/i);if(!m)return 60;var n=+m[1],u=m[2].toLowerCase();return n*(u==="s"?1:u==="m"?60:u==="h"?3600:86400);}

// ───────────── RELAY ─────────────
function ack(id,status,msg,x){
  var p={id:id,status:status,msg:msg};if(x)for(var k in x)p[k]=x[k];
  try{fetch(RELAY_URL+"/ack",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(p)}).catch(function(){});}catch(e){}
}
async function poll(){
  if(pollBusy||!running)return;
  pollBusy=true;
  var ctl=new AbortController(),to=setTimeout(function(){ctl.abort();},3000);
  try{
    var url=RELAY_URL+"/next?bot=1&after="+(firstPoll?"9007199254740991":lastId);   // prothom bar purono signal ignore
    var r=await fetch(url,{cache:"no-store",signal:ctl.signal});
    var d=await r.json();
    var got=Date.now();
    setBadge(true);
    if(firstPoll){lastId=d.last_id||0;firstPoll=false;return;}
    if(d.signals&&d.signals.length){
      lastId=d.last_id;
      var fresh=[];
      d.signals.forEach(function(s){s._got=got;if(s.age_ms<=MAX_SIGNAL_AGE)fresh.push(s);else ack(s.id,"SKIP",s.symbol+" signal purono, skip");});
      if(!fresh.length){nxt.textContent="Signal: purono (skip)";return;}
      fresh.sort(function(a,b){return (b.test?1:0)-(a.test?1:0)||(b.score||0)-(a.score||0);});
      for(var i=1;i<fresh.length;i++)ack(fresh[i].id,"SKIP",fresh[i].symbol+" - onno signal er score beshi");
      handleSignal(fresh[0]).catch(function(e){tradeBusy=false;ack(fresh[0].id,"FAIL","Error: "+(e&&e.message));});
    }
  }catch(e){
    setBadge(false);          // lastId rakhi: relay restart holeo id boro hoy, tai signal haray na
  }finally{clearTimeout(to);pollBusy=false;}
}

// ───────────── TRADE ─────────────
async function clickMany(isUp,times){
  for(var i=0;i<times;i++){
    var b=getBtn(isUp);
    if(!b)return i;
    b.click();
    dbgDiv.textContent="✓ "+(isUp?"UP":"DOWN")+" #"+(i+1)+"/"+times;
    if(i<times-1)await sleep(CLICK_GAP);
  }
  return times;
}
// click er por balance kome kina dekhe (trade shotti hoyeche kina)
async function verifyPlaced(pre){
  if(pre===null)return {placed:null,snap:null};
  await sleep(SNAP_DELAY);
  var b=await waitFor(function(){var x=getBalance();return (x!==null&&x<pre-0.005)?x:null;},3000,250);
  if(b===null)return {placed:false,snap:null};
  await sleep(600);                                     // sob click er stake kata sesh hok
  var s=getBalance();
  return {placed:true,snap:(s!==null?s:b)};
}

async function handleSignal(sg){
  var isTest=!!sg.test,isUp=(sg.dir==="BUY"),tag=(isTest?"[AUTO CHECK] ":"")+sg.symbol+" "+sg.dir;
  if(tradeBusy){ack(sg.id,"SKIP",tag+" - onno signal process hocche");return;}
  if(!isTest&&Date.now()<quietUntil){ack(sg.id,"SKIP",tag+" - auto-check trade er result wait");return;}
  var market=mapSymbol(sg.symbol,sg.otc);
  if(!market){ack(sg.id,"FAIL","Unknown symbol "+sg.symbol);return;}
  tradeBusy=true;
  try{
    if(waitingResult&&resultPhase){var w0=Date.now();while(waitingResult&&Date.now()-w0<8000)await sleep(200);}   // ager trade er result ber hoye jak (MTG er age)
    if(waitingResult){ack(sg.id,"SKIP",tag+" - ekta trade cholche (expiry hoyni), skip");nxt.textContent="Skip "+sg.symbol+" (trade cholche)";return;}
    nxt.textContent=(isTest?"CHECK: ":"EA: ")+sg.symbol+" "+(isUp?"BUY":"SELL")+(sg.score?" ("+sg.score+"/12)":"");
    sig.textContent=isUp?"▲ UP":"▼ DOWN";sig.style.color=isUp?"#00ff66":"#ff3333";
    sig.style.background=isUp?"#001a0a":"#1a0000";sig.style.borderColor=isUp?"#00ff66":"#ff3333";
    curMarket=market;
    var has=false;for(var i=0;i<mktSel.options.length;i++)if(mktSel.options[i].value===market)has=true;
    if(!has){var o=document.createElement("option");o.value=market;o.textContent=market;mktSel.appendChild(o);}
    mktSel.value=market;
    var ok=await switchMarket(market);
    if(!ok){await sleep(500);ok=await switchMarket(market);}        // ekbar retry
    if(!ok){ack(sg.id,"FAIL","Market switch fail: "+market+" (trade hoyni)");return;}
    var age=sg.age_ms+(Date.now()-sg._got);
    if(age>MAX_SIGNAL_AGE){ack(sg.id,"SKIP","Signal expired ("+Math.round(age/1000)+"s)");setStatus("⏱ Signal expired","#ffaa00");return;}
    var times=isTest?1:Math.max(1,Math.min(MAX_TRADES_PER_SIGNAL,parseInt(sg.trades)||1));   // EA ja bole (1 ba MTG te 2)
    var pre=getBalance(),t0=Date.now();
    var done=await clickMany(isUp,times);
    if(done===0){setStatus("❌ "+(isUp?SEL_UP:SEL_DOWN)+" pawa jay ni","#ff4444");ack(sg.id,"FAIL",(isUp?SEL_UP:SEL_DOWN)+" button pawa jay ni");return;}
    setStatus("✓ "+(isUp?"UP":"DOWN")+" x"+done+" clicked","#00ff66");
    var v=await verifyPlaced(pre);
    if(v.placed===false){
      setStatus("⚠ Balance kome ni - trade hoyni?","#ff4444");
      ack(sg.id,"FAIL",market+" "+(isUp?"BUY":"SELL")+" click hoyeche kintu balance kome ni (market bondho/balance kom/trade hoyni?)");
      return;
    }
    var dur=tfSecs(sg.tf);
    if(!isTest)totN.textContent=++totC;
    confTxt.textContent=market+(sg.score?" | "+sg.score+"/12":"");
    ack(sg.id,"TRADE",(isTest?"[AUTO CHECK] ":"")+market+" "+(isUp?"BUY":"SELL")+" x"+done+" placed"+(v.placed?" (stake -$"+(pre-v.snap).toFixed(2)+")":""),{market:market,clicks:done,stake:(v.placed&&v.snap!==null)?+(pre-v.snap).toFixed(2):null,test:isTest?1:0});
    speak(isUp?"Up.":"Down.");
    if(isTest){quietUntil=Date.now()+dur*1000+6000;return;}          // test trade track kori na
    waitingResult=true;
    watchTrade(sg,market,pre,v.snap,t0,dur);
  }finally{tradeBusy=false;}
}

// ───────────── RESULT ─────────────
function watchTrade(sg,market,pre,snap,clickAt,dur){
  var expiryAt=clickAt+dur*1000;
  clearInterval(watchTimer);
  watchTimer=setInterval(function(){
    var left=Math.ceil((expiryAt-Date.now())/1000);
    if(left>0){expDiv.textContent="Expiry: "+left+"s";var pct=Math.min(100,left/dur*100);pfill.style.width=pct+"%";pfill.style.background=pct>50?"#00dc64":pct>25?"#ffaa00":"#ff4444";return;}
    clearInterval(watchTimer);resultPhase=true;expDiv.textContent="Checking...";pfill.style.width="0%";
    if(pre===null||snap===null){            // balance pora jay ni -> result bujhte parbo na
      setTimeout(function(){waitingResult=false;resultPhase=false;expDiv.textContent="";setStatus("Result unknown (balance nai)","#888");ack(sg.id,"SKIP",market+" result track hoyni (balance pawa jayni)");},2000);
      return;
    }
    var tries=0;
    clearInterval(resTimer);
    resTimer=setInterval(function(){
      tries++;
      var now=getBalance();
      if(now!==null)balDiv.textContent="Bal: $"+now.toFixed(2);
      if(now!==null&&Math.abs(now-snap)>=0.01){clearInterval(resTimer);finish(sg,market,pre,snap,now);}
      else if(tries>=RESULT_POLL_MAX){clearInterval(resTimer);finish(sg,market,pre,snap,snap);}   // balance bodlayni = LOSS
    },RESULT_POLL_MS);
  },500);
}
function finish(sg,market,pre,snap,now){
  waitingResult=false;resultPhase=false;expDiv.textContent="";
  var net=now-pre;                                   // WIN = profit, LOSS = -stake, DRAW = 0
  var outcome=net>0.005?"WIN":(net<-0.005?"LOSS":"DRAW");
  netPL+=net;updatePL();
  if(outcome==="WIN"){
    winN.textContent=++upC;
    autoTxt.textContent="✅ WIN +$"+net.toFixed(2);autoTxt.style.color="#00ff66";setStatus("WIN +$"+net.toFixed(2),"#00ff66");speak("Win!");
  }else if(outcome==="LOSS"){
    lossN.textContent=++dnC;
    autoTxt.textContent="❌ LOSS -$"+Math.abs(net).toFixed(2);autoTxt.style.color="#ff4444";setStatus("LOSS -$"+Math.abs(net).toFixed(2),"#ff4444");speak("Loss.");
  }else{
    autoTxt.textContent="➖ DRAW";autoTxt.style.color="#ffaa00";setStatus("DRAW","#ffaa00");
  }
  ack(sg.id,outcome,market+" "+outcome+" "+(net>=0?"+":"-")+"$"+Math.abs(net).toFixed(2)+" | P/L $"+netPL.toFixed(2),{market:market,net:+net.toFixed(2),pl:+netPL.toFixed(2)});
  setTimeout(function(){autoTxt.textContent="";},4000);
  if(PROFIT_TARGET>0&&netPL>=PROFIT_TARGET){speak("Target reached!");stopBot();}
}

// ───────────── CONTROLS ─────────────
function stopBot(){
  running=false;btn.textContent="START";btn.style.background="#00aa44";
  box.style.animation="none";setBadge(false);
  sig.textContent="WAIT";sig.style.color="#aaa";sig.style.background="#1a1a1a";sig.style.borderColor="#333";
}
function startBot(){
  running=true;firstPoll=true;btn.textContent="STOP";btn.style.background="#cc0000";
  box.style.animation="ktPulse 2s infinite";liveBadge.textContent="● CONNECTING";liveBadge.style.color="#888";
  var b=getBalance();balDiv.textContent=b!==null?"Bal: $"+b.toFixed(2):"Bal: not found!";balDiv.style.color=b!==null?"#4488ff":"#ff4444";
  poll();
}
btn.onclick=function(){if(running)stopBot();else startBot();};
resetBtn.onclick=function(){upC=dnC=totC=0;netPL=0;winN.textContent=lossN.textContent=totN.textContent="0";updatePL();};
scanBtn.onclick=function(){
  var u=getBtn(true),d=getBtn(false),b=getBalance(),h=findAssetHeader();
  setStatus((u&&d)?"✅ UP/DOWN button OK":"❌ Button missing: "+(!u?"UP ":"")+(!d?"DOWN":""),(u&&d)?"#00ff66":"#ff4444");
  dbgDiv.textContent="Bal:"+(b!==null?b.toFixed(2):"?")+" | Hdr:"+(h?(h.textContent||"").trim().slice(0,16):"?");
  balDiv.textContent=b!==null?"Bal: $"+b.toFixed(2):"Bal: not found!";
};
otcBtn.onclick=function(){DEFAULT_OTC=!DEFAULT_OTC;try{localStorage.setItem("_ktOtc",DEFAULT_OTC?"1":"0");}catch(e){}otcLabel();};
mktSel.onchange=function(){curMarket=mktSel.value;try{localStorage.setItem("_ktMarket",curMarket);}catch(e){}if(!waitingResult&&!tradeBusy)switchMarket(curMarket);else setStatus("Trade shesh hole switch hobe");};
mktGo.onclick=function(){if(!waitingResult&&!tradeBusy)switchMarket(mktSel.value);};
function cleanup(){clearInterval(pollTimer);clearInterval(watchTimer);clearInterval(resTimer);try{box.remove();st.remove();}catch(e){}window._ktBox2=null;}
closeBtn.onclick=function(){cleanup();window._ktClean=null;};
window._ktClean=cleanup;
window._ktBox2=box;

var b0=getBalance();balDiv.textContent=b0!==null?"Bal: $"+b0.toFixed(2):"Bal: not found!";balDiv.style.color=b0!==null?"#4488ff":"#ff4444";
pollTimer=setInterval(poll,POLL_MS);window._ktPoll2=pollTimer;
poll();
})();
