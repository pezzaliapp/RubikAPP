// RubikApp — minimal 3×3 cube in CSS 3D
(() => {
  const faceOrder = ['U','R','F','D','L','B']; // standard order
  const colors = { U:'cU', D:'cD', F:'cF', B:'cB', L:'cL', R:'cR' };

  const stateKey = 'rubikapp-state-v1';
  const cubeEl = document.getElementById('cube');
  const sceneEl = document.getElementById('scene');
  const speedInput = document.getElementById('speed');

  let animationMs = +speedInput.value;
  speedInput.addEventListener('input', () => animationMs = +speedInput.value);

  // Camera/orbit state
  let rotX = -24, rotY = -32, isDragging = false, lastX=0, lastY=0;
  const updateCamera = () => {
    cubeEl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  };
  updateCamera();
  const startDrag = (x,y) => { isDragging=true; lastX=x; lastY=y; sceneEl.classList.add('grabbing'); };
  const moveDrag = (x,y) => {
    if(!isDragging) return;
    rotY += (x-lastX)*0.4;
    rotX -= (y-lastY)*0.4; rotX = Math.max(-85, Math.min(85, rotX));
    lastX = x; lastY = y;
    updateCamera();
  };
  const endDrag = ()=>{ isDragging=false; sceneEl.classList.remove('grabbing'); };
  sceneEl.addEventListener('mousedown', e=>startDrag(e.clientX,e.clientY));
  window.addEventListener('mousemove', e=>moveDrag(e.clientX,e.clientY));
  window.addEventListener('mouseup', endDrag);
  sceneEl.addEventListener('touchstart', e=>{ const t=e.touches[0]; startDrag(t.clientX,t.clientY); }, {passive:true});
  window.addEventListener('touchmove', e=>{ const t=e.touches[0]; moveDrag(t.clientX,t.clientY); }, {passive:true});
  window.addEventListener('touchend', endDrag);

  // Model: each face is array of 9 stickers (0..8)
  let cube = resetCube();
  let history = [], future = [];

  function resetCube(){
    const res = {};
    for(const f of faceOrder){
      res[f] = Array(9).fill(f); // center defines color
    }
    return res;
  }

  function saveState() {
    localStorage.setItem(stateKey, JSON.stringify({cube, rotX, rotY}));
  }
  function loadState() {
    try {
      const data = JSON.parse(localStorage.getItem(stateKey));
      if(!data) return;
      cube = data.cube || cube;
      rotX = data.rotX ?? rotX;
      rotY = data.rotY ?? rotY;
      updateCamera();
    } catch(e){}
  }

  // Render
  function render(){
    cubeEl.innerHTML = '';
    for(const f of faceOrder){
      const face = document.createElement('div');
      face.className = 'face ' + f;
      const arr = cube[f];
      for(let i=0;i<9;i++){
        const st = document.createElement('div');
        st.className = 'sticker ' + colors[arr[i]];
        face.appendChild(st);
      }
      cubeEl.appendChild(face);
    }
  }

  // Rotation helpers
  const rotateFace = (arr, times=1) => {
    // Rotate face 3x3 clockwise 'times' times
    for(let t=0;t<times;t++){
      const a = arr.slice();
      arr[0]=a[6]; arr[1]=a[3]; arr[2]=a[0];
      arr[3]=a[7];              arr[5]=a[1];
      arr[6]=a[8]; arr[7]=a[5]; arr[8]=a[2];
    }
  };

  // Adjacent ring indices per move (clockwise when looking at the face)
  const rings = {
    U: { order: ['B','R','F','L'],
         idx:   [[0,1,2],[0,1,2],[0,1,2],[0,1,2]] },
    D: { order: ['F','R','B','L'],
         idx:   [[6,7,8],[6,7,8],[6,7,8],[6,7,8]] },
    F: { order: ['U','R','D','L'],
         idx:   [[6,7,8],[0,3,6],[2,1,0],[8,5,2]] },
    B: { order: ['U','L','D','R'],
         idx:   [[2,1,0],[0,3,6],[6,7,8],[8,5,2]] },
    R: { order: ['U','B','D','F'],
         idx:   [[2,5,8],[0,3,6],[2,5,8],[2,5,8]] },
    L: { order: ['U','F','D','B'],
         idx:   [[0,3,6],[0,3,6],[0,3,6],[8,5,2]] },
  };

  function applyMove(move, animate=true){
    const base = move[0];
    if(!rings[base]) return;
    let times = 1;
    if(move.endsWith('2')) times = 2;
    else if(move.endsWith("'")) times = 3; // 3 CW = 1 CCW

    history.push(JSON.stringify(cube));
    future.length = 0;

    // animate by delaying render changes to simulate rotation
    doTurn(base, times, animate).then(()=>{
      saveState();
    });
  }

  async function doTurn(base, times, animate){
    const ring = rings[base];
    // face rotation
    rotateFace(cube[base], times);

    // cycle ring stickers times
    for(let t=0;t<times;t++){
      const temp = ring.idx[0].map(i => cube[ring.order[0]][i]);
      for(let k=0;k<3;k++){
        const from = ring.order[(k+1)%4];
        const to   = ring.order[k];
        const idxFrom = ring.idx[(k+1)%4];
        const idxTo   = ring.idx[k];
        idxTo.forEach((pos, j) => cube[to][pos] = cube[from][idxFrom[j]]);
      }
      ring.idx[3].forEach((pos, j) => cube[ring.order[3]][pos] = temp[j]);
    }

    // simple animation by toggling a class on the cube (duration = animationMs)
    if(animate){
      cubeEl.style.transition = `transform ${animationMs}ms ease`;
      // brief nudge to hint motion (no actual 3D layer rotation of sub-slices for simplicity)
      cubeEl.style.transform += ' rotateZ(0.0001deg)';
      render();
      await new Promise(r=>setTimeout(r, animationMs));
      cubeEl.style.transition = '';
    } else {
      render();
    }
  }

  // Controls
  function handleKey(e){
    const key = e.key.toUpperCase();
    if("UDLRFB".includes(key)){
      let m = key;
      if(e.shiftKey) m = key+"'";
      if(e.altKey || e.ctrlKey) m = key+'2';
      applyMove(m);
    } else if(key==='S') scramble();
    else if(key==='X') { cube = resetCube(); render(); saveState(); }
    else if(key==='Z') undo();
    else if(key==='Y') redo();
  }
  window.addEventListener('keydown', handleKey);

  function scramble(){
    const moves = ['U','D','L','R','F','B'];
    let last = '';
    const seq = [];
    for(let i=0;i<25;i++){
      let m;
      do { m = moves[(Math.random()*6)|0]; } while(m===last);
      last = m;
      const mod = ['',"'",'2'][(Math.random()*3)|0];
      seq.push(m+mod);
    }
    playAlgorithm(seq.join(' '));
  }

  function playAlgorithm(alg){
    const tokens = alg.trim().split(/\s+/).filter(Boolean);
    let p = Promise.resolve();
    tokens.forEach(tok => {
      p = p.then(()=> new Promise(res=>{ applyMove(tok); setTimeout(res, animationMs); }));
    });
  }

  function undo(){
    if(!history.length) return;
    future.push(JSON.stringify(cube));
    cube = JSON.parse(history.pop());
    render();
    saveState();
  }
  function redo(){
    if(!future.length) return;
    history.push(JSON.stringify(cube));
    cube = JSON.parse(future.pop());
    render();
    saveState();
  }

  // UI hooks
  document.querySelectorAll('.pad [data-move]').forEach(btn=>{
    btn.addEventListener('click', () => applyMove(btn.dataset.move));
  });
  document.getElementById('btn-scramble').addEventListener('click', scramble);
  document.getElementById('btn-reset').addEventListener('click', () => { cube=resetCube(); render(); saveState(); });
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  const helpDlg = document.getElementById('help');
  document.getElementById('btn-help').addEventListener('click', ()=>helpDlg.showModal());
  document.getElementById('btn-close-help').addEventListener('click', ()=>helpDlg.close());

  // Export/Import
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({cube, rotX, rotY}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rubikapp-state.json'; a.click();
    URL.revokeObjectURL(url);
  });
  const fileImport = document.getElementById('file-import');
  document.getElementById('btn-import').addEventListener('click', ()=>fileImport.click());
  fileImport.addEventListener('change', async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const text = await f.text();
    try{
      const data = JSON.parse(text);
      cube = data.cube || cube;
      rotX = data.rotX ?? rotX;
      rotY = data.rotY ?? rotY;
      updateCamera();
      render(); saveState();
    }catch(err){ alert('Import non valido'); }
  });

  
  // --- Mobile face rotate: long-press + swipe on a face ---
  let pressTimer=null, pressStart=null, pressFace=null, gestureActive=false;
  function faceFromTarget(target){
    return target.closest('.face')?.classList?.[1] || null; // U,D,F,B,L,R
  }
  function onTouchStartFace(e){
    const t = e.targetTouches[0];
    const f = faceFromTarget(e.target);
    if(!f) return;
    pressStart = {x:t.clientX, y:t.clientY, time:Date.now()};
    pressFace = f;
    pressTimer = setTimeout(()=>{ gestureActive=true; }, 220); // long-press
  }
  function onTouchMoveFace(e){
    if(!gestureActive) return;
    e.preventDefault(); // we are in gesture, block page scroll
    const t = e.targetTouches[0];
    const dx = t.clientX - pressStart.x;
    const dy = t.clientY - pressStart.y;
    const absx = Math.abs(dx), absy = Math.abs(dy);
    if (absx < 24 && absy < 24) return; // need a meaningful swipe
    let move = null;
    // Map swipe to cw/ccw on selected face (simple heuristic):
    // horizontal right = cw for F, up = cw for U, etc.
    const cw = (absx > absy) ? (dx > 0) : (dy < 0); // right or up -> cw
    const base = pressFace;
    move = base + (cw ? '' : "'");
    applyMove(move);
    gestureActive=false; clearTimeout(pressTimer);
  }
  function onTouchEndFace(){
    clearTimeout(pressTimer);
    gestureActive=false; pressFace=null;
  }
  sceneEl.addEventListener('touchstart', onTouchStartFace, {passive:true});
  sceneEl.addEventListener('touchmove', onTouchMoveFace, {passive:false});
  sceneEl.addEventListener('touchend', onTouchEndFace);

  // Boot
  loadState();
  render();
})();