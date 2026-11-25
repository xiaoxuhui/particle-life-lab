import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_COLORS,MAX_TYPES,generateColors,typeName} from '../dist/appearance.mjs';
import {createMatrix} from '../dist/physics.mjs';
import {validateRule,parseRuleFile} from '../dist/rules.mjs';
test('seven basic colors expand into a full distinct rainbow up to the supported capacity',()=>{
 assert.deepEqual(generateColors(7),BASE_COLORS);
 for(const n of [1,7,17,64,256,MAX_TYPES]){const colors=generateColors(n);assert.equal(colors.length,n);assert.equal(new Set(colors).size,n);assert.ok(colors.every(color=>/^#[0-9a-f]{6}$/.test(color)))}
 assert.equal(typeName(0),'A');assert.equal(typeName(25),'Z');assert.equal(typeName(26),'AA');assert.equal(typeName(1023),'AMJ');
});
test('manual colors override only their specified types',()=>{const overrides=[null,'#123456'];const colors=generateColors(64,overrides);assert.equal(colors[1],'#123456');assert.equal(colors[0],generateColors(64)[0]);assert.deepEqual(overrides,[null,'#123456'])});
test('a million-coefficient rule is accepted and color settings round-trip without changing older rules',()=>{
 const n=MAX_TYPES,rule={name:'大矩阵',n,matrix:createMatrix(n,Math.random,false,[.125]),range:100,strength:1,speed:1,symmetric:false,trails:true,colorOverrides:Array(n).fill(null)};rule.colorOverrides[n-1]='#abcdef';
 const copy=validateRule(rule);assert.equal(copy.matrix.length,n);assert.equal(copy.matrix[n-1][n-1],.125);assert.equal(copy.colorOverrides[n-1],'#abcdef');copy.colorOverrides[n-1]=null;assert.equal(rule.colorOverrides[n-1],'#abcdef');
 const small={...rule,n:1,matrix:[[0]],colorOverrides:['#abcdef']};assert.deepEqual(parseRuleFile(JSON.stringify({format:'particle-life-rule',version:1,rule:small})),small);
 for(const colorOverrides of [[],['red'],['#123'],['#fff\" onclick=bad']])assert.throws(()=>validateRule({...small,colorOverrides}));
 const legacy={...small};delete legacy.colorOverrides;assert.deepEqual(validateRule(legacy),legacy);
});
