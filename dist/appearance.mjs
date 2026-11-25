export const MAX_TYPES=1024;
export const TYPE_PAGE_SIZE=16;
export const BASE_COLORS=['#ff5555','#ff9955','#ffe555','#66dd77','#55dddd','#6688ff','#b277ff'];
export function typeName(index){
 let value=index+1,label='';
 while(value>0){value--;label=String.fromCharCode(65+value%26)+label;value=Math.floor(value/26)}
 return label;
}
function hueColor(hue){
 const chroma=.9,x=chroma*(1-Math.abs((hue/60)%2-1)),offset=.06;
 const rgb=hue<60?[chroma,x,0]:hue<120?[x,chroma,0]:hue<180?[0,chroma,x]:hue<240?[0,x,chroma]:hue<300?[x,0,chroma]:[chroma,0,x];
 return '#'+rgb.map(channel=>Math.round((channel+offset)*255).toString(16).padStart(2,'0')).join('');
}
export function generateColors(n,overrides=[]){
 return Array.from({length:n},(_,i)=>overrides[i]??(n<=7?BASE_COLORS[i]:hueColor(i*360/n)));
}
