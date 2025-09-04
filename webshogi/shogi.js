const boardElement = document.getElementById('board');
const handElements = [document.getElementById('hand0'), document.getElementById('hand1')];
const turnElement = document.getElementById('turn');
const undoButton = document.getElementById('undo');
if (undoButton) undoButton.addEventListener('click', undoMove);

const PIECES = {
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '王',
  PB: '馬', PR: '龍', PP: 'と', PL: '成香', PN: '成桂', PS: '成銀'
};

let board = [];
let hands = [{}, {}]; // piece counts
let currentPlayer = 0; // 0: 先手(bottom), 1: 後手(top)
let selected = null; // {x,y} or {piece:'P'} for drop
let dragged = null;
let history = [];

function saveState() {
  history.push(JSON.parse(JSON.stringify({board, hands, currentPlayer})));
}

function undoMove() {
  if (history.length <= 1) return;
  history.pop();
  const state = history[history.length-1];
  board = JSON.parse(JSON.stringify(state.board));
  hands = JSON.parse(JSON.stringify(state.hands));
  currentPlayer = state.currentPlayer;
  render();
}

function initBoard() {
  board = [
    [ {t:'L',p:1}, {t:'N',p:1}, {t:'S',p:1}, {t:'G',p:1}, {t:'K',p:1}, {t:'G',p:1}, {t:'S',p:1}, {t:'N',p:1}, {t:'L',p:1} ],
    [ null, {t:'R',p:1}, null, null, null, null, null, {t:'B',p:1}, null ],
    [ {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1}, {t:'P',p:1} ],
    [ null,null,null,null,null,null,null,null,null ],
    [ null,null,null,null,null,null,null,null,null ],
    [ null,null,null,null,null,null,null,null,null ],
    [ {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0}, {t:'P',p:0} ],
    [ null, {t:'B',p:0}, null, null, null, null, null, {t:'R',p:0}, null ],
    [ {t:'L',p:0}, {t:'N',p:0}, {t:'S',p:0}, {t:'G',p:0}, {t:'K',p:0}, {t:'G',p:0}, {t:'S',p:0}, {t:'N',p:0}, {t:'L',p:0} ]
  ];
  hands = [{}, {}];
}

function render() {
  boardElement.innerHTML = '';
  for (let y=0; y<9; y++) {
    for (let x=0; x<9; x++) {
      const cell = document.createElement('div');
      cell.className = 'square';
      cell.dataset.x = x; cell.dataset.y = y;
      const piece = board[y][x];
      if (piece) {
        cell.textContent = PIECES[piece.t] || piece.t;
        if (piece.p===1) cell.style.transform='rotate(180deg)';
        if(piece.p===currentPlayer) cell.setAttribute('draggable','true');
      }
      cell.addEventListener('click', onSquareClick);
      cell.addEventListener('dragstart', onDragStart);
      cell.addEventListener('dragover', onDragOver);
      cell.addEventListener('drop', onDrop);
      cell.addEventListener('dragend', onDragEnd);
      boardElement.appendChild(cell);
    }
  }
  for(let i=0;i<2;i++) {
    const el = handElements[i];
    el.innerHTML='';
    for(const [pt,count] of Object.entries(hands[i])) {
      if(count>0){
        const span=document.createElement('span');
        span.textContent=PIECES[pt]+'('+count+')';
        span.dataset.piece=pt; span.dataset.owner=i;
        span.addEventListener('click', onHandClick);
        span.setAttribute('draggable','true');
        span.addEventListener('dragstart', onDragStart);
        el.appendChild(span);
      }
    }
  }
  if(turnElement){
    turnElement.textContent = currentPlayer===0 ? '先手の番' : '後手の番';
  }
}

function inside(x,y){return x>=0&&x<9&&y>=0&&y<9;}

function legalMoves(x,y,piece){
  const dirs={
    P:[[0,-1]],
    L:[[0,-1,9]],
    N:[[ -1,-2],[1,-2]],
    S:[[ -1,-1],[0,-1],[1,-1],[-1,1],[1,1]],
    G:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
    K:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
    B:[[ -1,-1,9],[1,-1,9],[-1,1,9],[1,1,9]],
    R:[[0,-1,9],[0,1,9],[-1,0,9],[1,0,9]],
    PB:[[ -1,-1,9],[1,-1,9],[-1,1,9],[1,1,9],[ -1,0],[1,0],[0,-1],[0,1]],
    PR:[[0,-1,9],[0,1,9],[-1,0,9],[1,0,9],[ -1,-1],[1,-1],[-1,1],[1,1]],
    PP:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
    PL:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
    PN:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
    PS:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]]
  };
  let res=[];
  const dlist=dirs[piece.t];
  const forward = piece.p===0 ? 1 : -1;
  for(const d of dlist){
    const dx=d[0]; const dy=d[1];
    const repeat=d[2]||1;
    for(let i=1;i<=repeat;i++){
      const nx=x+dx*i;
      const ny=y+(dy*i*forward);
      if(!inside(nx,ny)) break;
      const target=board[ny][nx];
      if(target && target.p===piece.p) break;
      res.push({x:nx,y:ny});
      if(target) break;
    }
  }
  return res;
}

function onSquareClick(e){
  const x=parseInt(e.currentTarget.dataset.x);
  const y=parseInt(e.currentTarget.dataset.y);
  if(selected){
    const pieceHere = board[y][x];
    if(pieceHere && pieceHere.p===currentPlayer){
      selected = {x, y};
      highlightMoves(legalMoves(x, y, pieceHere));
      return;
    }
    if(selected.piece){
      if(moveDrop(x, y, selected.piece, selected.owner)){
        selected = null; render();
      }else{
        showMessage('そこには移動できません');
      }
    } else {
      if(movePiece(selected.x, selected.y, x, y)){
        selected = null; render();
      }else{
        showMessage('そこには移動できません');
      }
    }
  } else {
    const piece = board[y][x];
    if(piece && piece.p===currentPlayer){
      selected = {x, y};
      highlightMoves(legalMoves(x, y, piece));
    }
  }
}

function onHandClick(e){
  const piece=e.currentTarget.dataset.piece;
  const owner=parseInt(e.currentTarget.dataset.owner);
  if(owner!==currentPlayer) return;
  selected={piece,owner};
  highlightDrops(piece,owner);
  showMessage('盤面をクリックして置きます');
}

function onDragStart(e){
  const x=e.currentTarget.dataset.x;
  const y=e.currentTarget.dataset.y;
  if(x!==undefined){
    const piece=board[y][x];
    if(!piece||piece.p!==currentPlayer){e.preventDefault();return;}
    dragged={type:'move',x:parseInt(x),y:parseInt(y)};
    highlightMoves(legalMoves(dragged.x,dragged.y,piece));
  }else{
    const pieceType=e.currentTarget.dataset.piece;
    const owner=parseInt(e.currentTarget.dataset.owner);
    if(owner!==currentPlayer){e.preventDefault();return;}
    dragged={type:'drop',piece:pieceType,owner};
    highlightDrops(pieceType,owner);
  }
}

function onDragOver(e){
  e.preventDefault();
}

function onDrop(e){
  e.preventDefault();
  const x=parseInt(e.currentTarget.dataset.x);
  const y=parseInt(e.currentTarget.dataset.y);
  let ok=false;
  if(dragged){
    if(dragged.type==='move'){
      ok=movePiece(dragged.x,dragged.y,x,y);
    }else{
      ok=moveDrop(x,y,dragged.piece,dragged.owner);
    }
  }
  dragged=null;
  selected=null;
  if(ok){
    clearHighlights();
    render();
  }else{
    showMessage('そこには移動できません');
    clearHighlights();
  }
}

function onDragEnd(){
  dragged=null;
  clearHighlights();
}

function highlightMoves(moves){
  clearHighlights();
  for(const m of moves){
    const index=m.y*9+m.x;
    boardElement.children[index].classList.add('highlight');
  }
}

function highlightDrops(piece,owner){
  clearHighlights();
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(!board[y][x]){
        if(piece==='P' && pawnExists(owner,x)) continue;
        const index=y*9+x;
        boardElement.children[index].classList.add('highlight');
      }
    }
  }
}

function clearHighlights(){
  for(const child of boardElement.children){
    child.classList.remove('highlight');
  }
}

function movePiece(sx,sy,tx,ty){
  const piece=board[sy][sx];
  const moves=legalMoves(sx,sy,piece);
  if(!moves.some(m=>m.x===tx && m.y===ty)) return false;
  const target=board[ty][tx];
  if(target){
    if(target.t==='K'){
      board[sy][sx]=null;
      board[ty][tx]=piece;
      showMessage(currentPlayer===0?'先手の勝ち！':'後手の勝ち！');
      startGame();
      return true;
    }
    let base = target.t;
    if(base.length>1 && base.startsWith('P')) base = base.slice(1); // demote
    hands[currentPlayer][base] = (hands[currentPlayer][base] || 0) + 1;
  }
  board[sy][sx]=null;
  board[ty][tx]=piece;
  if(shouldPromote(piece,ty)){
    if(confirm('成りますか?')){
      promote(piece);
    }
  }
  currentPlayer=1-currentPlayer;
  if(isCheckmated(currentPlayer)){
    showMessage(currentPlayer===0?'後手の勝ち！':'先手の勝ち！');
    startGame();
  }else{
    saveState();
  }
  return true;
}

function moveDrop(x,y,pt,owner){
  if(board[y][x]) return false;
  if(pt==='P' && pawnExists(owner,x)) return false;
  board[y][x]={t:pt,p:owner};
  hands[owner][pt]--;
  currentPlayer=1-currentPlayer;
  if(isCheckmated(currentPlayer)){
    showMessage(currentPlayer===0?'後手の勝ち！':'先手の勝ち！');
    startGame();
  }else{
    saveState();
  }
  return true;
}

function pawnExists(player,x){
  for(let y=0;y<9;y++){
    const p=board[y][x];
    if(p && p.p===player && p.t==='P') return true;
  }
  return false;
}

function findKing(player){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p && p.p===player && p.t==='K') return {x,y};
    }
  }
  return null;
}

function isInCheck(player){
  const king=findKing(player);
  if(!king) return true;
  const enemy=1-player;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p && p.p===enemy){
        const moves=legalMoves(x,y,p);
        if(moves.some(m=>m.x===king.x && m.y===king.y)) return true;
      }
    }
  }
  return false;
}

function isCheckmated(player){
  if(!isInCheck(player)) return false;
  // try all moves
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const piece=board[y][x];
      if(piece && piece.p===player){
        const moves=legalMoves(x,y,piece);
        for(const m of moves){
          const captured=board[m.y][m.x];
          board[y][x]=null;
          board[m.y][m.x]=piece;
          let capCount;
          let base;
          if(captured){
            base=captured.t;
            if(base.startsWith('P')) base=base.slice(1);
            capCount=hands[player][base]||0;
            hands[player][base]=capCount+1;
          }
          const chk=isInCheck(player);
          board[y][x]=piece;
          board[m.y][m.x]=captured;
          if(captured){
            hands[player][base]=capCount;
          }
          if(!chk) return false;
        }
      }
    }
  }
  // drops
  for(const [pt,count] of Object.entries(hands[player])){
    if(count>0){
      for(let y=0;y<9;y++){
        for(let x=0;x<9;x++){
          if(board[y][x]) continue;
          if(pt==='P' && pawnExists(player,x)) continue;
          board[y][x]={t:pt,p:player};
          hands[player][pt]--;
          const chk=isInCheck(player);
          board[y][x]=null;
          hands[player][pt]++;
          if(!chk) return false;
        }
      }
    }
  }
  return true;
}

function startGame(){
  initBoard();
  currentPlayer=0;
  history=[];
  saveState();
  render();
}

function shouldPromote(piece,ty){
  if(['P','L','N','S','B','R'].includes(piece.t)){
    if(piece.p===0 && ty<=2) return true;
    if(piece.p===1 && ty>=6) return true;
  }
  return false;
}

function promote(piece){
  const map={P:'PP',L:'PL',N:'PN',S:'PS',B:'PB',R:'PR'};
  piece.t=map[piece.t]||piece.t;
}

function showMessage(msg){
  const el=document.getElementById('message');
  if(el){
    el.textContent=msg;
    setTimeout(()=>{el.textContent='';},1500);
  }else{
    alert(msg);
  }
}

startGame();
