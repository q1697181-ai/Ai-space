// ===== Фото: положи face1.jpg, face2.jpg, hedgehog.png рядом с этими файлами =====
const $=i=>document.getElementById(i),cv=$('c'),g=cv.getContext('2d'),W=960,H=540;
const im=s=>{const i=new Image();i.src=s;return i};
const FACE=[im('face1.jpg'),im('face2.jpg')],HEDGE=im('hedgehog.png');
const K={},WEIGHTS=[20,50,100,150];
const S={mode:'select',me:0,str:0,money:0,sta:100,tired:0,w:20,x:480,y:340,dir:1,walk:0,mv:0,lift:0,boss:0,t:0,shake:0,cut:0,msgT:0,
  opp:null,pos:50,cd:0,buddy:{x:300,y:300,tx:300,ty:300,wait:1,lift:0,dir:1,mv:0}};
const ST=[
 {n:'Жим лёжа',x:170,y:210,t:'lift',k:1.2},
 {n:'Гантели',x:450,y:190,t:'lift',k:.9},
 {n:'Приседания',x:730,y:210,t:'lift',k:1.5},
 {n:'Магазин (30$)',x:130,y:440,t:'shop'},
 {n:'АРМРЕСЛИНГ',x:790,y:440,t:'arm'}];
const OP=[
 {n:'Новичок Вася',p:10,r:40,c:'#4aa3ff',s:25},
 {n:'Качок Серёга',p:16,r:80,c:'#ff7a45',s:60,buddy:1},
 {n:'Мастер Гоша',p:22,r:150,c:'#9b59b6',s:85},
 {n:'ГИГАНТ-ЁЖ',p:27,r:1000,c:'#8a6d3b',s:100,boss:1}];

// ---------- ввод ----------
addEventListener('keydown',e=>{K[e.code]=1;
 if(e.code=='Space'){e.preventDefault();pull()}
 if(e.code=='KeyE')act();
 const n='Digit'==e.code.slice(0,5)?+e.code.slice(5):0;if(n>=1&&n<=4)setW(n-1)});
addEventListener('keyup',e=>K[e.code]=0);
document.querySelectorAll('#pad button').forEach(b=>{
 const k=b.dataset.k;
 b.addEventListener('pointerdown',e=>{e.preventDefault();K[k]=1;if(k=='KeyE')act()});
 ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>K[k]=0))});
$('pull').addEventListener('pointerdown',e=>{e.preventDefault();pull()});
WEIGHTS.forEach((w,i)=>{const b=document.createElement('button');b.textContent=w;b.onclick=()=>setW(i);$('wbtns').appendChild(b)});
function setW(i){S.w=WEIGHTS[i];[...$('wbtns').children].forEach((b,j)=>b.classList.toggle('on',j==i))}
setW(0);

function say(m,t=2.6){const e=$('msg');e.textContent=m;e.classList.add('show');S.msgT=t}
function startGame(i){S.me=i;S.mode='gym';$('select').classList.add('hidden');
 say('Подойди к снаряду и нажми E. Не забывай отдыхать!',4)}

// ---------- действия ----------
const maxLift=()=>20+S.str*2.2;
function near(){let b=null,bd=90;ST.forEach(s=>{const d=Math.hypot(s.x+50-S.x,s.y+50-S.y);if(d<bd){bd=d;b=s}});return b}
function act(){
 if(S.mode!='gym'||S.lift>0)return;const s=near();if(!s)return;
 if(s.t=='lift'){
  if(S.tired||S.sta<12){S.tired=1;return say('Ты устал! Постой и отдышись 😮‍💨')}
  if(S.w>maxLift()){S.shake=.4;return say('Слишком тяжело! Сейчас максимум ~'+Math.floor(maxLift())+' кг 🥵')}
  S.lift=.7;S.sta-=12;
  const gain=(S.w/50+.4)*s.k,cash=Math.round(S.w/10*s.k)+3;
  S.str=Math.min(100,S.str+gain);S.money+=cash;say('+'+gain.toFixed(1)+' силы, +'+cash+'$',1.2);
  if(S.str>=100&&!S.boss)setTimeout(()=>{S.mode='cut';S.cut=0},700);
 }else if(s.t=='shop'){
  if(S.money<30)return say('Не хватает денег на протеин (30$)');
  S.money-=30;S.sta=Math.min(100,S.sta+50);S.tired=0;say('Протеиновый коктейль! +50 выносливости 🥤');
 }else if(s.t=='arm'){openArm()}
}
function openArm(){
 const m=$('armMenu');m.innerHTML='<h1 style="font-size:40px">АРМРЕСЛИНГ</h1><p>Выбери противника</p>';
 OP.forEach(o=>{const b=document.createElement('button');b.className='opp';
  const lock=o.boss&&!S.boss;b.disabled=lock;
  b.textContent=lock?'🔒 Финальный босс (стань качком)':o.n+' — награда '+o.r+'$';
  b.onclick=()=>startArm(o);m.appendChild(b)});
 const c=document.createElement('button');c.className='opp';c.textContent='Назад';c.onclick=()=>m.classList.add('hidden');m.appendChild(c);
 m.classList.remove('hidden')}
function startArm(o){S.opp=o;S.pos=50;S.cd=3;S.mode='arm';$('armMenu').classList.add('hidden');$('pull').classList.remove('hidden')}
function pull(){if(S.mode=='arm'&&S.cd<=0){S.pos+=1.2+S.str*.03;S.press=.1}}

// ---------- обновление ----------
function update(dt){
 S.t+=dt;if(S.msgT>0){S.msgT-=dt;if(S.msgT<=0)$('msg').classList.remove('show')}
 if(S.shake>0)S.shake-=dt;
 if(S.mode=='gym'){
  let dx=(K.ArrowRight||K.KeyD?1:0)-(K.ArrowLeft||K.KeyA?1:0),dy=(K.ArrowDown||K.KeyS?1:0)-(K.ArrowUp||K.KeyW?1:0);
  S.mv=dx||dy?1:0;const run=(K.ShiftLeft||K.ShiftRight)&&S.mv&&S.sta>2&&!S.tired&&S.lift<=0;
  if(S.mv&&S.lift<=0){const l=Math.hypot(dx,dy),sp=S.tired?60:run?210:110;
   S.x=Math.max(50,Math.min(W-50,S.x+dx/l*sp*dt));S.y=Math.max(150,Math.min(H-30,S.y+dy/l*sp*dt));
   if(dx)S.dir=dx<0?-1:1;S.walk+=dt*(run?1.6:1)}
  if(run)S.sta-=9*dt;else S.sta+=(S.mv?1.5:5)*dt;
  S.sta=Math.max(0,Math.min(100,S.sta));
  if(S.sta<=1)S.tired=1;if(S.tired&&S.sta>30){S.tired=0;say('Силы вернулись!',1.5)}
  if(S.lift>0)S.lift-=dt;
  const b=S.buddy;if(b.lift>0)b.lift-=dt;
  const ddx=b.tx-b.x,ddy=b.ty-b.y,d=Math.hypot(ddx,ddy);b.mv=d>4;
  if(b.mv){b.x+=ddx/d*85*dt;b.y+=ddy/d*85*dt;b.dir=ddx<0?-1:1}
  else{b.wait-=dt;if(b.lift<=0&&Math.random()<dt*.9)b.lift=.7;
   if(b.wait<0){const s=ST[Math.random()*3|0];b.tx=s.x+50+(Math.random()*60-30);b.ty=s.y+90;b.wait=4+Math.random()*4}}
 }else if(S.mode=='cut'){S.cut+=dt;if(S.cut>8){S.mode='gym';S.boss=1;say('Ёжик ждёт тебя за столом армрестлинга! 🦔',5)}}
 else if(S.mode=='arm'){
  if(S.press>0)S.press-=dt;
  if(S.cd>0){S.cd-=dt;return}
  S.pos-=S.opp.p*(.75+.5*Math.sin(S.t*4))*dt;
  if(S.pos>=100)endArm(1);else if(S.pos<=0)endArm(0)}
}
function endArm(w){$('pull').classList.add('hidden');
 if(w){S.money+=S.opp.r;if(S.opp.boss){S.mode='end';$('end').classList.remove('hidden');return}
  say('Победа над '+S.opp.n+'! +'+S.opp.r+'$ 🏆',3.5)}
 else say('Ты проиграл '+S.opp.n+'. Качайся дальше!',3);
 S.mode='gym'}

// ---------- рисование ----------
function head(x,y,r,f,sp){
 g.save();g.translate(x,y);
 if(sp){g.fillStyle='#5b4636';for(let i=0;i<22;i++){const a=i/22*6.283;g.beginPath();
  g.moveTo(Math.cos(a-.14)*r,Math.sin(a-.14)*r);g.lineTo(Math.cos(a)*r*1.4,Math.sin(a)*r*1.4);g.lineTo(Math.cos(a+.14)*r,Math.sin(a+.14)*r);g.fill()}}
 g.beginPath();g.arc(0,0,r,0,7);g.clip();
 if(f&&f.complete&&f.naturalWidth){const w=f.naturalWidth,h=f.naturalHeight,m=Math.min(w,h);
  g.drawImage(f,(w-m)/2,(h-m)*.25,m,m,-r,-r,2*r,2*r)}
 else{g.fillStyle=sp?'#e9cfa4':'#f0c8a0';g.fillRect(-r,-r,2*r,2*r);
  g.fillStyle='#3b2a1e';g.fillRect(-r,-r,2*r,r*.5);
  g.fillStyle='#000';g.fillRect(-r*.5,-r*.1,r*.22,r*.22);g.fillRect(r*.28,-r*.1,r*.22,r*.22);
  g.strokeStyle='#000';g.lineWidth=2;g.beginPath();g.arc(0,r*.25,r*.4,.2,2.9);g.stroke()}
 g.restore();g.strokeStyle='#0006';g.lineWidth=2;g.beginPath();g.arc(x,y,r,0,7);g.stroke()}

function jock(x,y,str,face,o={}){
 const k=Math.min(1,str/100),bw=22+k*34,sw=o.mv?Math.sin(S.walk*12)*9:0,bob=o.mv?Math.abs(Math.sin(S.walk*12))*3:0,
  ar=8+k*11,up=o.up||0,skin='#e2a97e',sc=o.s||1;
 g.save();g.translate(x,y-bob);g.scale((o.dir||1)*sc,sc);
 g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(0,bob,bw*.8,8,0,0,7);g.fill();
 g.fillStyle='#1d3557';g.fillRect(-bw/2+3+sw*.4,-34,bw/2-5,32);g.fillRect(2-sw*.4,-34,bw/2-5,32);
 g.fillStyle='#111';g.fillRect(-bw/2+1+sw*.4,-4,bw/2,5);g.fillRect(1-sw*.4,-4,bw/2,5);
 // руки
 const hands=[];
 [-1,1].forEach(s=>{const sx=s*(bw/2+3),sy=-76,hx=s*(bw/2+ar*.7+4+up*.15),hy=sy+34-up*1.6;
  g.strokeStyle=skin;g.lineCap='round';g.lineWidth=ar*1.25;g.beginPath();g.moveTo(sx,sy);g.lineTo(hx,hy);g.stroke();
  if(k>.25||o.flex){g.fillStyle='#d69569';g.beginPath();g.arc((sx+hx)/2+s*2,(sy+hy)/2-(o.flex?8:0),ar*(o.flex?1.25:.85),0,7);g.fill()}
  hands.push([hx,hy])});
 // торс
 g.fillStyle=o.col||'#ff5a1f';g.beginPath();g.moveTo(-bw/2-6,-84);g.lineTo(bw/2+6,-84);g.lineTo(bw/2-6,-32);g.lineTo(-bw/2+6,-32);g.fill();
 g.fillStyle=skin;g.fillRect(-4,-92,8,10);
 if(o.bar){const[a,b]=hands,yy=a[1];g.strokeStyle='#bbb';g.lineWidth=4;g.beginPath();g.moveTo(a[0]-30,yy);g.lineTo(b[0]+30,yy);g.stroke();
  g.fillStyle='#222';[a[0]-30,b[0]+30].forEach(px=>g.fillRect(px-4,yy-14,8,28))}
 head(0,-108,21,face,o.sp);
 g.restore()}

function room(){
 const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#c9ced9');gr.addColorStop(.28,'#aab0c0');gr.addColorStop(.281,'#3a2f2a');gr.addColorStop(1,'#241c1a');
 g.fillStyle=gr;g.fillRect(0,0,W,H);
 g.fillStyle='#8ec9ff55';for(let i=0;i<4;i++){g.fillRect(60+i*230,30,170,90);g.strokeStyle='#eee';g.lineWidth=4;g.strokeRect(60+i*230,30,170,90)}
 g.fillStyle='#ff5a1f';g.font='bold 22px Trebuchet MS';g.textAlign='center';g.fillText('NO PAIN — NO GAIN',W/2,20);
 g.strokeStyle='#ffffff10';g.lineWidth=2;for(let y=160;y<H;y+=48){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
 ST.forEach(s=>{const x=s.x,y=s.y,n=near()==s&&S.mode=='gym';
  if(n){g.fillStyle='#ffd23f33';g.fillRect(x-10,y-25,130,140)}
  if(s.n=='Жим лёжа'){g.fillStyle='#333';g.fillRect(x+10,y+55,90,18);g.fillStyle='#6a0dad';g.fillRect(x+20,y+45,70,12);g.fillStyle='#999';g.fillRect(x+15,y,4,50);g.fillRect(x+91,y,4,50);
   g.fillStyle='#bbb';g.fillRect(x-5,y+2,120,5);g.fillStyle='#111';g.fillRect(x-5,y-8,10,26);g.fillRect(x+105,y-8,10,26)}
  else if(s.n=='Гантели'){g.fillStyle='#444';g.fillRect(x,y+35,110,50);for(let i=0;i<5;i++){g.fillStyle=['#e33','#eb3','#3b7','#38f','#a3f'][i];g.fillRect(x+8+i*20,y+40,14,10);g.beginPath();g.arc(x+15+i*20,y+65,8,0,7);g.fill()}}
  else if(s.n=='Приседания'){g.fillStyle='#999';g.fillRect(x+10,y-5,6,90);g.fillRect(x+94,y-5,6,90);g.fillRect(x+5,y+80,100,6);g.fillStyle='#bbb';g.fillRect(x-10,y+10,130,5);g.fillStyle='#111';g.fillRect(x-10,y,9,25);g.fillRect(x+111,y,9,25)}
  else if(s.t=='shop'){g.fillStyle='#2c7a4b';g.fillRect(x,y+30,110,55);g.fillStyle='#fff';g.font='34px serif';g.fillText('🥤',x+55,y+70)}
  else{g.fillStyle='#7b4a1e';g.fillRect(x,y+35,110,50);g.fillStyle='#111';g.fillRect(x+15,y+30,20,8);g.fillRect(x+75,y+30,20,8);g.fillStyle='#fff';g.font='30px serif';g.fillText('💪',x+55,y+70)}
  g.fillStyle=n?'#ffd23f':'#fff';g.font='bold 15px Trebuchet MS';g.textAlign='center';g.fillText(s.n+(n?'  [E]':''),x+55,y+105)})}

function drawGym(){
 room();
 const b=S.buddy,lp=S.lift>0?Math.sin((1-S.lift/.7)*Math.PI)*40:0,bp=b.lift>0?Math.sin((1-b.lift/.7)*Math.PI)*40:0;
 const list=[{y:S.y,f:()=>jock(S.x,S.y,S.str,FACE[S.me],{dir:S.dir,mv:S.mv&&S.lift<=0,up:lp,bar:S.lift>0,col:'#ff5a1f'})},
  {y:b.y,f:()=>jock(b.x,b.y,Math.min(100,30+S.str*.6),FACE[1-S.me],{dir:b.dir,mv:b.mv,up:bp,bar:b.lift>0,col:'#2e86de'})}];
 list.sort((a,c)=>a.y-c.y).forEach(o=>o.f());
 if(S.tired){g.fillStyle='#fff';g.font='26px serif';g.fillText('💦',S.x+22,S.y-140)}
}

function drawArm(){
 room();g.fillStyle='#0008';g.fillRect(0,0,W,H);
 const o=S.opp,px=270,ox=690;
 g.fillStyle='#7b4a1e';g.fillRect(340,400,280,120);g.fillStyle='#5b3512';g.fillRect(340,400,280,14);
 const bodyP=g.fillStyle=(g.fillStyle='#ff5a1f');
 g.fillStyle='#ff5a1f';g.fillRect(px-70,300,140,240);g.fillStyle=o.c;g.fillRect(ox-(o.boss?95:70),o.boss?270:300,o.boss?190:140,240);
 head(px,240,52,FACE[S.me]);head(ox,o.boss?200:240,o.boss?85:52,o.buddy?FACE[1-S.me]:o.boss?HEDGE:null,o.boss);
 const hx=480+(S.pos-50)*2.4,hy=395-(50-Math.abs(S.pos-50))*.9,sh=S.press>0?4:0;
 g.lineCap='round';g.strokeStyle='#e2a97e';g.lineWidth=34;g.beginPath();g.moveTo(400,430);g.lineTo(hx+sh,hy);g.stroke();
 g.lineWidth=o.boss?46:34;g.beginPath();g.moveTo(560,430);g.lineTo(hx,hy);g.stroke();
 g.fillStyle='#d69569';g.beginPath();g.arc(hx,hy,24,0,7);g.fill();
 // шкала
 g.fillStyle='#000a';g.fillRect(180,40,600,30);g.fillStyle='#37d67a';g.fillRect(184,44,592*S.pos/100,22);
 g.fillStyle='#fff';g.font='bold 18px Trebuchet MS';g.textAlign='center';g.fillText('ТЫ',150,62);g.fillText(o.n,870,62);
 if(S.cd>0){g.font='bold 110px Trebuchet MS';g.fillStyle='#ffd23f';g.fillText(Math.ceil(S.cd),W/2,220)}
}

function drawCut(){
 const t=S.cut;g.fillStyle='#0b0616';g.fillRect(0,0,W,H);
 const rg=g.createRadialGradient(W/2,H/2,20,W/2,H/2,520);rg.addColorStop(0,'#ff5a1f66');rg.addColorStop(1,'#0000');g.fillStyle=rg;g.fillRect(0,0,W,H);
 g.save();g.translate((Math.random()-.5)*(t>2&&t<3?12:2),(Math.random()-.5)*(t>2&&t<3?12:2));
 g.textAlign='center';
 if(t<2.5){const k=50+t*20;jock(W/2,470,k,FACE[S.me],{s:2.6+Math.sin(t*8)*.08,flex:1,up:30,col:'#ff5a1f'});
  g.fillStyle='#fff';g.font='bold 34px Trebuchet MS';g.fillText('Мышцы растут...',W/2,60)}
 else if(t<5.5){jock(W/2-170,470,100,FACE[S.me],{s:2.2,flex:1,up:32,col:'#ff5a1f'});jock(W/2+170,470,100,FACE[1-S.me],{s:2.2,flex:1,up:32,col:'#2e86de',dir:-1});
  for(let i=0;i<40;i++){const a=i*2.4+t*3,r=(t*90+i*17)%320;g.fillStyle=`hsl(${i*9+t*100},100%,60%)`;g.fillRect(W/2+Math.cos(a)*r,260+Math.sin(a)*r*.7,5,5)}
  g.fillStyle='#ffd23f';g.font='bold '+(48+Math.sin(t*10)*4)+'px Trebuchet MS';g.fillText('ТЫ СТАЛ КАЧКОМ!',W/2,70)}
 else{const s=Math.min(1,(t-5.5)/1.2);jock(W/2+400-s*400,500,100,HEDGE,{s:3.1,sp:1,flex:1,up:30,col:'#8a6d3b',dir:-1});
  g.fillStyle='#ff4d4d';g.font='bold 42px Trebuchet MS';g.fillText('Появился ГИГАНТ-ЁЖ! Он бросает вызов!',W/2,60)}
 g.restore();
 if(t>2&&t<2.7){g.fillStyle=`rgba(255,255,255,${1-(t-2)/.7})`;g.fillRect(0,0,W,H)}
}

function hud(){
 $('str').textContent=Math.floor(S.str);$('strBar').style.width=S.str+'%';
 $('staBar').style.width=S.sta+'%';$('money').textContent=Math.floor(S.money);
 $('tired').textContent=S.tired?'УСТАЛ!':'';$('maxw').textContent='Макс. ~'+Math.floor(maxLift())+' кг';
 $('pad').style.display=S.mode=='gym'&&matchMedia('(pointer:coarse)').matches?'grid':'none'}

let last=0;
function loop(ts){
 const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
 if(S.mode!='select'&&S.mode!='end')update(dt);
 g.save();if(S.shake>0)g.translate((Math.random()-.5)*8,(Math.random()-.5)*8);
 if(S.mode=='arm')drawArm();else if(S.mode=='cut')drawCut();else{drawGym()}
 g.restore();hud();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
