(function(){
  'use strict';

  // ===== THEMES =====
  const PALETTES = {
    classic: { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x2f6ee6, L:0xff6c00, R:0xd80027 },
    erno:    { U:0xf7f7f7, D:0xffeb3b, F:0x2ecc71, B:0x3498db, L:0xff8f00, R:0xe53935 },
    dust:    { U:0xe8e6e3, D:0xd7c37a, F:0x6da67a, B:0x6c8ebf, L:0xd28b52, R:0xc25c5c },
    camo:    { U:0xd7dfcd, D:0xb5a96b, F:0x6b8f3e, B:0x3d5a80, L:0x8f6f3d, R:0x8b3a3a },
    rain:    { U:0xe6f3ff, D:0xfff4d6, F:0xb2f2bb, B:0xbde0fe, L:0xffd6a5, R:0xffadad }
  };
  let THEME = (function(){
    try{ return localStorage.getItem('rubik_theme') || 'classic'; }catch(e){ return 'classic'; }
  })();
  function setTheme(name){
    if(!PALETTES[name]) return;
    THEME = name;
    try{ localStorage.setItem('rubik_theme', name); }catch(e){}
    // repaint stickers in-place
    repaintStickers();
  }
  function getStickerColor(face){
    return PALETTES[THEME][face];
  }

  // --- helpers ---
  const nearly=(a,b,eps=1e-4)=>Math.abs(a-b)<eps;
  const snap90 = r => Math.round(r/(Math.PI/2))*(Math.PI/2);
  function rotateCoord(v,axis,sign){
    const x=v.x,y=v.y,z=v.z;
    if(axis==='X') return new THREE.Vector3(x,  sign>0? z:-z, sign>0?-y:y);
    if(axis==='Y') return new THREE.Vector3(sign>0?-z:z, y,  sign>0? x:-x);
    return               new THREE.Vector3(sign>0? y:-y, sign>0?-x:x, z);
  }

  // --- scene ---
  const stage=document.getElementById('stage');
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0x2a3142);
  const camera=new THREE.PerspectiveCamera(45, 1, 0.5, 100);
  camera.position.set(4.2, 3.8, 5.8); camera.lookAt(0,0,0);

  const renderer=new THREE.WebGLRenderer({antialias:true, alpha:false, logarithmicDepthBuffer:true});
  renderer.sortObjects=false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, .9));
  const key=new THREE.DirectionalLight(0xffffff, .85); key.position.set(4,7,6); scene.add(key);

  function onResize(){
    const w=stage.clientWidth, h=stage.clientHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h); renderer.render(scene,camera);
  }
  window.addEventListener('resize', onResize, {passive:true});
  new ResizeObserver(onResize).observe(stage);

  // --- cube build ---
  const size=0.98, gap=0.012, geo=new THREE.BoxGeometry(size,size,size);
  const root=new THREE.Group(); scene.add(root); const cubelets=[];

  function makeSticker(face, axis, sign){
    const g=new THREE.PlaneGeometry(0.965, 0.965);
    const m=new THREE.MeshBasicMaterial({
      color:getStickerColor(face),
      side:THREE.DoubleSide, depthTest:true, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6
    });
    const s=new THREE.Mesh(g,m); s.renderOrder=3; s.frustumCulled=false; s.userData.face = face;
    const d=0.515;
    if(axis==='x'){ s.position.x=sign*d; s.rotation.y=-sign*Math.PI/2; }
    if(axis==='y'){ s.position.y=sign*d; s.rotation.x= sign*Math.PI/2; }
    if(axis==='z'){ s.position.z=sign*d; if(sign<0) s.rotation.y=Math.PI; }
    return s;
  }
  function addCubelet(i,j,k){
    const plastic=new THREE.MeshStandardMaterial({ color:0x20232c, metalness:.1, roughness:.6 });
    const mesh=new THREE.Mesh(geo,[plastic,plastic,plastic,plastic,plastic,plastic].map(m=>m.clone()));
    mesh.frustumCulled=false;
    const s=size+gap;
    mesh.position.set(i*s, j*s, k*s);
    mesh.userData.coord=new THREE.Vector3(i,j,k);
    if(i=== 1) mesh.add(makeSticker('R','x',+1));
    if(i===-1) mesh.add(makeSticker('L','x',-1));
    if(j=== 1) mesh.add(makeSticker('U','y',+1));
    if(j===-1) mesh.add(makeSticker('D','y',-1));
    if(k=== 1) mesh.add(makeSticker('F','z',+1));
    if(k===-1) mesh.add(makeSticker('B','z',-1));
    root.add(mesh); cubelets.push(mesh);
  }
  function buildSolved(){
    while(root.children.length) root.remove(root.children[0]);
    cubelets.length=0;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++) addCubelet(i,j,k);
  }
  buildSolved(); onResize();

  function repaintStickers(){
    // Aggiorna dinamicamente i materiali degli sticker in base al tema
    for(const m of cubelets){
      for(const c of m.children){
        if(c.userData && c.userData.face){
          const hex = getStickerColor(c.userData.face);
          if(c.material && c.material.color) c.material.color.setHex(hex);
        }
      }
    }
    renderer.render(scene,camera);
  }

  // --- interaction ---
  let isOrbit=false, lastX=0, lastY=0, rotating=false, press=null;
  function orbitStart(x,y){ isOrbit=true; lastX=x; lastY=y; }
  function orbitMove(x,y){
    if(!isOrbit||rotating) return;
    const dx=(x-lastX)/120, dy=(y-lastY)/120;
    root.rotation.y += dx; root.rotation.x += dy;
    lastX=x; lastY=y;
  }
  function orbitEnd(){ isOrbit=false; }

  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
  function hitsAt(cx,cy){
    const r=renderer.domElement.getBoundingClientRect();
    ndc.x=((cx-r.left)/r.width)*2-1; ndc.y= -((cy-r.top)/r.height)*2+1;
    ray.setFromCamera(ndc,camera);
    const raw=ray.intersectObjects(root.children, true);
    return raw.map(h=>{ let o=h.object; while(o && o.parent && o.parent!==root){ o=o.parent; } return {...h, object:o}; });
  }

  function onDown(e){ const t=e.touches?e.touches[0]:e; const hs=hitsAt(t.clientX,t.clientY); if(hs.length){ press={hit:hs[0],x:t.clientX,y:t.clientY}; } else { orbitStart(t.clientX,t.clientY); } }
  function onMove(e){ const t=e.touches?e.touches[0]:e; if(isOrbit&&!rotating){ orbitMove(t.clientX,t.clientY); return; } if(!press||rotating) return; const dx=t.clientX-press.x, dy=t.clientY-press.y; if(Math.hypot(dx,dy)>18){ rotateFromGesture(press.hit,dx,dy); press=null; } }
  function onUp(){ orbitEnd(); press=null; }

  renderer.domElement.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('touchend', onUp);

  function rotateLayer(axisChar, layerCoord, sign){
    if(rotating) return; rotating=true;
    const axis = axisChar==='X'? new THREE.Vector3(1,0,0) : axisChar==='Y'? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
    const pick = axisChar==='X'? m=>nearly(m.userData.coord.x,layerCoord) : axisChar==='Y'? m=>nearly(m.userData.coord.y,layerCoord) : m=>nearly(m.userData.coord.z,layerCoord);

    const group=new THREE.Group(), layer=[];
    cubelets.forEach(m=>{ if(pick(m)){ layer.push(m); group.attach(m);} });
    scene.add(group);

    const target=(Math.PI/2)*sign, dur=180, t0=performance.now();
    function anim(now){
      const t=Math.min(1,(now-t0)/dur);
      group.rotation.x=axis.x*target*t; group.rotation.y=axis.y*target*t; group.rotation.z=axis.z*target*t;
      renderer.render(scene,camera);
      if(t<1) requestAnimationFrame(anim); else bake();
    }
    requestAnimationFrame(anim);

    function bake(){
      const s=size+gap;
      layer.forEach(m=>{ m.userData.coord.copy( rotateCoord(m.userData.coord, axisChar, sign) ); });
      layer.forEach(m=>root.attach(m)); scene.remove(group);
      layer.forEach(m=>{
        const c=m.userData.coord; m.position.set(c.x*s, c.y*s, c.z*s);
        if(axisChar==='X') m.rotation.x = snap90(m.rotation.x + sign*Math.PI/2);
        if(axisChar==='Y') m.rotation.y = snap90(m.rotation.y + sign*Math.PI/2);
        if(axisChar==='Z') m.rotation.z = snap90(m.rotation.z + sign*Math.PI/2);
      });
      rotating=false; renderer.render(scene,camera);
    }
  }

  function rotateFromGesture(hit, dx, dy){
    if(rotating) return;
    const n=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    const dom=Math.abs(dx)>Math.abs(dy)?'x':'y';
    let axisChar;
    if(Math.abs(n.z)>0.9){ axisChar=(dom==='x')?'Y':'X'; }
    else if(Math.abs(n.x)>0.9){ axisChar=(dom==='x')?'Y':'Z'; }
    else { axisChar=(dom==='x')?'Z':'X'; }
    const sign=(dom==='x')?(dx>0?1:-1):(dy<0?1:-1);
    const c=hit.object.userData.coord;
    const layerCoord= axisChar==='X'? c.x : axisChar==='Y'? c.y : c.z;
    rotateLayer(axisChar, layerCoord, sign);
  }

  document.getElementById('btn-reset').addEventListener('click', ()=>{
    root.rotation.set(0,0,0); buildSolved(); repaintStickers(); renderer.render(scene,camera);
  });
  document.getElementById('btn-scramble').addEventListener('click', async ()=>{
    if(rotating) return;
    for(let i=0;i<20;i++){
      const rand = cubelets[(Math.random()*cubelets.length)|0];
      const fake = { object:rand, face:{ normal:new THREE.Vector3(0,0,1) } };
      const dx = (Math.random()>.5?1:-1)*30, dy=(Math.random()>.5?1:-1)*30;
      await new Promise(res=>{ const iv=setInterval(()=>{ if(!rotating){ clearInterval(iv); res(); } }, 18); rotateFromGesture(fake,dx,dy); });
    }
  });

  // theme UI
  const sel = document.getElementById('theme');
  sel.value = THEME;
  sel.addEventListener('change', e=> setTheme(e.target.value));
  // initial paint (in caso di reload)
  repaintStickers();

  (function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop) })();
})();