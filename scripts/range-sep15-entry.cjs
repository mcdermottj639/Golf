// Deterministic feed entry from the source transcript; no filesystem writes.
const source = require('../data/range-2026-09-15.json');
const mean = values => {
  const xs = values.filter(Number.isFinite);
  return xs.length ? Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*10)/10 : null;
};
const groups = source.clubs.map(c => ({...c, shots:c.shots.map((row,i)=>({
  shot:i+1, ...Object.fromEntries(source.columns.map((key,j)=>[key,row[j]])),
  carryHit:c.carryHits.includes(i+1), totalHit:c.totalHits.includes(i+1)
}))}));
const clubs = groups.map(c=>({club:c.club,n:c.shots.length,carry:c.displayCarry,total:c.displayTotal??mean(c.shots.map(s=>s.total))}));
const delivery = groups.map(c=>({club:c.club,
  path:mean(c.shots.map(s=>s.path)),face:mean(c.shots.map(s=>s.face)),ftp:mean(c.shots.map(s=>s.ftp)),
  paths:c.shots.map(s=>s.path),faces:c.shots.map(s=>s.face),ftps:c.shots.map(s=>s.ftp)
}));
const entry={id:source.id,type:'bay',src:'tm:2026-09-15-range-video',bay:{
  date:source.date,venue:'TrackMan Range',mode:'Range practice · 54 shots',discipline:'swing',
  norm:'Not established by this recording',spin:'unknown',
  setup:'54 shots · 6 clubs · Sep 15 video analyzed',
  finding:'5w has the longest all-shot average carry here (162.3 yd). Driver and 3w averages are pulled down by very short shots; this is a contact-repeatability session, not a new playing-yardage ladder.',
  detail:{clubs,delivery,rangeShots:groups,rangeSource:source,
    metrics:[{k:'Reviewed',v:'54 / 54',n:'All carry + total shot rows',s:'good'},
      {k:'Carry targets',v:'7 / 54',n:'TrackMan carry target hits'},
      {k:'Total targets',v:'20 / 54',n:'Different landing/roll outcome'}],
    story:'CONTACT FIRST. Driver carries were 167.0, 8.0, 197.1, 15.4, 181.7 and 181.8 yards. The 125.2-yard displayed mean includes both very short shots. The other four average 181.9 yards, a selected subset—not a replacement average or established stock carry. The 3w-labeled group also contains 99.1 and 15.5-yard shots. Keep the misses in view rather than choosing a new club from a distorted mean.\n\nCARRY IS NOT TOTAL. The 5w averaged 162.3 carry versus 195.3 total, with zero carry-target hits but six total-target hits out of nine toward 202 yards. Roll can make the result look successful without clearing a carry requirement. The 6i has four carry hits but three total hits; the modes are not interchangeable.\n\nIRON DELIVERY. All nine readable 6i paths and all nine readable 9i paths point left of target. Their face-to-path readings are positive on every readable row. This supports working on delivery consistency, but does not prove a particular body-motion fault. Shot 5 with 6i carried only 36.3 yards and launched at 1.8 degrees.\n\nWEDGE DISTANCE CONTROL. The 56-degree group averaged 75.5 carry toward a 92-yard target, with two carry hits and five total hits. Shot 5 carried 63.6 but finished at 107.3; its 12.2-degree dynamic loft and 8-foot-7 peak height differ sharply from the other wedge rows. That is a low-flight outlier to review, not evidence to add 107 yards to the bag.\n\nNEXT PRACTICE. Use one club at a time and record ten shots with unchanged target, ball and settings. Start with 6i contact and launch, then 5w carry control. Track all-shot carry, very short misses and carry-target hits separately from total-target hits. Keep the existing outdoor yardages until repeatable evidence supports a change.',
    limits:'This is the Sep 15 Range session, not Sep 14 Map My Bag or Ballybunion. Date and 54-shot count are visible in the session header. The 3w label is preserved: the confirmed Mini Driver mapping in Ballybunion is not automatically transferred to another session. Normalization, venue, ball and whether spin was measured or estimated are not established here. All 54 distances and target outcomes are transcribed; later delivery/speed columns have gaps when the recording scrolls away from a row. Null values remain missing. Delivery chart means use only the readable rows, not the full-club averages displayed elsewhere. No outdoor statistics or stock carries are changed.'
  }
}};
module.exports=entry;
if(require.main===module) console.log(JSON.stringify(entry,null,2));
