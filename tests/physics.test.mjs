import test from 'node:test';
import assert from 'node:assert/strict';
import {World,matrixColor,createMatrix,LIMIT} from '../dist/physics.mjs';
function pair(value){const w=new World(2);w.matrix=[[0,value],[value,0]];w.add(100,100,0);w.add(150,100,1);return w}
test('positive attracts; negative repels; zero gives no force',()=>{for(const v of [-1,0,1]){const w=pair(v);w.step();assert.equal(Math.sign(w.particles[0].vx),v);assert.equal(Math.sign(w.particles[1].vx),v===0?0:-v)}});
test('directed rules independently control each direction',()=>{const w=pair(1);w.matrix[1][0]=0;w.step();assert.ok(w.particles[0].vx>0);assert.equal(w.particles[1].vx,0)});
test('opposite edges interact by shortest wrapped distance',()=>{const w=pair(1);w.particles[0].x=5;w.particles[1].x=995;w.step();assert.ok(w.particles[0].vx<0);assert.ok(w.particles[1].vx>0)});
test('small grid does not count neighbours repeatedly',()=>{const a=pair(1),b=pair(1);b.width=190;b.height=190;a.step();b.step();assert.equal(a.particles[0].vx,b.particles[0].vx)});
test('zero stays black and signed extremes are green and red',()=>{assert.equal(matrixColor(0),'rgb(0, 0, 0)');assert.equal(matrixColor(1),'rgb(0, 205, 102)');assert.equal(matrixColor(-1),'rgb(225, 52, 64)');assert.equal(matrixColor(.5),'rgb(0, 103, 51)')});
test('symmetric random matrix, particle cap and long simulation stay valid',()=>{const w=new World(3);w.matrix=createMatrix(3,Math.random,true);for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.equal(w.matrix[i][j],w.matrix[j][i]);w.scatter(LIMIT+10);assert.equal(w.particles.length,LIMIT);w.particles.length=90;for(let i=0;i<300;i++)w.step();assert.ok(w.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<w.width&&p.y>=0&&p.y<w.height))});
