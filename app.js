let state = null;

function pieceKanji(kind) {
  const map = {FU:"歩",KY:"香",KE:"桂",GI:"銀",KI:"金",KA:"角",HI:"飛",OU:"玉",TO:"と",NY:"成香",NK:"成桂",NG:"成銀",UM:"馬",RY:"龍"};
  return map[kind] || kind;
}

function colorName(color){ return color==0?"先手":"後手"; }

async function loadState(){
  const res = await fetch('/state');
  state = await res.json();
  render();
}

function render(){
  const board = document.getElementById('board');
  board.innerHTML='';
  for(let y=9;y>=1;y--){
    for(let x=1;x<=9;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.x=x; cell.dataset.y=y;
      const p=state.board[y-1][x-1];
      if(p){
        const div=document.createElement('div');
        div.className='piece '+(p.color===1?'white':'black');
        div.draggable=true;
        div.dataset.x=x; div.dataset.y=y;
        div.innerText=pieceKanji(p.kind);
        cell.appendChild(div);
      }
      board.appendChild(cell);
    }
  }
  renderHands('black-hands', state.hands[0], 'black');
  renderHands('white-hands', state.hands[1], 'white');
  document.getElementById('turn').innerText=colorName(state.turn)+"の番";
  document.getElementById('message').innerText=state.message||'';
}

function renderHands(id, list, cls){
  const el=document.getElementById(id);
  el.innerHTML='';
  const counts={};
  for(const k of list){counts[k]=(counts[k]||0)+1;}
  for(const k in counts){
    const div=document.createElement('div');
    div.className='piece '+cls;
    div.draggable=true;
    div.dataset.kind=k;
    div.innerText=pieceKanji(k)+counts[k];
    el.appendChild(div);
  }
}

document.addEventListener('dragstart', async e=>{
  if(!e.target.classList.contains('piece')) return;
  const x=e.target.dataset.x;
  const y=e.target.dataset.y;
  if(x&&y){
    const res=await fetch(`/moves?x=${x}&y=${y}`);
    const data=await res.json();
    highlight(data.moves);
    e.dataTransfer.setData('text/plain', JSON.stringify({type:'move',x,y}));
  }else if(e.target.dataset.kind){
    const kind=e.target.dataset.kind;
    const res=await fetch(`/drops?kind=${kind}`);
    const data=await res.json();
    highlight(data.drops);
    e.dataTransfer.setData('text/plain', JSON.stringify({type:'drop',kind}));
  }
});

document.addEventListener('dragend',()=>highlight([]));

document.addEventListener('dragover',e=>{
  if(e.target.closest('.cell')) e.preventDefault();
});

document.addEventListener('drop', async e=>{
  const cell=e.target.closest('.cell');
  if(!cell) return;
  e.preventDefault();
  const data=JSON.parse(e.dataTransfer.getData('text/plain'));
  const x=cell.dataset.x; const y=cell.dataset.y;
  if(data.type==='move'){
    const res=await fetch('/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:{x:data.x,y:data.y},to:{x,y}})});
    state=await res.json();
    render();
  }else if(data.type==='drop'){
    const res=await fetch('/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({drop:{kind:data.kind,x,y}})});
    state=await res.json();
    render();
  }
});

function highlight(cells){
  document.querySelectorAll('.cell').forEach(c=>c.classList.remove('highlight'));
  cells.forEach(pos=>{
    const cell=document.querySelector(`.cell[data-x='${pos.x}'][data-y='${pos.y}']`);
    if(cell) cell.classList.add('highlight');
  });
}

document.getElementById('undo').addEventListener('click', async ()=>{
  const res=await fetch('/undo',{method:'POST'});
  state=await res.json();
  render();
});

loadState();
