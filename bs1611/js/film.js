
var SORULAR=[{"q": "Evlendiğimiz gün hangi tarihti?", "h": 3983128469, "l": "Evlendik 💍"}], EVLILIK="2025-11-16", FOTO=["img/kare1.jpg", "img/kare2.jpg", "img/kare3.jpg", "img/kare4.jpg"], YUZ=[];
(function(){
var $=function(i){return document.getElementById(i)},k=0,ses=!0,ac=null,muz=null;
function hs(s){s=unescape(encodeURIComponent(s));var x=2166136261;for(var i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)>>>0}return x}
function sall(m){var f=$("f1");$("h1").textContent=m;f.classList.remove("sallan");void f.offsetWidth;f.classList.add("sallan")}
var BAS=[["",""],["I","İlk Buluşma"],["II","İlk Teklif"],["III","İlk Yolculuk"],["IV","Evet Dediğimiz Gün"]];
let turning = false;
function turnPage(from, reveal, heading) {
  if (turning) return;
  turning = true;
  const sheet = document.createElement("div");
  sheet.className = "turn-sheet";
  sheet.setAttribute("aria-hidden", "true");
  document.body.appendChild(sheet);
  // Mount the actual outgoing page on the hinge so its live visuals remain intact.
  const parent = from.parentNode;
  const anchor = document.createComment("page position");
  parent.insertBefore(anchor, from);
  const scroll = window.scrollY;
  const front = document.createElement("div");
  front.className = "turn-front";
  front.inert = true;
  const back = document.createElement("div");
  back.className = "turn-back";
  back.innerHTML = "<i>B &amp; S</i>";
  sheet.append(front,back);
  front.appendChild(from);
  front.scrollTop = scroll;
  reveal();
  window.scrollTo(0,0);
  function finish(){
    from.classList.remove("acik");
    parent.insertBefore(from,anchor);
    anchor.remove();
    sheet.remove();
    turning = false;
    const title = document.querySelector(heading);
    if(title){ title.tabIndex = -1; title.focus({preventScroll:true}); }
  }
  if(matchMedia("(prefers-reduced-motion: reduce)").matches || !sheet.animate){finish();return;}
  const animation = sheet.animate([
    {transform:"perspective(1800px) rotateY(0deg)",offset:0},
    {transform:"perspective(1800px) rotateY(-38deg)",offset:.36},
    {transform:"perspective(1800px) rotateY(-100deg)",offset:.76},
    {transform:"perspective(1800px) rotateY(-164deg)",offset:1}
  ], {duration:950,easing:"cubic-bezier(.33,.01,.25,1)",fill:"forwards"});
  animation.finished.then(finish,finish);
}
function git(n){
  if(turning) return;
  const from = document.querySelector("#e1 .bolum.acik");
  if(!from || from.id === "b"+n) return;
  titre(15);
  turnPage(from, function(){
    $("b"+n).classList.add("acik");
    $("ilerle").classList.add("gor");
    Array.from($("ilerle").children).forEach((dot,i)=>dot.className=i<n?"ok":"");
    document.body.classList.add("film");
    $("ses").style.display="block";
    window.bolumGecis && bolumGecis(n);
  }, "#b"+n+" h1");
}
function bitti(n){titre([20,60,40]);var b=$("b"+n).querySelector(".ileri");b&&b.classList.remove("gizli");ding(n)}
$("basla").addEventListener("click",function(){if(turning)return;acSes();ding(0);muzik();git(1)});
[].forEach.call(document.querySelectorAll(".ileri"),function(b){b.addEventListener("click",function(){acSes();git(+b.getAttribute("data-git"))})});
/* 3D eğim: parmak, fare ve telefon eğimi */
(function(){var hx=0,hy=0,tx=0,ty=0,sec=".cerceve:not(#f1),.bilet,.polaroid,.anifoto,.geri";
 [].forEach.call(document.querySelectorAll(sec),function(e){e.classList.add("d3");if(/cerceve|bilet|kazi/.test(e.className)){var l=document.createElement("div");l.className="isik";e.appendChild(l)}});
 function hedef(x,y){tx=Math.max(-1,Math.min(1,x));ty=Math.max(-1,Math.min(1,y))}
 addEventListener("pointermove",function(e){e.pointerType==="mouse"&&hedef(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1)});
 var dokun=!1;addEventListener("touchstart",function(){dokun=!0},{passive:!0,capture:!0});addEventListener("touchend",function(){setTimeout(function(){dokun=!1},250)},{passive:!0,capture:!0});
 var izin=!1;function yon(e){e.gamma!=null&&hedef(e.gamma/25,(e.beta-40)/25)}
 function izinAl(){if(izin)return;izin=!0;var D=window.DeviceOrientationEvent;if(D&&typeof D.requestPermission==="function"){D.requestPermission().then(function(r){r==="granted"&&addEventListener("deviceorientation",yon)}).catch(function(){})}else addEventListener("deviceorientation",yon)}
 $("basla").addEventListener("click",izinAl);
 (function d(z){if(dokun){requestAnimationFrame(d);return}z=(z||0)/1e3;var ox=tx+Math.sin(z*.6)*.15,oy=ty+Math.cos(z*.5)*.12;hx+=(ox-hx)*.07;hy+=(oy-hy)*.07;
  [].forEach.call(document.querySelectorAll(".bolum.acik .d3, #e2.acik .d3"),function(e){var r=e.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;
   e.style.transform="rotateY("+(hx*9)+"deg) rotateX("+(-hy*7)+"deg)";var l=e.querySelector(".isik");l&&(l.style.setProperty("--lx",50+hx*40+"%"),l.style.setProperty("--ly",30+hy*40+"%"))});
  requestAnimationFrame(d)})()})();
/* 3D kalp: katmanlar */
(function(){var d=$("kalpDon");for(var i=0;i<18;i++){var sp=document.createElement("span"),z=(i-9)*1.6,l=i===17||i===0;sp.style.transform="translateZ("+z+"px)";
 if(i===17){sp.className="yuz";sp.style.backgroundImage="url("+FOTO[3]+")"}else if(i===0){sp.className="yuz";sp.style.backgroundImage="url("+FOTO[0]+")";sp.style.transform="translateZ("+z+"px) rotateY(180deg)"}
 else{var t=Math.abs(i-9)/9;sp.style.background="linear-gradient(135deg, hsl(345,"+(70-t*20)+"%,"+(42-t*14)+"%), hsl(338,70%,"+(22-t*8)+"%))"}d.appendChild(sp)}})();
[].forEach.call(document.querySelectorAll(".fon"),function(f){f.style.backgroundImage="url("+FOTO[+f.getAttribute("data-f")]+")"});
var HS=[],hi=0,AY=["Bir yıl önce “evet” dedik.","O günden beri her sabah aynı cümle: iyi ki sen.","Bu film bizim. Ve daha yeni başlıyor."];
[3,0,2,1].forEach(function(k,i){var d=document.createElement("div");d.className="hero-foto";d.style.backgroundImage="url("+FOTO[k]+")";d.style.animationDelay=(-i*5)+"s";$("hero").insertBefore(d,$("hero").firstChild);HS.push(d)});
function heroDon(){HS.forEach(function(d,i){d.classList.toggle("gor",i===hi%HS.length)});var a=$("altyazi");a.classList.remove("gor");setTimeout(function(){a.textContent=AY[hi%AY.length];a.classList.add("gor");hi++},700)}
/* fotoğraflar */
$("kalpFoto").setAttribute("href",FOTO[3]);$("kalpFoto").setAttributeNS("http://www.w3.org/1999/xlink","href",FOTO[3]);
document.querySelector("#aniFoto2 img").src=FOTO[2];document.querySelector("#pol3 img").src=FOTO[1];
/* gerçekçi gökyüzü */
(function(){var cv=$("gokyuzu"),x=cv.getContext("2d"),Y=[],W,H,r,kay=null;
 function boy(){r=Math.min(devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;cv.width=W*r;cv.height=H*r;x.setTransform(r,0,0,r,0,0);Y=[];
  for(var i=0;i<Math.min(420,W*H/900);i++){var t=Math.random();Y.push({x:Math.random()*W,y:Math.random()*H,b:Math.pow(Math.random(),3)*1.6+.25,f:Math.random()*6.3,h:t<.15?"255,210,180":t<.3?"190,215,255":"255,250,240",s:.5+Math.random()*2})}}
 boy();addEventListener("resize",boy);if(window.ResizeObserver)new ResizeObserver(boy).observe(cv);
 (function d(z){if(!$("b1").classList.contains("acik")){requestAnimationFrame(d);return}z=(z||0)/1e3;
  var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#03050c");g.addColorStop(.55,"#0b1530");g.addColorStop(1,"#1b2346");x.fillStyle=g;x.fillRect(0,0,W,H);
  var m=x.createRadialGradient(W*.3,H*.35,0,W*.3,H*.35,W*.9);m.addColorStop(0,"rgba(120,140,210,.16)");m.addColorStop(.5,"rgba(90,80,160,.06)");m.addColorStop(1,"rgba(0,0,0,0)");x.save();x.translate(W*.5,H*.4);x.rotate(-.5);x.scale(1.6,.35);x.translate(-W*.5,-H*.4);x.fillStyle=m;x.fillRect(0,0,W,H);x.restore();
  Y.forEach(function(y){var a=.55+.45*Math.sin(z*y.s+y.f);x.fillStyle="rgba("+y.h+","+(a*Math.min(1,y.b))+")";x.beginPath();x.arc(y.x,y.y,y.b*.75,0,6.3);x.fill();
   if(y.b>1.3){var q=x.createRadialGradient(y.x,y.y,0,y.x,y.y,y.b*4);q.addColorStop(0,"rgba("+y.h+","+.35*a+")");q.addColorStop(1,"rgba("+y.h+",0)");x.fillStyle=q;x.fillRect(y.x-y.b*4,y.y-y.b*4,y.b*8,y.b*8)}});
  if(!kay&&Math.random()<.004)kay={x:Math.random()*W*.7+W*.2,y:Math.random()*H*.3,t:0};
  if(kay){kay.t+=.022;var L=kay.t*W*.5,ex=kay.x-L,ey=kay.y+L*.45,lg=x.createLinearGradient(ex,ey,ex+90,ey-40);lg.addColorStop(0,"rgba(255,255,255,"+(1-kay.t)+")");lg.addColorStop(1,"rgba(255,255,255,0)");x.strokeStyle=lg;x.lineWidth=1.4;x.beginPath();x.moveTo(ex,ey);x.lineTo(ex+90,ey-40);x.stroke();kay.t>=1&&(kay=null)}
  var h=x.createLinearGradient(0,H*.82,0,H);h.addColorStop(0,"rgba(0,0,0,0)");h.addColorStop(1,"rgba(2,3,8,.95)");x.fillStyle=h;x.fillRect(0,H*.82,W,H*.18);
  requestAnimationFrame(d)})()})();
/* çan/celesta sesi */
function can(f,t,v,pan){if(!ac||!ses)return;[[1,1,1.8],[2.76,.45,.9],[5.4,.22,.5],[8.93,.1,.3]].forEach(function(p){var o=ac.createOscillator(),g=ac.createGain(),pn=ac.createStereoPanner?ac.createStereoPanner():null;o.type="sine";o.frequency.value=f*p[0];
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v*p[1],t+.004);g.gain.exponentialRampToValueAtTime(.0003,t+p[2]*2);o.connect(g);var out=g;if(pn){pn.pan.value=pan||0;g.connect(pn);out=pn}out.connect(ana);out.connect(yanki);o.start(t);o.stop(t+p[2]*2+.05)})}
function arp(t){[60,64,67,72,76,79,84,88].forEach(function(n,i){can(NT(n),t+i*.075,.07,(i/7-.5))});[48,55,64,67].forEach(function(n){piyano(NT(n),t+.6,3.5,.07,0)})}
/* efekt sesleri */
function kalpAtis(v){if(!ac||!ses)return;var t=ac.currentTime;[[0,1],[.17,.7]].forEach(function(p){var o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.setValueAtTime(70,t+p[0]);o.frequency.exponentialRampToValueAtTime(38,t+p[0]+.18);
 g.gain.setValueAtTime(0,t+p[0]);g.gain.linearRampToValueAtTime(v*p[1],t+p[0]+.012);g.gain.exponentialRampToValueAtTime(.0005,t+p[0]+.25);o.connect(g);g.connect(ana);o.start(t+p[0]);o.stop(t+p[0]+.3)})}
function gurultu(d,v,f1,f2,q){if(!ac||!ses)return;var t=ac.currentTime,n=ac.sampleRate*d|0,b=ac.createBuffer(1,n,ac.sampleRate),c=b.getChannelData(0);for(var i=0;i<n;i++)c[i]=(Math.random()*2-1)*(Math.random()<.3?1:.4);
 var s=ac.createBufferSource(),bp=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;bp.type="bandpass";bp.Q.value=q||1;bp.frequency.setValueAtTime(f1,t);bp.frequency.exponentialRampToValueAtTime(f2,t+d);
 g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(bp);bp.connect(g);g.connect(ana);g.connect(yanki);s.start(t)}
function svgNokta(svg,e){var p=svg.createSVGPoint(),t=e.touches?e.touches[0]:e;p.x=t.clientX;p.y=t.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
/* I takımyıldızı: parmakla çiz */
(function(){var N="http://www.w3.org/2000/svg",P=[[150,250],[52,150],[84,62],[150,104],[216,62],[248,150],[150,250]],y=0,G=$("g-yildiz"),T=$("g-toz"),svg=$("gok"),cizer=!1,bitti1=!1,yz=[];
 for(var i=0;i<34;i++){var c=document.createElementNS(N,"circle");c.setAttribute("cx",Math.random()*300);c.setAttribute("cy",Math.random()*280);c.setAttribute("r",Math.random()*1.1+.3);c.setAttribute("class","toz");c.style.animationDelay=Math.random()*3+"s";T.appendChild(c)}
 var izler=document.createElementNS(N,"g");svg.insertBefore(izler,G);var canli=document.createElementNS(N,"line");canli.setAttribute("class","canli-cizgi");svg.insertBefore(canli,G);
 P.slice(0,6).forEach(function(p,i){var g=document.createElementNS(N,"g");g.setAttribute("class","yz"+(i===0?" sira":""));g.setAttribute("transform","translate("+p[0]+","+p[1]+")");
  g.innerHTML='<circle class="halka" r="15"/><circle class="h" r="40"/><path d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"/>';G.appendChild(g);yz.push(g)});
 function yak(k){var a=P[k-1],b=P[k],l=document.createElementNS(N,"line");l.setAttribute("x1",a[0]);l.setAttribute("y1",a[1]);l.setAttribute("x2",b[0]);l.setAttribute("y2",b[1]);l.setAttribute("class","iz");izler.appendChild(l);
  yz[k%6].classList.add("yan");yz.forEach(function(g){g.classList.remove("sira")});k<6&&yz[(k+1)%6].classList.add("sira");ac&&can(NT([72,74,76,79,81,84,88][k-1]),ac.currentTime,.12,(b[0]-150)/150);titre(12)}
 function ilk(){if(y===0&&!yz[0].classList.contains("yan")){yz[0].classList.add("yan");yz[0].classList.remove("sira");yz[1].classList.add("sira");ac&&can(NT(71),ac.currentTime,.1,0);titre(12)}}
 function bas(e){if(bitti1)return;e.preventDefault();cizer=!0;acSes();ilk();var p=svgNokta(svg,e),n=P[y+1];
  if(n&&Math.hypot(p.x-n[0],p.y-n[1])<46){y++;yak(y);y===6&&bitir()}hareket(e)}
 function hareket(e){if(!cizer)return;e.preventDefault();var p=svgNokta(svg,e),s=P[y];canli.setAttribute("x1",s[0]);canli.setAttribute("y1",s[1]);canli.setAttribute("x2",p.x);canli.setAttribute("y2",p.y);canli.style.opacity=1;
  var n=P[y+1];if(n&&Math.hypot(p.x-n[0],p.y-n[1])<42){y++;yak(y);if(y===6){bitir()}}}
 function birak(){cizer=!1;canli.style.opacity=0}
 function bitir(){bitti1=!0;cizer=!1;canli.style.opacity=0;$("g-yol").style.strokeDashoffset=0;ac&&arp(ac.currentTime+.2);titre([30,60,30,60,120]);$("g-yazi").textContent="Ve yıldızlar bir kalbe dönüştü.";
  setTimeout(function(){var kk=$("kalp3d");kk.classList.remove("gizli");$("gok").style.opacity=".25";if(window.Nesne3D){try{var K3=Nesne3D.kalp(kk,FOTO[3]);kk.classList.add("uc");var o2=window.bolumGecis;window.bolumGecis=function(n){o2&&o2(n);K3&&(K3.dur(),K3=null)}}catch(e){}}},1500);setTimeout(function(){bitti(1)},2400)}
 svg.addEventListener("pointerdown",bas);addEventListener("pointermove",hareket,{passive:!1});addEventListener("pointerup",birak);addEventListener("pointercancel",birak)})();
/* II basılı tut: kalp atışı */
(function(){var k=$("kutu"),h=$("tutHalka"),p=0,tut=!1,acildi=!1,son=0,tb=0,rot=0,surukle=null,Y3=null;
 var onceki=window.bolumGecis;window.bolumGecis=function(n){onceki&&onceki(n);if(n===2&&!Y3&&window.Nesne3D){try{Y3=Nesne3D.kutu($("kutu3d"));k.parentNode.classList.add("uc")}catch(e){Y3=null}}if(n!==2&&Y3){Y3.dur();Y3=null}};
 function bas(e){if(acildi)return;e.preventDefault();son=performance.now();tut=!0;acSes();$("tutNot").textContent="Bırakma…"}
 document.addEventListener("visibilitychange",function(){if(document.hidden)birak()});
 function birak(){tut=!1;!acildi&&p<1&&($("tutNot").textContent="Basılı tut")}
 k.addEventListener("pointerdown",bas);["pointerup","pointerleave","pointercancel"].forEach(function(n){k.addEventListener(n,birak)});
 (function d(z){if(!acildi){var dt=Math.max(0,(z-son)/1e3||0);son=z;p=Math.max(0,Math.min(1,p+(tut?dt/2.6:-dt/1.2)));
   h.style.strokeDashoffset=100-p*100;k.style.transform="rotateX(-12deg) translate("+(Math.random()-.5)*p*4+"px,"+(Math.random()-.5)*p*3+"px) scale("+(1+p*.06)+")";
   $("kutuParilti").style.opacity=p*.9;Y3&&Y3.ilerleme(p,tut);var aral=900-p*620;if(tut&&z-tb>aral){tb=z;kalpAtis(.35+p*.5);titre(25+p*30)}
   if(p>=1){acildi=!0;ac&&arp(ac.currentTime);gurultu(.5,.25,3000,9000,.6);titre([60,40,120]);k.style.transform="rotateX(-12deg)";k.classList.add("acik","patla");Y3&&(Y3.ilerleme(1,!1),Y3.ac());setTimeout(function(){$("kapak").style.display="none"},900);h.parentNode.classList.add("gizli");
    $("tutNot").textContent="Yüzüğü parmağınla çevir";$("k-yazi").textContent="Kalbim hâlâ o an gibi atıyor.";setTimeout(function(){$("aniFoto2").classList.remove("gizli")},1400);bitti(2)}}
  requestAnimationFrame(d)})(0);
 var y=k.querySelector(".yuzuk");k.addEventListener("pointerdown",function(e){acildi&&(surukle=e.clientX)});
 addEventListener("pointermove",function(e){if(surukle==null)return;rot+=(e.clientX-surukle)*1.4;Y3&&Y3.don(e.clientX-surukle);surukle=e.clientX;y.style.transform="rotateY("+rot+"deg)"});
 addEventListener("pointerup",function(){surukle=null})})();
/* III koçanı yırt */
(function(){var k=$("kocan"),b=$("bilet"),y0=null,dy=0,bitti3=!1;
 function bas(e){if(bitti3)return;e.preventDefault();acSes();y0=(e.touches?e.touches[0]:e).clientY;k.style.transition="none"}
 function hareket(e){if(y0==null)return;e.preventDefault();dy=Math.max(0,(e.touches?e.touches[0]:e).clientY-y0);k.style.transform="translateY("+dy*.9+"px) rotate("+dy*.06+"deg)";k.style.setProperty("--yirt",Math.min(1,dy/90));
  if(dy>18&&!k._s){k._s=1;gurultu(.25,.12,1800,600,1.2)}if(dy>95){kopar()}}
 function birak(){if(y0==null||bitti3)return;y0=null;k._s=0;k.style.transition="transform .5s cubic-bezier(.3,1.6,.5,1)";k.style.transform="";k.style.setProperty("--yirt",0)}
 function kopar(){bitti3=!0;y0=null;gurultu(.45,.35,2400,400,.9);titre([20,30,60]);k.style.transition="transform 1.3s cubic-bezier(.5,0,.8,.4), opacity 1.3s";k.style.transform="translate(40px,110vh) rotate(38deg)";k.style.opacity=0;
  setTimeout(function(){b.classList.add("damgali");ac&&ses&&(kalpAtis(.9),gurultu(.12,.4,400,200,.5));titre(50)},500);setTimeout(function(){b.classList.add("ucus")},850);
  setTimeout(function(){$("y-yazi").textContent="Sonra dünya, birlikte gezilecek bir yer oldu.";$("kocanNot").classList.add("gizli");bitti(3)},2800)}
 k.addEventListener("pointerdown",bas);addEventListener("pointermove",hareket,{passive:!1});addEventListener("pointerup",birak);addEventListener("pointercancel",birak)})();
/* IV kilit */
var K=[1,1,2020],SIN=[[1,31],[1,12],[2015,2026]];
function kyaz(){[].forEach.call(document.querySelectorAll(".tek"),function(t,i){var f=function(v){var a=SIN[i][0],b=SIN[i][1];v>b&&(v=a);v<a&&(v=b);return i<2?(v<10?"0":"")+v:""+v};t.querySelectorAll("button").forEach(btn=>btn.setAttribute("aria-label",["Gün","Ay","Yıl"][i]+(btn.dataset.y==="1"?" artır":" azalt")));t.querySelector("b").textContent=f(K[i]);t.setAttribute("data-u",f(K[i]-1));t.setAttribute("data-a",f(K[i]+1))})}
[].forEach.call(document.querySelectorAll(".tek .ok"),function(b){var i=+b.parentNode.getAttribute("data-i"),y=+b.getAttribute("data-y"),tm;
 function ad(){K[i]+=y;K[i]>SIN[i][1]&&(K[i]=SIN[i][0]);K[i]<SIN[i][0]&&(K[i]=SIN[i][1]);kyaz();acSes();ac&&ses&&nota(1200,ac.currentTime,.05,.04,"square")}
 b.addEventListener("click",ad);b.addEventListener("touchstart",function(){tm=setTimeout(function(){tm=setInterval(ad,90)},400)},{passive:!0});
 ["touchend","touchcancel"].forEach(function(n){b.addEventListener(n,function(){clearTimeout(tm);clearInterval(tm)})})});
kyaz();
[].forEach.call(document.querySelectorAll(".tek"),function(t){var i=+t.getAttribute("data-i"),y0=null,b=t.querySelector("b");
 t.addEventListener("pointerdown",function(e){if(e.target.classList.contains("ok"))return;e.preventDefault();acSes();y0=e.clientY;t.classList.add("cevir")});
 addEventListener("pointermove",function(e){if(y0==null)return;var d=y0-e.clientY,adim=Math.trunc(d/22);b.style.transform="translateY("+(-(d%22))*.6+"px)";
  if(adim){y0-=adim*22;K[i]+=adim;while(K[i]>SIN[i][1])K[i]-=SIN[i][1]-SIN[i][0]+1;while(K[i]<SIN[i][0])K[i]+=SIN[i][1]-SIN[i][0]+1;kyaz();ac&&ses&&gurultu(.03,.18,3200,2600,4);titre(6)}});
 addEventListener("pointerup",function(){if(y0==null)return;y0=null;b.style.transform="";t.classList.remove("cevir")})});
var cevap=[];
$("b1x").addEventListener("click",function(){var p=function(n){return(n<10?"0":"")+n},v=K[2]+"-"+p(K[1])+"-"+p(K[0]);if(hs(v)!==SORULAR[0].h)return sall("O gün değildi… bir daha düşün.");
 cevap=[v];document.querySelector(".kilit").classList.add("acildi");acSes();ding(3);this.disabled=true;turnPage($("b4"),ac2,"#hero .baslik")});
document.addEventListener("contextmenu",function(e){e.preventDefault()});

function tarihYaz(v){var p=v.split("-"),ay=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];return +p[2]+" "+ay[+p[1]-1]+" "+p[0]}
function ac2(){$("e1").classList.remove("acik");$("e2").classList.add("acik");$("sahne").classList.add("acik");$("ses").style.display="block";
 $("ilerle").classList.remove("gor");document.body.classList.remove("film");heroDon();setInterval(heroDon,5200);var t=$("tunel");[["İlk buluşma","Yıldızların altında"],["İlk teklif","Bir kutu, bir evet"],["İlk yolculuk","Yan yana iki koltuk"],["Evlendik",tarihYaz(cevap[0])]].forEach(function(q,i){var d=document.createElement("div");d.style.animationDelay=(1.2+i*.35)+"s";d.innerHTML="<b>"+q[0]+"</b><span>"+q[1]+"</span>";t.appendChild(d)});
 var gun=Math.floor((Date.now()-new Date(EVLILIK+"T00:00:00").getTime())/864e5);sayac(Math.max(gun,0));
 yagmurBasla();yag(70);muzik();titre([40,80,40,80,120]);daktilo();
 setTimeout(function(){var ok=!1;try{ok=sahneBaslat($("sahne"),null,FOTO)}catch(e){}ok||($("yedek").style.display="block")},60)}
function sayac(n){var s=performance.now(),D=2200;(function f(t){var x=Math.min((t-s)/D,1),e=1-Math.pow(1-x,3);$("sayac").textContent=Math.round(n*e);x<1&&requestAnimationFrame(f)})(s)}

/* daktilo mektup */
var MT=null;function daktilo(){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var m=$("mektup");MT=MT||m.textContent.replace(/\s+/g," ").trim();m.textContent="";var i=0,im=document.createElement("span");im.className="imlec";
 setTimeout(function y(){m.textContent=MT.slice(0,++i);m.appendChild(im);if(i<MT.length)setTimeout(y,/[.,:…]/.test(MT[i-1])?260:32);else setTimeout(function(){im.remove()},2500)},2600)}
/* geri sayım: 2. yıl dönümü */
setInterval(function(){var h=new Date(EVLILIK+"T00:00:00");h.setFullYear(h.getFullYear()+2);var d=Math.max(0,h-Date.now())/1e3,p=function(n){return(n<10?"0":"")+n},b=document.querySelectorAll("#geri b");if(!b.length)return;
 b[0].textContent=Math.floor(d/86400);b[1].textContent=p(Math.floor(d%86400/3600));b[2].textContent=p(Math.floor(d%3600/60));b[3].textContent=p(Math.floor(d%60))},1e3);
/* şimdi ne yapmak istersin */
var YD_H=[3795455870, 107042714, 3960265003],ydAcik=!1;
function norm(x){return x.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9]/g,"")}
function sec(b){[].forEach.call(document.querySelectorAll(".sec"),function(x){x.classList.toggle("secili",x===b)});var t=b.getAttribute("data-s");
 $("yd").classList.add("gizli");$("secMetin").textContent=t+" ✓";$("secildi").classList.remove("gizli");
 $("gonder").href="https://wa.me/?text="+encodeURIComponent("Serdar, seçimimi yaptım: "+t+" 💛");yag(60);ding(2);titre([30,50,30])}
[].forEach.call(document.querySelectorAll(".sec"),function(b){b.addEventListener("click",function(e){e.stopPropagation();
 if(b.id==="yurtdisi"&&!ydAcik){$("secildi").classList.add("gizli");$("yd").classList.remove("gizli");$("ydc").focus();return}sec(b)})});
function ydKontrol(){var v=norm($("ydc").value);if(!v)return;if(YD_H.indexOf(hs(v))<0){$("ydh").textContent="Olmadı… bir daha düşün.";titre(80);return}
 ydAcik=!0;var b=$("yurtdisi");b.classList.remove("kilitli");b.classList.add("acik-kilit");b.querySelector("b").textContent="Yurt dışı gezisi ✈️";b.querySelector("small").textContent="Kilit açıldı, bavulları hazırla";$("ydh").textContent="";sec(b);setTimeout(kaziBasla,900)}
$("ydb").addEventListener("click",function(e){e.stopPropagation();ydKontrol()});
$("ydc").addEventListener("keydown",function(e){(e.key==="Enter"||e.keyCode===13)&&(e.preventDefault(),ydKontrol())});
/* kazı kazan bilet */
var kaziOk=!1;function kaziBasla(){if(kaziOk)return;kaziOk=!0;$("kaziAlan").classList.remove("gizli");var k=$("kazi"),cv=$("kaziTuval"),x=cv.getContext("2d"),r=Math.min(devicePixelRatio||1,2),W=k.clientWidth,H=k.clientHeight;
 cv.width=W*r;cv.height=H*r;x.scale(r,r);var g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,"#f3e2bd");g.addColorStop(.35,"#c9a462");g.addColorStop(.55,"#f6e7c4");g.addColorStop(1,"#a8823f");x.fillStyle=g;x.fillRect(0,0,W,H);
 for(var i=0;i<900;i++){x.fillStyle="rgba(255,255,255,"+Math.random()*.25+")";x.fillRect(Math.random()*W,Math.random()*H,1,1)}
 x.fillStyle="#3a2412";x.textAlign="center";x.font="600 26px 'Cormorant Garamond', Georgia, serif";x.fillText("✦  Kazı  ✦",W/2,H/2);x.font="500 10px Jost, sans-serif";x.fillText("H E D İ Y E N   B U R A D A",W/2,H/2+24);
 x.globalCompositeOperation="destination-out";x.lineCap=x.lineJoin="round";x.lineWidth=38;var basili=!1,son=null,say=0,bitti=!1;
 function nok(e){var b=cv.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return[t.clientX-b.left,t.clientY-b.top]}
 function ciz(e){if(!basili||bitti)return;e.preventDefault();var p=nok(e);x.beginPath();x.moveTo((son||p)[0],(son||p)[1]);x.lineTo(p[0],p[1]);x.stroke();son=p;if(++say%12===0){olc();say%36===0&&ac&&ses&&piyano(1800+Math.random()*600,ac.currentTime,.4,.015,0)}}
 function olc(){var d=x.getImageData(0,0,cv.width,cv.height).data,b=0,n=0;for(var i=3;i<d.length;i+=64){n++;d[i]===0&&b++}if(b/n>.55&&!bitti){bitti=!0;k.classList.add("bitti");$("kaziNot").textContent="Viyana, geliyoruz ✈";yag(160);[0,1,2,3].forEach(function(i){setTimeout(function(){ding(i)},i*220)});titre([60,40,60,40,200])}}
 ["mousedown","touchstart"].forEach(function(n){cv.addEventListener(n,function(e){basili=!0;son=null;ciz(e)},{passive:!1})});
 ["mousemove","touchmove"].forEach(function(n){cv.addEventListener(n,ciz,{passive:!1})});
 ["mouseup","mouseleave","touchend","touchcancel"].forEach(function(n){cv.addEventListener(n,function(){basili=!1;son=null})});
 $("kaziAlan").scrollIntoView({behavior:"smooth",block:"center"})}
/* canlı sayaç, kuponlar, kaçan buton */
setInterval(function(){var d=Date.now()-new Date(EVLILIK+"T00:00:00").getTime();if(d<0)return;var s=Math.floor(d/1e3)%86400,p=function(n){return(n<10?"0":"")+n};$("canli").textContent="+ "+p(s/3600|0)+" saat "+p((s%3600)/60|0)+" dakika "+p(s%60)+" saniye"},1e3);
[].forEach.call(document.querySelectorAll(".kupon"),function(k,i){k.addEventListener("click",function(e){e.stopPropagation();k.classList.toggle("cevrik");ding(i)})});
var kac=0,soz=["Hayır","Emin misin?","Yakalayamazsın","Bir daha düşün","Pes et"];
function kacir(e){e&&e.preventDefault();e&&e.stopPropagation();var h=$("hayir");kac++;h.style.left=(3+Math.random()*52)+"%";h.style.top=(Math.random()*70)+"px";h.textContent=soz[Math.min(kac,soz.length-1)];$("evet").style.transform="scale("+Math.min(1+kac*.08,1.5)+")"}
["pointerdown","touchstart","mouseenter","click"].forEach(function(n){$("hayir").addEventListener(n,kacir,{passive:!1})});
$("evet").addEventListener("click",function(e){e.stopPropagation();$("hayir").style.display="none";$("sonuc").textContent="Biliyordum. Seni seviyorum.";setTimeout(function(){$("secim").classList.remove("gizli");$("secim").scrollIntoView({behavior:"smooth",block:"start"})},2200);titre([60,60,60,60,200]);yag(200);[0,1,2,3].forEach(function(i){setTimeout(function(){ding(i);yag(40,Math.random()*innerWidth)},i*260)})});
/* ses */
var ana=null,yanki=null;
function acSes(){var A=window.AudioContext||window.webkitAudioContext;if(!ac&&A){ac=new A;
 ana=ac.createGain();ana.gain.value=.9;var lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.value=5200;ana.connect(lp);
 var cmp=ac.createDynamicsCompressor();cmp.threshold.value=-18;cmp.ratio.value=3;lp.connect(cmp);cmp.connect(ac.destination);
 yanki=ac.createConvolver();var sr=ac.sampleRate,uz=sr*2.8|0,ir=ac.createBuffer(2,uz,sr);for(var c=0;c<2;c++){var d=ir.getChannelData(c);for(var n=0;n<uz;n++)d[n]=(Math.random()*2-1)*Math.pow(1-n/uz,2.6)}
 yanki.buffer=ir;var yg=ac.createGain();yg.gain.value=.38;yanki.connect(yg);yg.connect(cmp)}
 ac&&ac.state==="suspended"&&ac.resume()}
/* yumuşak piyano: harmonikli, çekiçli, yankılı */
function piyano(f,t,d,v,pan){if(!ac||!ses)return;var g=ac.createGain(),p=ac.createStereoPanner?ac.createStereoPanner():null;
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(v*.35,t+.35);g.gain.exponentialRampToValueAtTime(.0005,t+d);
 [[1,1,0],[2,.42,3],[3,.16,-4],[4,.07,5],[1,.5,-7]].forEach(function(h){var o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.value=f*h[0];o.detune.value=h[2];og.gain.value=h[1]/(1+(h[0]-1)*f/900);
  o.connect(og);og.connect(g);o.start(t);o.stop(t+d+.05)});
 var out=g;if(p){p.pan.value=pan||0;g.connect(p);out=p}out.connect(ana);out.connect(yanki)}
/* yaylı pad */
function pad(fs,t,d,v){if(!ac||!ses)return;fs.forEach(function(f,k){var o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),lp=ac.createBiquadFilter();o.type=o2.type="sawtooth";o.frequency.value=f;o2.frequency.value=f;o.detune.value=-6;o2.detune.value=7;
 lp.type="lowpass";lp.frequency.value=900;lp.Q.value=.3;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v/fs.length,t+d*.4);g.gain.linearRampToValueAtTime(0,t+d);
 o.connect(lp);o2.connect(lp);lp.connect(g);g.connect(ana);g.connect(yanki);o.start(t);o2.start(t);o.stop(t+d+.1);o2.stop(t+d+.1)})}
function nota(f,t,d,v){piyano(f,t,Math.max(d,1),v*1.6,0)}
function ding(i){if(!ac)return;var t=ac.currentTime;[1318.5,1568,1975.5,2637].slice(0,2+i%3).forEach(function(f,j){piyano(f,t+j*.11,2.2,.07,j%2?.4:-.4)})}
function titre(m){try{navigator.vibrate&&navigator.vibrate(m)}catch(e){}}
/* özgün Paris valsi: akordeon (musette) + piyano ostinato. Melodi bu sayfaya özgüdür. */
var NT=function(n){return 440*Math.pow(2,(n-69)/12)};
function akordeon(f,t,d,v){if(!ac||!ses)return;var g=ac.createGain(),bp=ac.createBiquadFilter(),lfo=ac.createOscillator(),lg=ac.createGain();bp.type="lowpass";bp.frequency.value=2600;bp.Q.value=.7;
 lfo.frequency.value=5.2;lg.gain.value=v*.18;lfo.connect(lg);lg.connect(g.gain);
 [-11,0,12].forEach(function(dt,k){var o=ac.createOscillator();o.type=k===1?"sawtooth":"square";o.frequency.value=f;o.detune.value=dt;var og=ac.createGain();og.gain.value=k===1?.55:.22;o.connect(og);og.connect(bp);o.start(t);o.stop(t+d+.15)});
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.05);g.gain.setValueAtTime(v*.85,t+Math.max(.06,d-.08));g.gain.linearRampToValueAtTime(0,t+d+.1);
 bp.connect(g);g.connect(ana);g.connect(yanki);lfo.start(t);lfo.stop(t+d+.15)}
function muzik(){if(!ac||muz)return;
 var A=[[45,57,60,64],[45,57,60,64],[40,56,59,62],[40,56,59,64],[38,57,62,65],[43,59,62,65],[36,55,60,64],[40,56,59,64],
        [41,57,60,65],[41,57,60,65],[38,57,62,65],[40,56,59,62],[45,57,60,64],[38,57,62,65],[40,56,59,64],[45,57,60,64]],
 M=[[76,0,2],[77,2,1],[76,3,1],[74,4,1],[72,5,1],[71,6,2],[72,8,1],[74,9,2],[76,11,1],[79,12,2],[77,14,1],[76,15,1],[74,16,1],[72,17,1],[74,18,3],[71,21,1],[72,22,1],[74,23,1],
    [72,24,2],[74,26,1],[76,27,1.5],[77,28.5,.5],[79,29,1],[81,30,2],[79,32,1],[77,33,1],[76,34,1],[74,35,1],[72,36,2],[71,38,1],[69,39,3],[68,42,1],[69,43,2],[0,45,3]],
 bt=60/138,bar=3*bt,dev=A.length*bar,bas=ac.currentTime+.3,tur=0;
 function plan(){var t0=bas+tur*dev;if(t0>ac.currentTime+1.5)return;
  A.forEach(function(ch,b){var t=t0+b*bar;
   piyano(NT(ch[0]),t,bar*.9,.12,-.25);piyano(NT(ch[0]+7),t+bt*.0,bar*.5,.03,-.2);
   [1,2].forEach(function(k){akordeon(NT(ch[1]),t+k*bt,bt*.55,.022);akordeon(NT(ch[2]),t+k*bt,bt*.55,.02);akordeon(NT(ch[3]),t+k*bt,bt*.55,.018)});
   tur>0&&[0,1,2,3,4,5].forEach(function(k){piyano(NT(ch[[1,2,3,2,3,2][k]]+12),t+k*bt/2,bt*1.2,.022,.35)})});
  M.forEach(function(m){if(!m[0])return;var tt=t0+m[1]*bt,d=m[2]*bt;akordeon(NT(m[0]),tt,d*.92,.05);tur%2&&piyano(NT(m[0]+12),tt,Math.max(d*1.5,.8),.035,.15)});
  tur++}
 plan();muz=setInterval(plan,400)}
$("ses").addEventListener("click",function(e){e.stopPropagation();ses=!ses;this.textContent=ses?"🔊":"🔇";ac&&ac[ses?"resume":"suspend"]()});

/* kalp yağmuru */
var P=[],cv,cx,img=[];
function sp(w,h,fn){var c=document.createElement("canvas"),r=2;c.width=w*r;c.height=h*r;var x=c.getContext("2d");x.scale(r,r);fn(x,w,h);return c}
function kalpCiz(x,w,h,r1,r2){x.save();x.translate(w/2,h/2);x.scale(w/34,h/32);var g=x.createRadialGradient(-5,-6,1,0,0,20);g.addColorStop(0,r1);g.addColorStop(1,r2);x.fillStyle=g;x.beginPath();x.moveTo(0,10);x.bezierCurveTo(-18,-2,-12,-16,0,-8);x.bezierCurveTo(12,-16,18,-2,0,10);x.fill();x.restore()}
function hazirla(){[["#f6d9df","#c9456e"],["#fbf0d6","#d9b77a"],["#fff","#e7a9b8"]].forEach(function(c){img.push(sp(30,28,function(x,w,h){kalpCiz(x,w,h,c[0],c[1])}))});
 img.push(sp(22,14,function(x){var g=x.createLinearGradient(0,0,22,14);g.addColorStop(0,"#f3e2bd");g.addColorStop(1,"#b8904f");x.fillStyle=g;x.beginPath();x.ellipse(11,7,10,5.5,0,0,6.3);x.fill()}))}
function ekle(px,py){P.push({x:px,y:py,s:img[Math.random()*img.length|0],vy:.9+Math.random()*1.8,f:Math.random()*6.3,a:Math.random()*6.3,va:(Math.random()-.5)*.04,z:.6+Math.random()*.7})}
function yag(n,x0){for(var i=0;i<n;i++)ekle(x0===void 0?Math.random()*innerWidth:x0+(Math.random()-.5)*150,-30-Math.random()*innerHeight*.8);P.length>240&&P.splice(0,P.length-240)}
function yagmurBasla(){hazirla();cv=$("yagmur");cx=cv.getContext("2d");function rs(){cv.width=innerWidth;cv.height=innerHeight}rs();addEventListener("resize",rs);
 (function d(){cx.clearRect(0,0,cv.width,cv.height);P.length<26&&Math.random()<.35&&ekle(Math.random()*cv.width,-30);for(var i=P.length-1;i>=0;i--){var p=P[i];p.y+=p.vy;p.f+=.04;p.a+=p.va;p.x+=Math.sin(p.f)*.8;if(p.y>cv.height+30){P.splice(i,1);continue}var w=p.s.width/2*p.z,h=p.s.height/2*p.z;cx.save();cx.translate(p.x,p.y);cx.rotate(p.a);cx.scale(Math.max(.3,Math.abs(Math.cos(p.f))),1);cx.drawImage(p.s,-w/2,-h/2,w,h);cx.restore()}requestAnimationFrame(d)})()}
document.addEventListener("click",function(e){$("e2").classList.contains("acik")&&!/INPUT|BUTTON/.test(e.target.tagName)&&(yag(30,e.clientX),ding(Math.random()*4|0))});
})();
