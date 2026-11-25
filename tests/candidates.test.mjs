import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatrix} from '../dist/physics.mjs';
import {parseCandidateValues,validateCandidateValues,validateRule,parseRuleFile} from '../dist/rules.mjs';
test('candidate lists accept common separators, signed decimals and scientific notation without rounding',()=>{
 assert.deepEqual(parseCandidateValues('[-1， -.125、0; 0.000001\n+1]'),[-1,-.125,0,.000001,1]);
 assert.deepEqual(parseCandidateValues('−1 －0.5 0 1e-6 1'),[-1,-.5,0,.000001,1]);
 assert.deepEqual(parseCandidateValues('0, -0, 0.0, 1, 1.0'),[0,1]);
});
test('empty, malformed and out-of-range candidates are rejected, including tiny boundary violations',()=>{
 for(const text of ['',', ;','[]','-1.0000001, 0','0, 1.0000001','NaN','Infinity','0x1','true','1/2','-1 bad','[0,1'])assert.throws(()=>parseCandidateValues(text),text);
 for(const values of [[],null,['0'],[NaN],[Infinity],[1.01],[-1.01]])assert.throws(()=>validateCandidateValues(values));
});
test('matrix sampling uses exact allowed entries, including single-value and symmetric rules',()=>{
 const samples=[0,.25,.5,.999999];let index=0;
 assert.deepEqual(createMatrix(2,()=>samples[index++],false,[-1,.125,0,1]),[[-1,.125],[0,1]]);
 for(const value of [0,.125,1,-1])assert.ok(createMatrix(16,Math.random,false,[value]).flat().every(v=>v===value));
 const m=createMatrix(16,Math.random,true,[-1,.000001,1]);assert.ok(m.flat().every(v=>[-1,.000001,1].includes(v)));assert.ok(m.every((row,i)=>row.every((v,j)=>v===m[j][i])));
 for(const bad of [[],[2],['.5']])assert.throws(()=>createMatrix(2,Math.random,false,bad));
});
test('candidate settings survive export and legacy rules remain unchanged',()=>{
 const legacy={name:'旧版',n:1,matrix:[[.125]],range:100,strength:1,speed:1,symmetric:false,trails:true};assert.deepEqual(validateRule(legacy),legacy);
 const rule={...legacy,restrictRandom:true,randomValues:[-1,.125,1]};assert.deepEqual(parseRuleFile(JSON.stringify({format:'particle-life-rule',version:1,rule})),rule);
 const copy=validateRule(rule);copy.randomValues[0]=0;assert.equal(rule.randomValues[0],-1);
 for(const extra of [{restrictRandom:'true',randomValues:[0]},{restrictRandom:true,randomValues:[]},{restrictRandom:false,randomValues:[2]}])assert.throws(()=>validateRule({...legacy,...extra}));
});
