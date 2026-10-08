/* Caddie HQ yardage-book artwork. Every playable shape comes from the course pack.
 * Texture, mowing stripes and canopy shading are decorative, never terrain data. */
(function () {
  'use strict';
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const segmentDistance = (p,a,b) => {
    const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
    const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  };
  const near = (p,route) => Math.min(...route.slice(1).map((b,i)=>segmentDistance(p,route[i],b)));
  function inside(p,poly) {
    let yes=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const a=poly[i],b=poly[j];
      if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  function layout(course,hole) {
    if(hole.mapReady===false || !hole.path?.length)return null;
    const tee=hole.path[0],green=hole.path.at(-1),cos=Math.cos(tee[0]*Math.PI/180);
    const local=p=>[(p[1]-tee[1])*cos*111195,(p[0]-tee[0])*111195];
    const end=local(green),length=Math.hypot(...end);
    if(length<1)return null;
    const project=p=>{const [x,y]=local(p);return [(x*end[1]-y*end[0])/length,-(x*end[0]+y*end[1])/length];};
    const route=hole.path.map(project),other=course.holes.filter(h=>h!==hole&&h.mapReady!==false).map(h=>h.path.map(project));
    const features=(course.features||[]).map(f=>({...f,points:f.path.map(project)})).filter(f=> {
      const close=f.points.some(p=>near(p,route)<75)||route.some(p=>inside(p,f.points));
      if(!close)return false;
      if(['wood','rough','water'].includes(f.kind))return true;
      const center=f.points.reduce((p,q)=>[p[0]+q[0]/f.points.length,p[1]+q[1]/f.points.length],[0,0]);
      if(f.kind==='green')return Math.hypot(center[0],center[1]+length)<45;
      if(f.kind==='tee')return Math.hypot(...center)<65;
      // Keep neighboring holes' fairways/tees out of a focused guide.
      return !other.some(r=>near(center,r)+8<near(center,route));
    });
    const playable=features.filter(f=>['fairway','green','tee','bunker'].includes(f.kind));
    const frame=[...route,...playable.flatMap(f=>f.points).filter(p=>near(p,route)<80)];
    const minX=Math.min(...frame.map(p=>p[0]))-28,maxX=Math.max(...frame.map(p=>p[0]))+28;
    const minY=Math.min(...frame.map(p=>p[1]))-42,maxY=Math.max(...frame.map(p=>p[1]))+38;
    const width=600,height=900,scale=Math.min((width-44)/(maxX-minX),(height-120)/(maxY-minY));
    // A yardage-book illustration emphasizes width for legibility. This surface
    // is explicitly not to scale and never supplies a tap or distance transform.
    const crossScale=Math.min(scale*2.2,(width-64)/(maxX-minX));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const to=p=>[width/2+(p[0]-cx)*crossScale,height/2+18+(p[1]-cy)*scale];
    return {width,height,scale,route:route.map(to),features:features.map(f=>({...f,points:f.points.map(to)})),tee:to([0,0]),green:to([0,-length])};
  }
  let sequence=0;
  function render(course,hole) {
    const data=layout(course,hole);if(!data)return '';
    const id='hg-'+(++sequence),{width:w,height:h,scale,route,features,tee,green}=data;
    const points=ps=>ps.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');
    const polygon=f=>'<polygon data-feature="'+f.kind+'" data-source-id="'+f.id+'" points="'+points(f.points)+'"/>';
    const paths=kind=>features.filter(f=>f.kind===kind).map(polygon).join('');
    const routePoints=points(route),corridor=Math.max(180,Math.min(500,220*scale));
    const woods=features.filter(f=>f.kind==='wood'),playable=features.filter(f=>['fairway','green','bunker','water','tee'].includes(f.kind));
    let trees='',seed=(hole.osmId||hole.n)>>>0;
    const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
    // Canopies only inside sourced woodland; no invented tree locations in open rough.
    for(let y=58;y<h-38;y+=16)for(let x=32;x<w-28;x+=16) {
      const p=[x+(random()-.5)*17,y+(random()-.5)*17],r=9+random()*7;
      if(near(p,route)>corridor*.56 || !woods.some(f=>inside(p,f.points)) || playable.some(f=>inside(p,f.points)))continue;
      trees+='<use href="#'+id+'-tree" x="'+p[0].toFixed(1)+'" y="'+p[1].toFixed(1)+'" transform="translate('+p[0].toFixed(1)+' '+p[1].toFixed(1)+') scale('+(r/15).toFixed(2)+') translate('+(-p[0]).toFixed(1)+' '+(-p[1]).toFixed(1)+')" opacity="'+(.72+random()*.28).toFixed(2)+'"/>';
    }
    const mark=(p,type)=>'<g class="hg-'+type+'" data-guide-point="'+type+'" transform="translate('+p.map(n=>n.toFixed(2)).join(' ')+')"><circle r="13" fill="#204d3e" stroke="#fcfbef" stroke-width="2"/>'+(type==='tee'?'<text y="4.5" text-anchor="middle" fill="white" font-size="13" font-weight="700">T</text>':'<path d="M0 4V-26L17 -20L0 -14" stroke="#204d3e" fill="#204d3e" stroke-width="2"/>')+'<text x="21" y="5" fill="#173f33" stroke="#f7f6eb" stroke-width="4" paint-order="stroke" font-size="17" font-weight="650">'+(type==='tee'?'Tee':'Green')+'</text></g>';
    return '<figure class="cp-art-guide" data-guide-state="ready"><svg class="cp-hole-art" viewBox="0 0 '+w+' '+h+'" role="img" aria-labelledby="'+id+'-title '+id+'-desc" xmlns="http://www.w3.org/2000/svg"><title id="'+id+'-title">'+esc(course.shortName)+' hole '+hole.n+' — Caddie HQ guide</title><desc id="'+id+'-desc">Approximate mapped hole. Tee at bottom, green at top. Incomplete hazard coverage. Textures and tree canopies are illustrative; no elevation or putting contours are represented.</desc><defs>'+
      '<linearGradient id="'+id+'-grass" x2=".8" y2="1"><stop stop-color="#96b74e"/><stop offset=".45" stop-color="#6e9e3e"/><stop offset="1" stop-color="#9fba62"/></linearGradient><linearGradient id="'+id+'-green" x2=".7" y2="1"><stop stop-color="#b3cc71"/><stop offset="1" stop-color="#83ae43"/></linearGradient><linearGradient id="'+id+'-water" x2=".3" y2="1"><stop stop-color="#4f8882"/><stop offset="1" stop-color="#295d5b"/></linearGradient>'+
      '<pattern id="'+id+'-stripes" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)"><rect width="23" height="46" fill="#f4f6c8" opacity=".2"/><rect width="46" height="23" fill="#eef8b5" opacity=".1"/></pattern>'+
      '<filter id="'+id+'-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-color="#253c20" flood-opacity=".24"/></filter>'+
      '<filter id="'+id+'-grain"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".13"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>'+
      '<filter id="'+id+'-fade" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="900"><feGaussianBlur stdDeviation="12"/></filter><mask id="'+id+'-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="900"><polyline points="'+routePoints+'" fill="none" stroke="white" stroke-width="'+corridor+'" stroke-linejoin="round" stroke-linecap="round" filter="url(#'+id+'-fade)"/></mask>'+
      '<clipPath id="'+id+'-fairway">'+paths('fairway')+paths('tee')+'</clipPath>'+
      '<g id="'+id+'-tree"><ellipse cx="4" cy="6" rx="14" ry="11" fill="#183827" opacity=".22"/><g fill="#365632"><circle r="12"/><circle cx="-7" cy="-4" r="8"/><circle cx="7" cy="-2" r="9"/><circle cx="1" cy="-9" r="7"/></g><g fill="#759144"><circle cx="-4" cy="-6" r="6"/><circle cx="5" cy="-5" r="5"/><circle cx="-7" cy="1" r="5"/></g><circle cx="1" cy="-8" r="3" fill="#b0bb60" opacity=".7"/></g></defs>'+
      '<rect width="600" height="900" fill="#f7f6ef"/><g mask="url(#'+id+'-mask)"><rect width="600" height="900" fill="#dce3c7"/><g fill="#c2d197">'+paths('rough')+'</g><g fill="#66844d">'+paths('wood')+'</g><g fill="url(#'+id+'-water)" stroke="#bad0b1" stroke-width="4">'+paths('water')+'</g>'+
      '<g fill="url(#'+id+'-grass)" stroke="#6c923f" stroke-width="2" filter="url(#'+id+'-shadow)">'+paths('fairway')+paths('tee')+'</g><rect width="600" height="900" fill="url(#'+id+'-stripes)" clip-path="url(#'+id+'-fairway)"/>'+
      '<g fill="#f1dfb5" stroke="#a99b70" stroke-width="2" filter="url(#'+id+'-shadow)">'+paths('bunker')+'</g><g fill="url(#'+id+'-green)" stroke="#75964a" stroke-width="4" filter="url(#'+id+'-shadow)">'+paths('green')+'</g>'+trees+'<rect width="600" height="900" fill="#b8bf85" opacity=".16" filter="url(#'+id+'-grain)"/></g>'+
      '<polyline points="'+routePoints+'" fill="none" stroke="#f9f8e6" stroke-width="2.5" stroke-dasharray="6 8" opacity=".78"/>'+mark(tee,'tee')+mark(green,'green')+
      '<g transform="translate(22 23)"><rect width="184" height="31" rx="12" fill="#e5e5d1"/><text x="92" y="20" text-anchor="middle" fill="#355244" font-size="12" font-weight="700" letter-spacing="1">CADDIE HQ GUIDE</text></g></svg><figcaption>Illustrated overview · not to scale</figcaption></figure>';
  }
  window.CaddieHoleGuide=Object.freeze({render,layout});
})();
