import {MAX_TYPES} from './appearance.mjs';
export const RULE_STORAGE_KEY = 'particle-life-lab.rules.v1';
export function validateCandidateValues(values) {
  if(!Array.isArray(values)||values.length===0)throw new Error('请至少填写一个候选系数');
  if(!values.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=-1&&value<=1))throw new Error('每个候选系数都必须在 −1～1 之间，包含 −1 和 1');
  return [...new Set(values)];
}
export function parseCandidateValues(text) {
  const normalized=text.trim().replace(/[−－]/g,'-');
  const content=normalized.startsWith('[')&&normalized.endsWith(']')?normalized.slice(1,-1):normalized;
  const tokens=content.split(/[\s,，、;；]+/u).filter(Boolean);
  if(tokens.length===0)throw new Error('请至少填写一个候选系数');
  if(!tokens.every(token=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)))throw new Error('列表中只能填写数字，用逗号、空格或换行分隔');
  return validateCandidateValues(tokens.map(Number));
}
export function validateRule(input) {
  const invalid = () => { throw new Error('规则文件无效，请选择本模拟器导出的 JSON 文件'); };
  if(!input || typeof input!=='object') invalid();
  const {name, n, matrix, range, strength, speed, symmetric, trails}=input;
  if(typeof name!=='string'||!name.trim()||name.length>80||!Number.isInteger(n)||n<1||n>MAX_TYPES) invalid();
  if(!Array.isArray(matrix)||matrix.length!==n||!matrix.every(row=>Array.isArray(row)&&row.length===n&&row.every(v=>Number.isFinite(v)&&v>=-1&&v<=1))) invalid();
  if(!Number.isFinite(range)||range<30||range>180||!Number.isFinite(strength)||strength<.1||strength>3||!Number.isFinite(speed)||speed<1/60||speed>10||typeof symmetric!=='boolean'||typeof trails!=='boolean') invalid();
  if(symmetric&&!matrix.every((row,i)=>row.every((v,j)=>v===matrix[j][i]))) invalid();
  const rule={name:name.trim(),n,matrix:matrix.map(row=>row.slice()),range,strength,speed,symmetric,trails};
  if(input.restrictRandom!==undefined||input.randomValues!==undefined){
    if(typeof input.restrictRandom!=='boolean')invalid();
    rule.restrictRandom=input.restrictRandom;rule.randomValues=validateCandidateValues(input.randomValues);
  }
  if(input.colorOverrides!==undefined){
    if(!Array.isArray(input.colorOverrides)||input.colorOverrides.length!==n||!input.colorOverrides.every(color=>color===null||(typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color))))invalid();
    rule.colorOverrides=input.colorOverrides.slice();
  }
  return rule;
}
export function parseRuleFile(text) {
  let data;try{data=JSON.parse(text)}catch{throw new Error('无法读取 JSON，请选择本模拟器导出的规则文件')}
  if(data?.format!=='particle-life-rule'||data.version!==1)throw new Error('不支持这个规则文件格式或版本');
  return validateRule(data.rule);
}
export function readRuleLibrary(storage) {
  const text=storage.getItem(RULE_STORAGE_KEY);
  if(text===null)return [];
  const data=JSON.parse(text);
  if(data?.version!==1||!Array.isArray(data.rules))throw new Error('规则库格式无效');
  const ids=new Set();
  return data.rules.map(entry=>{
    if(typeof entry.id!=='string'||!entry.id||ids.has(entry.id))throw new Error('规则编号无效');
    ids.add(entry.id);return {id:entry.id,...validateRule(entry)};
  });
}
export function writeRuleLibrary(storage,rules) {
  storage.setItem(RULE_STORAGE_KEY,JSON.stringify({version:1,rules}));
}
