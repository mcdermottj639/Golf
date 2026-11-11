#!/usr/bin/env node
'use strict';
// Read-only contract tests. No real golf storage, scorecard, or location is opened.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('app.js'),prep=read('course-prep.js'),shell=read('index.html'),sw=read('sw.js'),css=read('ux-journey.css');
assert.equal(app.match(/const BUILD = '(v[0-9]+)'/)[1],sw.match(/const CACHE = 'caddiehq-(v[0-9]+)'/)[1]);
assert.ok(shell.includes('ux-journey.css')&&sw.includes('./ux-journey.css'),'new controls ship in online and offline shells');
assert.ok(css.includes('grid-template-columns:repeat(5')&&css.includes('min-height:44px'),'compact, usable touch targets');
assert.ok(!app.includes('location.hash')&&!app.includes('location.search'),'route info never leaks to URL');
assert.ok(prep.includes('const VIEW_MEMORY')&&prep.includes('restoreView();')&&prep.includes('get holeNumber(){return hole;}'));
assert.ok(prep.includes('sessionStorage.setItem(VIEW_MEMORY,JSON.stringify({courseId:course.id,hole,mode}))'),'only a course id, hole, mode are saved');
assert.ok(!prep.includes('sessionStorage.setItem(VIEW_MEMORY,JSON.stringify({courseId:course.id,hole,mode,lat')),'no location coordinates in view memory');
const first=app.indexOf('const HQ_ROUTE_VIEWS = new Set('),last=app.indexOf("window.addEventListener('popstate'",first);
assert.ok(first>0&&last>first,'navigation functions found');
const calls=[],history={
  state:null,
  replaceState(s,title,url){calls.push({verb:'replace',url});this.state=s;},
  pushState(s,title,url){calls.push({verb:'push',url});this.state=s;}
};
const ctx={window:{history,scrollY:270,CaddieCoursePrep:{courseName:'Sample Course',holeNumber:5}},
  hqGoingBack:false,roundsSeg:'courses',
  S:{rounds:[{date:'2026-10-01',course:'Sample Course'},{date:'2026-11-01',course:'Latest Sample'}],live:null},
  esc:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
vm.createContext(ctx);
vm.runInContext(app.slice(first,last)+'globalThis.check={hqHistoryRoute,hqLatestRoundIndex,hqJourney};',ctx);
const T=ctx.check;
T.hqHistoryRoute('home',null,false,false);
assert.equal(history.state.depth,0);
T.hqHistoryRoute('rounds','courses',false,true);
assert.equal(history.state.depth,1);
T.hqHistoryRoute('courseprep',null,false,true);
assert.equal(history.state.depth,2);
assert.ok(calls.every(c=>c.url===''||c.url===undefined),'route changes do not change address');
assert.equal(T.hqLatestRoundIndex(),1,'latest review is selected by date, not array insertion');
const course=T.hqJourney('rounds','courses');
assert.match(course,/aria-current="step"/);assert.match(course,/COURSE → RECAP/);
assert.equal((course.match(/data-step=/g)||[]).length,5);
const guide=T.hqJourney('courseprep');
assert.match(guide,/Sample Course · hole 5/);
assert.match(guide,/data-step="guide" aria-current="step"/);
const saved=T.hqJourney('round',1);
assert.match(saved,/Saved round/);
assert.match(saved,/data-step="recap" aria-current="step"/);
ctx.S.live={course:'Sample Course',stage:'play'};
assert.equal(T.hqJourney('live'),'', 'no extra controls on live scoring tap surface');
ctx.S.live={course:'Sample Course',stage:'finish'};
assert.match(T.hqJourney('live'),/review before saving/);
ctx.S.rounds=[];
assert.match(T.hqJourney('rounds','cards'),/disabled title="No saved round to review"/);
assert.equal(T.hqLatestRoundIndex(),null);
assert.ok(app.includes("'rounds-seg': el =>")&&app.includes('rememberRoundsSeg(roundsSeg)'));
assert.ok(app.includes('historyRoute?.view'),'refresh considers the browser route');
console.log('PASS v290 journey: 5 steps, private route, recent recap, live safety, session-only course/hole, offline shell.');
