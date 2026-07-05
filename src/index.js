/**
 * iOS Location Picker — Cloudflare Worker
 *
 * API:
 *   GET  /loc.json?token=   → 读取坐标 JSON（Loon / Shadowrocket configUrl）
 *   POST /set?token=        → 保存坐标（并开启伪造）
 *   POST /enable            → 切换伪造/恢复真实定位（无需 token，{enabled:false} 放行）
 *   GET  /?token=           → 地图选点网页（必须带正确 token）
 */

// 地图选点 UI（Location Picker page）
const PAGE = `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>定位选点</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
  .bar{padding:8px;display:flex;gap:6px;box-sizing:border-box}
  .bar input{flex:1;padding:10px;font-size:16px;border:1px solid #ccc;border-radius:8px}
  .bar button{padding:10px 14px;font-size:16px;border:0;border-radius:8px;background:#007aff;color:#fff}
  .results{margin:0 8px;border:1px solid #e2e2e2;border-radius:8px;max-height:34vh;overflow:auto;display:none}
  .results.show{display:block}
  .rrow{padding:10px 12px;font-size:14px;border-bottom:1px solid #eee;color:#222}
  .rrow:last-child{border-bottom:0}
  .rrow:active{background:#f0f6ff}
  #map{height:52vh;position:relative}
  #info{padding:8px 10px;font-size:13px;line-height:1.4}
  /* 选项面板：每行铺满横向，行内元素并排平分，视觉统一 */
  .opts{padding:6px 10px 12px;display:flex;flex-direction:column;gap:8px}
  .opts label{font-size:13px;color:#444;display:flex;flex-direction:column}
  .opts input{width:100%;box-sizing:border-box;padding:8px;font-size:15px;border:1px solid #ccc;border-radius:6px;margin-top:2px}
  /* 精度、按钮等成对元素并排，各占一半 */
  .optrow{display:flex;gap:8px;align-items:flex-end}
  .optrow>*{flex:1;min-width:0}
  /* 海拔行：输入框 + 取海拔按钮并排 */
  .altrow .altctl{display:flex;gap:8px;align-items:center;margin-top:2px}
  .altrow input{margin-top:0;flex:1}
  .optrow button{padding:12px 14px;font-size:15px;border:0;border-radius:8px;color:#fff}
  #savebtn{background:#34c759;font-weight:600}
  #restorebtn{background:#8e8e93}
  #altauto{padding:9px 12px;font-size:13px;border:1px solid #007aff;
    border-radius:6px;background:#fff;color:#007aff;white-space:nowrap;flex:none}
  #altauto:disabled{opacity:.55}
  .toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,.85);color:#fff;padding:10px 16px;border-radius:8px;
    font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:9999}
  .toast.show{opacity:1}
  .lang{position:absolute;bottom:10px;left:10px;z-index:1000;display:flex;
    border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.25);
    font-size:13px;background:#fff}
  .lang button{padding:6px 9px;border:0;background:#fff;color:#333;cursor:pointer;
    border-left:1px solid #e2e2e2;line-height:1}
  .lang button:first-child{border-left:0}
  .lang button.active{background:#007aff;color:#fff}
  .src{padding:6px 10px 14px;text-align:center;font-size:12px;color:#8e8e93}
  .src a{color:#007aff;text-decoration:none}
</style>
</head>
<body>
<div class="bar">
  <input id="q" data-i18n-ph="searchPlaceholder" placeholder="搜地名，回车列出候选（只预览，不改定位）">
  <button id="btn" data-i18n="searchBtn">搜</button>
</div>
<div class="results" id="results"></div>
<div id="map">
  <div class="lang" id="lang">
    <button data-lang="en">EN</button>
    <button data-lang="zh-Hant">繁</button>
    <button data-lang="zh-Hans">简</button>
  </div>
</div>
<div id="info">加载中…</div>
<div class="opts">
  <label class="altrow" data-i18n="altLabel">海拔(米)<span class="altctl"><input id="alt" type="number" inputmode="numeric"><button id="altauto" type="button" data-i18n="altAutoBtn">按地形取海拔</button></span></label>
  <div class="optrow">
    <label data-i18n="haccLabel">水平精度<input id="hacc" type="number" inputmode="numeric"></label>
    <label data-i18n="vaccLabel">垂直精度<input id="vacc" type="number" inputmode="numeric"></label>
  </div>
  <div class="optrow">
    <button id="savebtn" data-i18n="saveBtn">保存定位</button>
    <button id="restorebtn">恢复真实定位</button>
  </div>
</div>
<footer class="src">Source: <a href="https://github.com/hoicau/ios-location-spoofer" target="_blank" rel="noopener">hoicau/ios-location-spoofer</a></footer>
<div class="toast" id="toast"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var token = new URLSearchParams(location.search).get("token") || "";

// ---- i18n ----
var I18N = {
  "en": {
    title: "Location Picker",
    searchPlaceholder: "Search a place, Enter to list (preview only, doesn't move location)",
    searchBtn: "Search",
    altLabel: "Altitude (m)",
    haccLabel: "H. accuracy",
    vaccLabel: "V. accuracy",
    saveBtn: "Save location",
    altAutoBtn: "Auto from terrain",
    altAutoBusy: "Fetching\\u2026",
    toastAltFail: "Couldn't fetch terrain elevation",
    restoreBtn: "Restore real location",
    reenableBtn: "Re-enable spoofing",
    loading: "Loading\\u2026",
    loadFailed: "Load failed, check that the token is correct",
    restored: "Real location restored, script passes through unmodified (effective after toggling Location Services)",
    saved: "Saved \\u2713",
    unsaved: "Unsaved, tap \\u201CSave location\\u201D to apply",
    infoAlt: "alt",
    infoAltUnknown: "?",
    layerAmap: "Amap (vector)",
    layerAmapSat: "Amap (satellite)",
    layerOsm: "OSM (overseas)",
    toastEnabled: "Spoofing on \\u2014 toggle Location Services to apply",
    toastRestored: "Real location restored \\u2014 toggle Location Services to apply",
    toastToggleFail: "Toggle failed ",
    toastNetErr: "Network error",
    toastNotFound: "Nothing found",
    toastSearchFail: "Search failed",
    toastCentered: "Centered \\u2014 tap the map to drop a pin",
    toastSaved: "Saved \\u2713 \\u2014 applies in Loon/Shadowrocket within ~60s"
  },
  "zh-Hant": {
    title: "\\u5B9A\\u4F4D\\u9078\\u9EDE",
    searchPlaceholder: "\\u641C\\u5730\\u540D\\uFF0C\\u56DE\\u8ECA\\u5217\\u51FA\\u5019\\u9078\\uFF08\\u50C5\\u9810\\u89BD\\uFF0C\\u4E0D\\u6539\\u5B9A\\u4F4D\\uFF09",
    searchBtn: "\\u641C\\u5C0B",
    altLabel: "\\u6D77\\u62D4(\\u7C73)",
    haccLabel: "\\u6C34\\u5E73\\u7CBE\\u5EA6",
    vaccLabel: "\\u5782\\u76F4\\u7CBE\\u5EA6",
    saveBtn: "\\u5132\\u5B58\\u5B9A\\u4F4D",
    altAutoBtn: "\\u6309\\u5730\\u5F62\\u53D6\\u6D77\\u62D4",
    altAutoBusy: "\\u53D6\\u5F97\\u4E2D\\u2026",
    toastAltFail: "\\u7121\\u6CD5\\u53D6\\u5F97\\u5730\\u5F62\\u6D77\\u62D4",
    restoreBtn: "\\u6062\\u5FA9\\u771F\\u5BE6\\u5B9A\\u4F4D",
    reenableBtn: "\\u25CF \\u91CD\\u65B0\\u958B\\u555F\\u507D\\u88DD",
    loading: "\\u8F09\\u5165\\u4E2D\\u2026",
    loadFailed: "\\u8F09\\u5165\\u5931\\u6557\\uFF0C\\u6AA2\\u67E5 token \\u662F\\u5426\\u6B63\\u78BA",
    restored: "\\u5DF2\\u6062\\u5FA9\\u771F\\u5BE6\\u5B9A\\u4F4D\\uFF0C\\u8173\\u672C\\u653E\\u884C\\u4E0D\\u4FEE\\u6539\\u3000\\uFF08\\u95DC\\u958B\\u5B9A\\u4F4D\\u5F8C\\u751F\\u6548\\uFF09",
    saved: "\\u5DF2\\u5132\\u5B58 \\u2713",
    unsaved: "\\u672A\\u5132\\u5B58\\uFF0C\\u9EDE\\u201C\\u5132\\u5B58\\u5B9A\\u4F4D\\u201D\\u751F\\u6548",
    infoAlt: "\\u6D77\\u62D4",
    infoAltUnknown: "?",
    layerAmap: "\\u9AD8\\u5FB7\\u5730\\u5716",
    layerAmapSat: "\\u9AD8\\u5FB7\\u885B\\u661F",
    layerOsm: "\\u570B\\u5916 OSM",
    toastEnabled: "\\u5DF2\\u958B\\u555F\\u507D\\u88DD\\uFF0C\\u8A18\\u5F97\\u95DC\\u958B\\u5B9A\\u4F4D\\u751F\\u6548",
    toastRestored: "\\u5DF2\\u6062\\u5FA9\\u771F\\u5BE6\\u5B9A\\u4F4D\\uFF0C\\u8A18\\u5F97\\u95DC\\u958B\\u5B9A\\u4F4D\\u751F\\u6548",
    toastToggleFail: "\\u5207\\u63DB\\u5931\\u6557 ",
    toastNetErr: "\\u7DB2\\u8DEF\\u932F\\u8AA4",
    toastNotFound: "\\u6C92\\u627E\\u5230",
    toastSearchFail: "\\u641C\\u5C0B\\u5931\\u6557",
    toastCentered: "\\u5DF2\\u5B9A\\u4F4D\\u8996\\u91CE\\uFF0C\\u5728\\u5730\\u5716\\u4E0A\\u9EDE\\u4E00\\u4E0B\\u653E\\u7F6E\\u5716\\u91D8",
    toastSaved: "\\u5DF2\\u5132\\u5B58 \\u2713 Loon/\\u5C0F\\u706B\\u7BAD\\u7D0460\\u79D2\\u5167\\u751F\\u6548"
  },
  "zh-Hans": {
    title: "\\u5B9A\\u4F4D\\u9009\\u70B9",
    searchPlaceholder: "\\u641C\\u5730\\u540D\\uFF0C\\u56DE\\u8F66\\u5217\\u51FA\\u5019\\u9009\\uFF08\\u53EA\\u9884\\u89C8\\uFF0C\\u4E0D\\u6539\\u5B9A\\u4F4D\\uFF09",
    searchBtn: "\\u641C",
    altLabel: "\\u6D77\\u62D4(\\u7C73)",
    haccLabel: "\\u6C34\\u5E73\\u7CBE\\u5EA6",
    vaccLabel: "\\u5782\\u76F4\\u7CBE\\u5EA6",
    saveBtn: "\\u4FDD\\u5B58\\u5B9A\\u4F4D",
    altAutoBtn: "\\u6309\\u5730\\u5F62\\u53D6\\u6D77\\u62D4",
    altAutoBusy: "\\u83B7\\u53D6\\u4E2D\\u2026",
    toastAltFail: "\\u65E0\\u6CD5\\u83B7\\u53D6\\u5730\\u5F62\\u6D77\\u62D4",
    restoreBtn: "\\u6062\\u590D\\u771F\\u5B9E\\u5B9A\\u4F4D",
    reenableBtn: "\\u25CF \\u91CD\\u65B0\\u5F00\\u542F\\u4F2A\\u9020",
    loading: "\\u52A0\\u8F7D\\u4E2D\\u2026",
    loadFailed: "\\u52A0\\u8F7D\\u5931\\u8D25\\uFF0C\\u68C0\\u67E5 token \\u662F\\u5426\\u6B63\\u786E",
    restored: "\\u5DF2\\u6062\\u590D\\u771F\\u5B9E\\u5B9A\\u4F4D\\uFF0C\\u811A\\u672C\\u653E\\u884C\\u4E0D\\u4FEE\\u6539\\u3000\\uFF08\\u5173\\u5F00\\u5B9A\\u4F4D\\u540E\\u751F\\u6548\\uFF09",
    saved: "\\u5DF2\\u4FDD\\u5B58 \\u2713",
    unsaved: "\\u672A\\u4FDD\\u5B58\\uFF0C\\u70B9\\u201C\\u4FDD\\u5B58\\u5B9A\\u4F4D\\u201D\\u751F\\u6548",
    infoAlt: "\\u6D77\\u62D4",
    infoAltUnknown: "?",
    layerAmap: "\\u9AD8\\u5FB7\\u5730\\u56FE",
    layerAmapSat: "\\u9AD8\\u5FB7\\u536B\\u661F",
    layerOsm: "\\u56FD\\u5916 OSM",
    toastEnabled: "\\u5DF2\\u5F00\\u542F\\u4F2A\\u9020\\uFF0C\\u8BB0\\u5F97\\u5173\\u5F00\\u5B9A\\u4F4D\\u751F\\u6548",
    toastRestored: "\\u5DF2\\u6062\\u590D\\u771F\\u5B9E\\u5B9A\\u4F4D\\uFF0C\\u8BB0\\u5F97\\u5173\\u5F00\\u5B9A\\u4F4D\\u751F\\u6548",
    toastToggleFail: "\\u5207\\u6362\\u5931\\u8D25 ",
    toastNetErr: "\\u7F51\\u7EDC\\u9519\\u8BEF",
    toastNotFound: "\\u6CA1\\u627E\\u5230",
    toastSearchFail: "\\u641C\\u7D22\\u5931\\u8D25",
    toastCentered: "\\u5DF2\\u5B9A\\u4F4D\\u89C6\\u91CE\\uFF0C\\u5728\\u5730\\u56FE\\u4E0A\\u70B9\\u4E00\\u4E0B\\u653E\\u7F6E\\u56FE\\u9489",
    toastSaved: "\\u5DF2\\u4FDD\\u5B58 \\u2713 Loon/\\u5C0F\\u706B\\u7BAD\\u7EA660\\u79D2\\u5185\\u751F\\u6548"
  }
};

function pickInitialLang(){
  try {
    var stored = localStorage.getItem("locpicker_lang");
    if (stored && I18N[stored]) return stored;
  } catch (e) {}
  var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || "en"];
  for (var i = 0; i < langs.length; i++) {
    var l = (langs[i] || "").toLowerCase();
    if (l.indexOf("zh") === 0) {
      if (l.indexOf("hant") >= 0 || l.indexOf("tw") >= 0 || l.indexOf("hk") >= 0 || l.indexOf("mo") >= 0) return "zh-Hant";
      return "zh-Hans";
    }
    if (l.indexOf("en") === 0) return "en";
  }
  return "en";
}

var lang = pickInitialLang();
function t(key){ return (I18N[lang] && I18N[lang][key]) || I18N["en"][key] || key; }

function applyLang(){
  document.documentElement.lang = lang;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach(function(el){
    var txt = t(el.getAttribute("data-i18n"));
    // 若元素含子节点（如 <label> 里的 input/button），只改开头的文字节点，避免抹掉子控件
    var first = el.firstChild;
    if (el.children.length && first && first.nodeType === 3) { first.nodeValue = txt; }
    else { el.textContent = txt; }
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function(el){ el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
  document.querySelectorAll("#lang button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-lang") === lang);
  });
  updateEnabledUI();
  if (typeof layerControl !== "undefined" && layerControl) relabelLayers();
}

function setLang(next){
  if (!I18N[next]) return;
  lang = next;
  try { localStorage.setItem("locpicker_lang", next); } catch (e) {}
  applyLang();
}

var GCJ = (function(){
  var PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323;
  function outOfChina(lat,lng){return (lng<72.004||lng>137.8347)||(lat<0.8293||lat>55.8271);}
  function tLat(x,y){
    var r=-100.0+2.0*x+3.0*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    r+=(20.0*Math.sin(6.0*x*PI)+20.0*Math.sin(2.0*x*PI))*2.0/3.0;
    r+=(20.0*Math.sin(y*PI)+40.0*Math.sin(y/3.0*PI))*2.0/3.0;
    r+=(160.0*Math.sin(y/12.0*PI)+320*Math.sin(y*PI/30.0))*2.0/3.0;return r;
  }
  function tLng(x,y){
    var r=300.0+x+2.0*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    r+=(20.0*Math.sin(6.0*x*PI)+20.0*Math.sin(2.0*x*PI))*2.0/3.0;
    r+=(20.0*Math.sin(x*PI)+40.0*Math.sin(x/3.0*PI))*2.0/3.0;
    r+=(150.0*Math.sin(x/12.0*PI)+300*Math.sin(x/30.0*PI))*2.0/3.0;return r;
  }
  function wgs2gcj(lat,lng){
    if(outOfChina(lat,lng))return [lat,lng];
    var dLat=tLat(lng-105.0,lat-35.0), dLng=tLng(lng-105.0,lat-35.0);
    var radLat=lat/180.0*PI, m=Math.sin(radLat); m=1-ee*m*m; var sm=Math.sqrt(m);
    dLat=(dLat*180.0)/((a*(1-ee))/(m*sm)*PI);
    dLng=(dLng*180.0)/(a/sm*Math.cos(radLat)*PI);
    return [lat+dLat,lng+dLng];
  }
  function gcj2wgs(lat,lng){ // 迭代反解，往返误差 <0.001 米
    if(outOfChina(lat,lng))return [lat,lng];
    var wlat=lat, wlng=lng;
    for(var i=0;i<3;i++){ var g=wgs2gcj(wlat,wlng); wlat+=lat-g[0]; wlng+=lng-g[1]; }
    return [wlat,wlng];
  }
  return {wgs2gcj:wgs2gcj, gcj2wgs:gcj2wgs};
})();

var map, marker, layerControl, layers = {};
var WGS = {lat:0, lng:0};
var datum = "gcj";
var saved = true;
var enabledState = true;  // true=伪造中；false=已恢复真实定位（脚本放行）

function $(id){return document.getElementById(id);}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(function(){e.classList.remove("show");},1800);}
function numOrNull(id){var v=$(id).value.trim();return v===""?null:Number(v);}
// Leaflet 在重复世界地图上可能返回 -239 这类经度，需要归一化。
function wrapLng(lng){return ((((Number(lng)+180)%360)+360)%360)-180;}

function info(){
  if(!enabledState){
    $("info").innerHTML = "<b style='color:#ff9500'>"+t("restored")+"</b>";
    return;
  }
  var tag = saved ? t("saved") : t("unsaved");
  $("info").innerHTML = "<b style='color:"+(saved?"#34c759":"#ff9500")+"'>"+tag+"</b>　WGS-84 "+
    WGS.lat.toFixed(5)+", "+WGS.lng.toFixed(5)+"　"+t("infoAlt")+" "+($("alt").value||t("infoAltUnknown"))+"m";
}

// 切换按钮外观：伪造中(灰按钮“恢复真实定位”) / 已恢复(橙按钮“重新开启伪造”)
function updateEnabledUI(){
  var b=$("restorebtn");
  if(enabledState){ b.textContent=t("restoreBtn"); b.style.background="#8e8e93"; }
  else { b.textContent=t("reenableBtn"); b.style.background="#ff9500"; }
  info();
}

// 一键切换 伪造/恢复真实
function toggleEnabled(){
  var want = !enabledState;
  fetch("/enable",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:want})})
    .then(function(r){
      if(r.ok){ enabledState=want; updateEnabledUI();
        toast(want ? t("toastEnabled") : t("toastRestored")); }
      else toast(t("toastToggleFail")+r.status);
    })
    .catch(function(){ toast(t("toastNetErr")); });
}

function dispPos(){return datum==="gcj"?GCJ.wgs2gcj(WGS.lat,WGS.lng):[WGS.lat,WGS.lng];}
function toWgs(lat,lng){lng=wrapLng(lng);return datum==="gcj"?GCJ.gcj2wgs(lat,lng):[lat,lng];}

function fetchElevation(lat,lng){
  lng=wrapLng(lng);
  return fetch("https://api.open-meteo.com/v1/elevation?latitude="+lat+"&longitude="+lng)
    .then(function(r){return r.json();})
    .then(function(d){return (d&&d.elevation&&d.elevation.length)?d.elevation[0]:null;})
    .catch(function(){return null;});
}

function movePin(dispLat,dispLng){
  dispLng=wrapLng(dispLng);
  var w=toWgs(dispLat,dispLng);
  WGS={lat:w[0], lng:wrapLng(w[1])};
  saved=false;
  marker.setLatLng([dispLat,dispLng]);
  info();
  fetchElevation(WGS.lat,WGS.lng).then(function(el){ if(el!==null)$("alt").value=Math.round(el); info(); });
}

// 按当前图钉的地形取海拔（手动触发）
function autoAltitude(){
  var b=$("altauto");
  b.disabled=true; b.textContent=t("altAutoBusy");
  fetchElevation(WGS.lat,WGS.lng).then(function(el){
    if(el!==null){ $("alt").value=Math.round(el); saved=false; info(); }
    else toast(t("toastAltFail"));
  }).catch(function(){ toast(t("toastAltFail")); })
    .then(function(){ b.disabled=false; b.textContent=t("altAutoBtn"); });
}

function commit(){
  var payload={lat:WGS.lat, lng:WGS.lng,
    altitude:numOrNull("alt"), horizontalAccuracy:numOrNull("hacc"), verticalAccuracy:numOrNull("vacc")};
  fetch("/set?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    .then(function(r){ if(r.ok){ saved=true; enabledState=true; updateEnabledUI(); toast(t("toastSaved")); } else { toast(t("toastToggleFail")+r.status); } })
    .catch(function(){ toast(t("toastNetErr")); });
}

function search(){
  var q=$("q").value.trim(); if(!q) return;
  fetch("https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=8&q="+encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(a){
      var box=$("results"); box.innerHTML="";
      if(!a||!a.length){ box.classList.remove("show"); toast(t("toastNotFound")); return; }
      a.forEach(function(it){
        var row=document.createElement("div");
        row.className="rrow";
        row.textContent=it.display_name;
        row.addEventListener("click",function(){
          box.classList.remove("show"); box.innerHTML="";
          var la=+it.lat, lo=+it.lon;
          var p = datum==="gcj"?GCJ.wgs2gcj(la,lo):[la,lo];
          map.setView(p,15);
          toast(t("toastCentered"));
        });
        box.appendChild(row);
      });
      box.classList.add("show");
    })
    .catch(function(){toast(t("toastSearchFail"));});
}

function load(){
  fetch("/loc.json?token="+encodeURIComponent(token)).then(function(r){return r.json();}).then(function(d){
    WGS={lat:d.latitude, lng:d.longitude};
    saved=true;
    enabledState=(d.enabled!==false);
    $("alt").value=(d.altitude!==undefined?d.altitude:"");
    $("hacc").value=(d.horizontalAccuracy!==undefined?d.horizontalAccuracy:39);
    $("vacc").value=(d.verticalAccuracy!==undefined?d.verticalAccuracy:1000);

    var amapVec=L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7",{subdomains:"1234",maxZoom:18,attribution:"高德地图"});
    amapVec.datum="gcj";
    var amapSat=L.layerGroup([
      L.tileLayer("https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",{subdomains:"1234",maxZoom:18}),
      L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8",{subdomains:"1234",maxZoom:18})
    ]);
    amapSat.datum="gcj";
    var osm=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});
    osm.datum="wgs";

    layers = {amap: amapVec, amapSat: amapSat, osm: osm};

    map=L.map("map");
    osm.addTo(map); datum="wgs";
    map.setView(dispPos(),13);
    relabelLayers();
    // 语言切换器叠在地图上，阻止点击/拖动穿透到地图（放置图钉、平移）
    L.DomEvent.disableClickPropagation($("lang"));

    marker=L.marker(dispPos(),{draggable:true}).addTo(map);
    updateEnabledUI();

    map.on("baselayerchange",function(e){datum=e.layer.datum||"wgs"; var p=dispPos(); marker.setLatLng(p); map.setView(p,map.getZoom()); info();});
    map.on("click",function(e){movePin(e.latlng.lat,e.latlng.lng);});
    marker.on("dragend",function(){var p=marker.getLatLng(); movePin(p.lat,p.lng);});
  }).catch(function(){$("info").textContent=t("loadFailed");});
}

// 重新构建图层切换控件以套用当前语言（Leaflet 不支持原地改名）
function relabelLayers(){
  if(!map||!layers.amap) return;
  if(layerControl) map.removeControl(layerControl);
  var named={};
  named[t("layerOsm")]=layers.osm;
  named[t("layerAmap")]=layers.amap;
  named[t("layerAmapSat")]=layers.amapSat;
  layerControl=L.control.layers(named,null,{collapsed:false}).addTo(map);
}

$("btn").addEventListener("click",search);
$("q").addEventListener("keydown",function(e){if(e.key==="Enter")search();});
$("savebtn").addEventListener("click",commit);
$("restorebtn").addEventListener("click",toggleEnabled);
$("altauto").addEventListener("click",autoAltitude);
$("lang").addEventListener("click",function(e){var b=e.target.closest("button[data-lang]"); if(b)setLang(b.getAttribute("data-lang"));});

$("info").textContent=t("loading");
applyLang();
load();
</script>
</body>
</html>`;

const KV_KEY = "loc";

const DEFAULT = {
  enabled: true,          // false = 脚本放行原始响应（恢复真实定位）
  latitude: 37.3349,
  longitude: -122.00902,
  altitude: 530,
  horizontalAccuracy: 39,
  verticalAccuracy: 1000,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function textResponse(body, contentType, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function unauthorized() {
  return jsonResponse({ error: "bad token" }, 403);
}

function checkToken(request, env) {
  const configured = env.TOKEN;
  if (!configured) {
    return { ok: false, error: "server misconfigured: TOKEN secret not set" };
  }
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== configured) {
    return { ok: false, error: "bad token" };
  }
  return { ok: true };
}

async function readLoc(env) {
  try {
    const raw = await env.LOC_KV.get(KV_KEY);
    if (!raw) {
      return { ...DEFAULT };
    }
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT };
  }
}

async function writeLoc(env, obj) {
  await env.LOC_KV.put(KV_KEY, JSON.stringify(obj));
}

function setInt(target, key, value) {
  if (value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value))) {
    target[key] = Math.round(Number(value));
  }
}

function wrapLng(lng) {
  return ((((Number(lng) + 180) % 360) + 360) % 360) - 180;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const auth = checkToken(request, env);

    if (url.pathname === "/loc.json" && request.method === "GET") {
      if (!auth.ok) {
        return unauthorized();
      }
      const loc = await readLoc(env);
      return jsonResponse(loc);
    }

    if (url.pathname === "/set" && request.method === "POST") {
      if (!auth.ok) {
        return unauthorized();
      }
      let bodyText;
      try {
        bodyText = await request.text();
        if (bodyText.length > 10000) {
          return jsonResponse({ error: "payload too large" }, 413);
        }
        const j = JSON.parse(bodyText);
        const la = Number(j.lat);
        const loRaw = Number(j.lng);
        if (!Number.isFinite(la) || !Number.isFinite(loRaw) || la < -90 || la > 90) {
          return jsonResponse({ error: "bad coords" }, 400);
        }
        const lo = wrapLng(loRaw);
        const cur = await readLoc(env);
        cur.enabled = true; // 保存一个新位置 = 开启伪造
        cur.latitude = la;
        cur.longitude = lo;
        setInt(cur, "altitude", j.altitude);
        setInt(cur, "horizontalAccuracy", j.horizontalAccuracy);
        setInt(cur, "verticalAccuracy", j.verticalAccuracy);
        await writeLoc(env, cur);
        return jsonResponse(cur);
      } catch {
        return jsonResponse({ error: "bad json" }, 400);
      }
    }

    // ---- 一键切换：伪造 / 恢复真实定位（无需 token）----
    if (url.pathname === "/enable" && request.method === "POST") {
      let bodyText;
      try {
        bodyText = await request.text();
        if (bodyText.length > 10000) {
          return jsonResponse({ error: "payload too large" }, 413);
        }
        const j = JSON.parse(bodyText);
        const cur = await readLoc(env);
        cur.enabled = j.enabled !== false; // false=恢复真实定位（脚本放行）
        await writeLoc(env, cur);
        return jsonResponse(cur);
      } catch (error) {
        return jsonResponse({ error: "bad json" }, 400);
      }
    }

    if ((url.pathname === "/" || url.pathname === "") && request.method === "GET") {
      if (!auth.ok) {
        return unauthorized();
      }
      return textResponse(PAGE, "text/html; charset=utf-8");
    }

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, kv: !!env.LOC_KV, tokenConfigured: !!env.TOKEN });
    }

    return textResponse("not found", "text/plain", 404);
  },
};
