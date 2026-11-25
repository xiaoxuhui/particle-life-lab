import {World,LIMIT,clamp,createMatrix,matrixColor} from './physics.mjs';
import {MAX_TYPES,TYPE_PAGE_SIZE,BASE_COLORS,generateColors,typeName} from './appearance.mjs';
import {validateRule,parseRuleFile,readRuleLibrary,writeRuleLibrary,parseCandidateValues} from './rules.mjs';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
const world=new World(6);let chosen=-1,pair=[0,0],paused=false,speed=1,pointer=null,last=0,accumulator=0,lastFps=0,frames=0,brushTime=0,toastTimer;
let stepping=false,cancelStep=false;
const defaultRandomValues=[-1,-.5,0,.5,1];let randomValues=defaultRandomValues.slice();
let colorOverrides=Array(world.n).fill(null),colors=generateColors(world.n),colorType=0,typePage=0,matrixRowPage=0,matrixColPage=0;
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500)}
function fmt(v){return v===0?'0':(v>0?'+':'')+(Number(v.toFixed(2))===v?v.toFixed(2):String(v))}
function name(i){return typeName(i)}
function dot(i){return `<span class="dot" style="--c:${colors[i]}"></span>`}
function pageOptions(select,n,page){
 const pages=Math.ceil(n/TYPE_PAGE_SIZE);
 select.replaceChildren(...Array.from({length:pages},(_,index)=>new Option(`${index*TYPE_PAGE_SIZE+1}～${Math.min(n,(index+1)*TYPE_PAGE_SIZE)} 种`,String(index))));
 select.value=page;
}
function palette(){
 typePage=Math.min(typePage,Math.ceil(world.n/TYPE_PAGE_SIZE)-1);
 const start=typePage*TYPE_PAGE_SIZE,indices=Array.from({length:Math.min(TYPE_PAGE_SIZE,world.n-start)},(_,i)=>start+i);
 $('palette').innerHTML=`<button class="species-button ${chosen===-1?'active':''}" data-type="-1" aria-pressed="${chosen===-1}">混合</button>`+indices.map(i=>`<button class="species-button ${chosen===i?'active':''}" data-type="${i}" aria-label="投放第 ${i+1} 种 ${name(i)} 类粒子" aria-pressed="${chosen===i}">${dot(i)}${name(i)}</button>`).join('');
 $('type-pagination').hidden=world.n<=TYPE_PAGE_SIZE;pageOptions($('type-page'),world.n,typePage);updateColorEditor();
}
function updateColorEditor(){
 colorType=Math.min(colorType,world.n-1);$('color-type').max=world.n;$('color-type').value=colorType+1;$('type-color').value=colors[colorType];$('color-type-label').textContent=`${name(colorType)} 的颜色`;
}
function refreshColors(){colors=generateColors(world.n,colorOverrides);palette();renderMatrix()}
function setTypeColor(color){colorOverrides[colorType]=color;refreshColors()}
function matrixPages(){
 const pages=Math.ceil(world.n/TYPE_PAGE_SIZE);matrixRowPage=Math.min(matrixRowPage,pages-1);matrixColPage=Math.min(matrixColPage,pages-1);
 $('matrix-pagination').hidden=pages===1;pageOptions($('matrix-row-page'),world.n,matrixRowPage);pageOptions($('matrix-col-page'),world.n,matrixColPage);
 $('matrix-page-note').textContent=`共 ${world.n.toLocaleString()} 种、${(world.n*world.n).toLocaleString()} 个系数，每页最多 ${TYPE_PAGE_SIZE}×${TYPE_PAGE_SIZE} 格。`;
}
function renderMatrix(){
 matrixPages();
 const rowStart=matrixRowPage*TYPE_PAGE_SIZE,colStart=matrixColPage*TYPE_PAGE_SIZE;
 const rows=Array.from({length:Math.min(TYPE_PAGE_SIZE,world.n-rowStart)},(_,i)=>rowStart+i),cols=Array.from({length:Math.min(TYPE_PAGE_SIZE,world.n-colStart)},(_,j)=>colStart+j);
 const longest=Math.max(...rows.flatMap(i=>cols.map(j=>fmt(world.matrix[i][j]).length)));
 const labelWidth=Math.max(23,name(rows.at(-1)).length*8+15);
 $('matrix').style.minWidth=cols.length>8||longest>5?`${labelWidth+cols.length*Math.max(43,longest*7+8)}px`:'';
 $('matrix').innerHTML=`<thead><tr><th class="axis-label" style="width:${labelWidth}px" aria-label="行受力，列施力">行/列</th>${cols.map(i=>`<th scope="col"><span class="matrix-label">${dot(i)}${name(i)}</span></th>`).join('')}</tr></thead><tbody>`+rows.map(i=>`<tr><th scope="row"><span class="matrix-label">${dot(i)}${name(i)}</span></th>${cols.map(j=>{const v=world.matrix[i][j];return `<td><button data-i="${i}" data-j="${j}" class="${pair[0]===i&&pair[1]===j?'selected':''}" style="--cell:${matrixColor(v)}" title="第 ${i+1} 种 ${name(i)} 受第 ${j+1} 种 ${name(j)} 影响：${fmt(v)}" aria-label="${name(i)} 受 ${name(j)} 影响：${fmt(v)}" aria-pressed="${pair[0]===i&&pair[1]===j}">${fmt(v)}</button></td>`}).join('')}</tr>`).join('')+'</tbody>';
 updateEditor();
}
function updateEditor(){const v=world.matrix[pair[0]][pair[1]];$('pair-label').textContent=`${name(pair[0])} 受 ${name(pair[1])} 影响`;$('coefficient').value=String(v);$('coefficient-range').value=v;$('effect').textContent=v>0?'吸引 '+fmt(v):v<0?'排斥 '+fmt(v):'无作用'}
function setCoefficient(value){if(!Number.isFinite(value))return;const v=clamp(value,-1,1);world.matrix[pair[0]][pair[1]]=v;if($('symmetric').checked)world.matrix[pair[1]][pair[0]]=v;renderMatrix()}
function setPause(value){if(stepping&&!value)return;paused=value;$('pause').textContent=paused?'▷ 继续':'Ⅱ 暂停';$('status').innerHTML=paused?'<i></i> 已暂停':'<i></i> 正在演化';$('status').classList.toggle('paused',paused);accumulator=0}
async function advanceManually(n){
 if(stepping)return;
 if(!Number.isInteger(n)||n<1||n>3600){notify('前进帧数请输入 1～3,600 的整数');return}
 setPause(true);pointer=null;stepping=true;cancelStep=false;
 const controls=Array.from(document.querySelectorAll('.panel button,.panel input,.panel select,.panel textarea,.canvas-tools button,.step-tools button:not(#cancel-step),#step-count')).map(el=>[el,el.disabled]);
 for(const [el] of controls)el.disabled=true;
 $('cancel-step').hidden=false;canvas.setAttribute('aria-busy','true');let completed=0;
 try{
  while(completed<n&&!cancelStep){
   const start=performance.now();
   do{world.step();completed++}while(completed<n&&!cancelStep&&performance.now()-start<8);
   render();$('step-progress').textContent=`正在前进：${completed} / ${n} 帧`;
   if(completed<n)await new Promise(resolve=>setTimeout(resolve,0));
  }
  $('step-progress').textContent=`${cancelStep?'已停止，':''}已前进 ${completed} 帧（${(completed/60).toFixed(2)} 秒）· 已暂停`;
 }catch{
  $('step-progress').textContent=`推进中断：已前进 ${completed} 帧 · 已暂停`;notify('推进未完成，当前画面已保留');
 }finally{
  stepping=false;for(const [el,disabled] of controls)el.disabled=disabled;
  $('cancel-step').hidden=true;canvas.removeAttribute('aria-busy');last=0;setPause(true);render();
 }
}
function count(){const n=world.particles.length;$('count').textContent=n.toLocaleString();$('empty').hidden=n!==0}
function resize(){const b=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),oldW=world.width,oldH=world.height;world.width=b.width;world.height=b.height;canvas.width=Math.round(b.width*dpr);canvas.height=Math.round(b.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);for(const p of world.particles){p.x=p.x/oldW*world.width;p.y=p.y/oldH*world.height}ctx.fillStyle='#090e14';ctx.fillRect(0,0,b.width,b.height);render()}
function render(){
 const w=world.width,h=world.height;ctx.fillStyle=$('trails').checked&&!paused?'rgba(9,14,20,0.25)':'#090e14';ctx.fillRect(0,0,w,h);
 const groups=new Map();for(const p of world.particles){if(!groups.has(p.type))groups.set(p.type,[]);groups.get(p.type).push(p)}
 for(const [type,particles] of groups){ctx.fillStyle=colors[type];ctx.beginPath();for(const p of particles){ctx.moveTo(p.x+1.8,p.y);ctx.arc(p.x,p.y,1.8,0,Math.PI*2)}ctx.fill()}
}
function sprinkle(){if(!pointer)return;for(let i=0;i<3;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*16;world.add(pointer.x+Math.cos(a)*r,pointer.y+Math.sin(a)*r,chosen<0?Math.floor(Math.random()*world.n):chosen)}count();if(world.particles.length===LIMIT){pointer=null;notify('已达到 1,800 颗粒子上限')}}
function frame(time){
 const elapsed=last?Math.min(time-last,250):1000/60;last=time;
 if(!paused){
  const frameMs=1000/60,start=performance.now();
  // Fixed physics steps keep the same rules at every playback rate. Limit
  // outstanding work so slow devices stay responsive instead of building debt.
  accumulator=Math.min(accumulator+elapsed*speed,Math.max(frameMs,250*speed));
  let steps=0;
  while(accumulator+1e-7>=frameMs&&steps<150){world.step();accumulator=Math.max(0,accumulator-frameMs);steps++;if(performance.now()-start>=12)break}
 }
 if(pointer&&time-brushTime>35){sprinkle();brushTime=time}
 render();frames++;if(time-lastFps>500){$('fps').textContent=Math.round(frames*1000/(time-lastFps));frames=0;lastFps=time}requestAnimationFrame(frame);
}
$('palette').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;chosen=Number(b.dataset.type);if(chosen>=0)colorType=chosen;palette()});
$('type-page').onchange=e=>{typePage=Number(e.target.value);palette()};
$('color-type').onchange=e=>{const index=e.target.valueAsNumber-1;if(!Number.isInteger(index)||index<0||index>=world.n){updateColorEditor();notify(`请输入 1～${world.n} 的粒子编号`);return}colorType=index;chosen=index;typePage=Math.floor(index/TYPE_PAGE_SIZE);palette()};
$('color-type').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
$('type-color').oninput=e=>setTypeColor(e.target.value);
$('color-presets').innerHTML=BASE_COLORS.map((color,i)=>`<button type="button" data-color="${color}" style="--c:${color}" aria-label="设为${['红','橙','黄','绿','青','蓝','紫'][i]}色"><span class="dot"></span>${['红','橙','黄','绿','青','蓝','紫'][i]}</button>`).join('');
$('color-presets').onclick=e=>{const button=e.target.closest('button');if(button)setTypeColor(button.dataset.color)};
$('auto-colors').onclick=()=>{colorOverrides=Array(world.n).fill(null);refreshColors();notify('所有粒子已恢复自动彩虹配色')};
$('matrix-row-page').onchange=e=>{matrixRowPage=Number(e.target.value);renderMatrix()};
$('matrix-col-page').onchange=e=>{matrixColPage=Number(e.target.value);renderMatrix()};
$('matrix').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;pair=[Number(b.dataset.i),Number(b.dataset.j)];renderMatrix()});
$('coefficient').addEventListener('change',e=>setCoefficient(e.target.valueAsNumber));
$('coefficient-range').addEventListener('input',e=>setCoefficient(Number(e.target.value)));
$('symmetric').addEventListener('change',e=>{if(e.target.checked){for(let i=0;i<world.n;i++)for(let j=0;j<i;j++)world.matrix[i][j]=world.matrix[j][i];renderMatrix();notify('已统一双向系数；上三角数值同步至下三角')}});
function candidateError(message=''){$('random-values-error').textContent=message;$('random-values-error').hidden=!message;$('random-values').setAttribute('aria-invalid',String(!!message))}
function candidatePool(){
 if(!$('restrict-random').checked)return null;
 try{const values=parseCandidateValues($('random-values').value);randomValues=values;candidateError();return values}catch(error){candidateError(error.message);throw error}
}
$('restrict-random').onchange=()=>{const enabled=$('restrict-random').checked;$('random-values').disabled=!enabled;if(enabled){try{candidatePool()}catch{}}else{$('random-values').value=randomValues.join(', ');candidateError()}};
$('random-values').oninput=()=>{try{candidatePool()}catch{}};
$('random-rules').onclick=()=>{try{world.matrix=createMatrix(world.n,Math.random,$('symmetric').checked,candidatePool());renderMatrix();notify($('restrict-random').checked?'已从候选列表抽取新的规则':'新的相遇规则已生成')}catch(error){notify(error.message)}};
$('zero-rules').onclick=()=>{world.matrix=Array.from({length:world.n},()=>Array(world.n).fill(0));renderMatrix();notify('全部作用归零，粒子会因阻尼逐渐停下')};
$('scatter').onclick=()=>{const raw=$('amount').valueAsNumber;if(!Number.isFinite(raw)){notify('请输入 1 到 1,800 之间的投放数量');return}const n=Math.round(clamp(raw,1,LIMIT));$('amount').value=n;const before=world.particles.length;world.scatter(n,chosen);count();notify(`撒下 ${world.particles.length-before} 颗粒子${world.particles.length===LIMIT?'，已到数量上限':''}`)};
$('clear').onclick=()=>{world.particles=[];count();ctx.clearRect(0,0,canvas.width,canvas.height);notify('画布已清空，作用规则已保留')};
$('reset').onclick=()=>{const n=world.particles.length||600;world.particles=[];world.scatter(n);count();notify('已按当前规则重新撒布')};
$('pause').onclick=()=>setPause(!paused);
$('step-frame').onclick=()=>advanceManually(1);
$('step-second').onclick=()=>advanceManually(60);
$('step-n').onclick=()=>advanceManually($('step-count').valueAsNumber);
$('step-count').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();advanceManually(e.target.valueAsNumber)}};
$('cancel-step').onclick=()=>cancelStep=true;
$('species').max=MAX_TYPES;$('species-hint').textContent=`输入 1～${MAX_TYPES.toLocaleString()}，按回车或点别处生效。颜色自动细分，种类较多时分页显示。`;
$('species').onchange=e=>{const n=e.target.valueAsNumber;if(!Number.isInteger(n)||n<1||n>MAX_TYPES){e.target.value=world.n;notify(`粒子种类数请输入 1～${MAX_TYPES.toLocaleString()} 的整数`);return}const old=world.matrix;let generated;try{generated=n>world.n?createMatrix(n,Math.random,$('symmetric').checked,candidatePool()):null}catch(error){e.target.value=world.n;notify(error.message);return}world.n=n;world.matrix=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>old[i]?.[j]??generated[i][j]));world.particles=world.particles.filter(p=>p.type<n);if(chosen>=n)chosen=-1;pair=[Math.min(pair[0],n-1),Math.min(pair[1],n-1)];if($('symmetric').checked)for(let i=0;i<n;i++)for(let j=0;j<i;j++)world.matrix[i][j]=world.matrix[j][i];colorOverrides=Array.from({length:n},(_,i)=>colorOverrides[i]??null);colors=generateColors(n,colorOverrides);palette();renderMatrix();count()};
$('species').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
for(const [id,property] of [['radius','range'],['strength','strength']])$(id).oninput=e=>{const v=Number(e.target.value);world[property]=v;$(id+'-value').textContent=id==='radius'?v:v.toFixed(1)+'×'};
function updateSpeedUI(){
 const fps=Math.round(speed*60*100)/100;$('speed').value=fps;$('speed-value').textContent=speed.toFixed(2)+'×';
 document.querySelectorAll('[data-fps]').forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.fps)===fps));
}
function setRunRate(fps){speed=fps/60;accumulator=0;last=0;updateSpeedUI()}
$('speed').oninput=e=>{const fps=e.target.valueAsNumber;if(Number.isFinite(fps)&&fps>=1&&fps<=600){speed=fps/60;accumulator=0;$('speed-value').textContent=speed.toFixed(2)+'×';document.querySelectorAll('[data-fps]').forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.fps)===fps))}};
$('speed').onchange=e=>{const fps=e.target.valueAsNumber;if(!Number.isFinite(fps)||fps<1||fps>600){updateSpeedUI();notify('运行速度请输入 1～600 帧/秒');return}setRunRate(fps)};
$('speed').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
document.querySelectorAll('[data-fps]').forEach(button=>button.onclick=()=>setRunRate(Number(button.dataset.fps)));
$('defaults').onclick=()=>{world.range=100;world.strength=1;setRunRate(60);for(const [id,v] of [['radius',100],['strength',1]]){$(id).value=v;$(id+'-value').textContent=id==='radius'?v:'1.0×'}notify('世界参数已恢复默认')};
function locate(e){const r=canvas.getBoundingClientRect();return {x:clamp(e.clientX-r.left,0,world.width),y:clamp(e.clientY-r.top,0,world.height)}}
canvas.onpointerdown=e=>{if(e.button!==0||stepping)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointer=locate(e);sprinkle()};canvas.onpointermove=e=>{if(pointer)pointer=locate(e)};canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>pointer=null;
canvas.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();setPause(!paused)}};
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=$('got-it').onclick=()=>$('help-dialog').close();
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;pointer=null});
let library=[],storageReady=true;
function currentRule(title){return validateRule({name:title,n:world.n,matrix:world.matrix,range:world.range,strength:world.strength,speed,symmetric:$('symmetric').checked,trails:$('trails').checked,restrictRandom:$('restrict-random').checked,randomValues:candidatePool()??randomValues,colorOverrides})}
function ruleName(){return $('rule-name').value.trim()||`粒子规则 ${library.length+1}`}
function selectedRule(){return library.find(rule=>rule.id===$('saved-rules').value)}
function updateLibrary(selected=''){
 const select=$('saved-rules');select.replaceChildren(new Option('选择一份收藏',''));
 for(const rule of library)select.add(new Option(rule.name,rule.id));
 select.value=selected;$('saved-count').textContent=`${library.length} 份收藏`;updateRuleActions();
}
function updateRuleActions(){const selected=!!selectedRule();$('load-rule').disabled=$('delete-rule').disabled=!selected;$('export-rule').textContent=selected?'导出所选':'导出当前'}
function persistLibrary(next){
 if(!storageReady){notify('本地规则库不可用，请使用“导出当前”保存文件');return false}
 try{writeRuleLibrary(localStorage,next);library=next;return true}catch{notify('本地保存失败，请导出规则文件备份');$('rule-storage-note').textContent='浏览器存储不可用或已满，规则尚未保存。请使用导出文件备份。';return false}
}
function addSavedRule(rule){
 const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const entry={id,...rule};
 if(!persistLibrary([...library,entry]))return false;
 updateLibrary(id);return true;
}
$('save-rule-form').onsubmit=e=>{e.preventDefault();try{const rule=currentRule(ruleName());if(addSavedRule(rule)){$('rule-name').value=rule.name;notify(`已保存「${rule.name}」`)}}catch(error){notify(error.message)}};
$('saved-rules').onchange=updateRuleActions;
$('load-rule').onclick=()=>{
 const saved=selectedRule();if(!saved)return;const rule=validateRule(saved);
 world.n=rule.n;world.matrix=rule.matrix;world.range=rule.range;world.strength=rule.strength;speed=rule.speed;
 $('species').value=rule.n;$('symmetric').checked=rule.symmetric;$('trails').checked=rule.trails;$('rule-name').value=rule.name;
 randomValues=(rule.randomValues??defaultRandomValues).slice();$('restrict-random').checked=rule.restrictRandom??false;$('random-values').value=randomValues.join(', ');$('random-values').disabled=!$('restrict-random').checked;candidateError();
 colorOverrides=rule.colorOverrides?.slice()??Array(rule.n).fill(null);colors=generateColors(rule.n,colorOverrides);colorType=0;typePage=0;matrixRowPage=0;matrixColPage=0;
 for(const [id,value] of [['radius',rule.range],['strength',rule.strength]]){$(id).value=value;$(id+'-value').textContent=id==='radius'?value:value.toFixed(1)+'×'}
 updateSpeedUI();
 for(const p of world.particles){p.type%=rule.n;p.vx=p.vy=0}
 if(chosen>=rule.n)chosen=-1;pair=[0,0];accumulator=0;palette();renderMatrix();count();notify(`已读取「${rule.name}」`);
};
$('delete-rule').onclick=()=>{const rule=selectedRule();if(!rule)return;if(!confirm(`删除收藏「${rule.name}」？当前画布的规则会保留。`))return;if(persistLibrary(library.filter(item=>item.id!==rule.id))){updateLibrary();notify('已删除这份收藏')}};
$('export-rule').onclick=()=>{
 let rule;try{rule=validateRule(selectedRule()||currentRule(ruleName()))}catch(error){notify(error.message);return}
 const content=JSON.stringify({format:'particle-life-rule',version:1,rule},null,2),name=rule.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,60)+'.json';
 if(typeof GameHubBridge!=='undefined'){try{notify(GameHubBridge.saveFile(name,content)?'已受理，请选择保存位置；保存结果由大厅提示':'暂时无法导出，请重试')}catch{notify('暂时无法导出，请重试')}return}
 const blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);notify('规则文件已导出');
};
$('import-rule').onclick=()=>$('import-rule-file').click();
$('import-rule-file').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{if(file.size>64*1024*1024)throw new Error('规则文件超过 64 MB，请选择本模拟器导出的 JSON 文件');const rule=parseRuleFile(await file.text());if(addSavedRule(rule))notify(`已导入「${rule.name}」，点击读取即可使用`)}catch(error){notify(error.message)}finally{e.target.value=''}
};
try{library=readRuleLibrary(localStorage)}catch{storageReady=false;$('rule-storage-note').textContent='本地规则库暂时无法读取。为保留原数据，请先用“导出当前”保存文件，再检查浏览器存储设置。'}
updateLibrary();
// Start with moderate attraction between neighbours and repulsion within a type.
world.matrix=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?-.35:j===(i+1)%6?.72:j===(i+5)%6?.25:-.18));
palette();renderMatrix();new ResizeObserver(resize).observe(canvas);resize();world.scatter(600);count();requestAnimationFrame(frame);
