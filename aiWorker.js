const PROMOTE={P:"+P",L:"+L",N:"+N",S:"+S",B:"+B",R:"+R"};
const UNPROMOTE={"+P":"P","+L":"L","+N":"N","+S":"S","+B":"B","+R":"R"};
const PROMOTABLE={P:1,L:1,N:1,S:1,B:1,R:1};
let stop=false;
let bestMove=null;
let startTime=0;
self.onmessage=e=>{
  const d=e.data;
  if(d.type==='start'){
    stop=false;
    bestMove=null;
    iterative(d.state);
    postMessage(bestMove);
  }else if(d.type==='stop'){
    stop=true;
    postMessage(bestMove);
  }
};
function iterative(state){
  startTime=Date.now();
  for(let depth=1;depth<=5;depth++){
    const [v,m]=search(state,depth,-1e9,1e9,true);
    if(stop||Date.now()-startTime>10000)break;
    bestMove=m;
  }
}
function search(s,depth,alpha,beta,root){
  if(stop||Date.now()-startTime>10000)return[evalState(s),null];
  if(depth===0)return[evalState(s),null];
  const moves=generateLegalMoves(s,s.turn);
  let best=null;
  if(root)moves.sort(()=>Math.random()-0.5);
  for(const mv of moves){
    const ns=clone(s);
    applyMove(ns,mv);
    const [v]=search(ns,depth-1,-beta,-alpha,false);
    const score=-v;
    if(score>alpha){
      alpha=score;best=mv;
      if(alpha>=beta)break;
    }
    if(stop||Date.now()-startTime>10000)break;
  }
  return[alpha,best];
}
function evalState(s){
  const val={P:100,L:300,N:300,S:400,G:500,B:700,R:800,K:0,'+P':500,'+L':500,'+N':500,'+S':500,'+B':900,'+R':1000};
  let v=0;
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(p)v+=(p.c? -1:1)*val[p.t];
  }
  for(let c=0;c<2;c++){
    const h=s.hand[c];
    for(let k in h)v+=(c? -1:1)*val[k]*(h[k]||0);
  }
  return v;
}
// helper functions compatible with main thread
function clone(s){
  return{board:s.board.map(p=>p?{t:p.t,c:p.c}:null),hand:s.hand.map(h=>({...h})),turn:s.turn};
}
function applyMove(s,m){
  if(m.from>=0){
    const p=s.board[m.from];
    s.board[m.from]=null;
    if(m.capture)s.hand[p.c][m.capture]=(s.hand[p.c][m.capture]||0)+1;
    if(m.promote)p.t=m.promoteTo;
    s.board[m.to]=p;
  }else{
    s.hand[s.turn][m.drop]--;
    s.board[m.to]={t:m.drop,c:s.turn};
  }
  s.turn^=1;
}
function generateLegalMoves(s,color){
  const moves=generateMoves(s,color);
  return moves.filter(m=>{const ns=clone(s);applyMove(ns,m);return !isCheck(ns,color);});
}
function generateMoves(s,color){
  const moves=[];
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(!p||p.c!==color)continue;
    genPieceMoves(i,p.t,color,s.board,moves);
  }
  const hand=s.hand[color];
  for(let k in hand){
    if(hand[k]>0){
      for(let i=0;i<81;i++)if(!s.board[i]){
        if(k==='P'&&invalidPawnDrop(i,color,s))continue;
        moves.push({from:-1,to:i,drop:k});
      }
    }
  }
  return moves;
}
function invalidPawnDrop(to,color,s){
  const file=to%9;
  for(let r=0;r<9;r++){const p=s.board[r*9+file];if(p&&p.c===color&&p.t==='P')return true;}
  const ns=clone(s);applyMove(ns,{from:-1,to,drop:'P'});return isMate(ns,color^1);
}
function genPieceMoves(idx,type,c,b,moves){
  const dirs={
    P:[[0,1]],
    L:[[0,1,true]],
    N:[[1,2],[-1,2]],
    S:[[0,1],[1,1],[-1,1],[1,-1],[-1,-1]],
    G:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1]],
    K:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1],[1,-1],[-1,-1]],
    B:[[1,1,true],[-1,1,true],[1,-1,true],[-1,-1,true]],
    R:[[0,1,true],[0,-1,true],[1,0,true],[-1,0,true]]
  };
  const add=(dx,dy,slide)=>{
    let x=idx%9,y=8-Math.floor(idx/9);if(c)dy=-dy;
    for(let n=1;;n++){
      const nx=x+dx*n,ny=y+dy*n;if(nx<0||nx>8||ny<0||ny>8)break;
      const ni=(8-ny)*9+nx;const t=b[ni];
      const promo=needPromote(type,c,idx,ni);
      const addMove=(pr)=>{
        const mv={from:idx,to:ni};
        if(pr){mv.promote=true;mv.promoteTo=PROMOTE[type];}
        if(t&&t.c!==c)mv.capture=UNPROMOTE[t.t]||t.t;
        moves.push(mv);
      };
      if(!t){
        addMove(false);
        if(promo)addMove(true);
      }else{
        if(t.c!==c){
          addMove(false);
          if(promo)addMove(true);
        }
        break;
      }
      if(!slide)break;
    }
  };
  let ps=dirs[type];
  if(!ps&&type[0]==='+')ps=dirs.G;
  if(type==='+B')ps=dirs.B.concat(dirs.R);
  if(type==='+R')ps=dirs.R.concat(dirs.B);
  if(!ps)return;
  for(const d of ps)add(d[0],d[1],d[2]);
}
function needPromote(type,c,from,to){
  if(!PROMOTABLE[type])return false;
  const fy=8-Math.floor(from/9),ty=8-Math.floor(to/9);
  const zone=y=>c?y<3:y>5;
  return zone(fy)||zone(ty);
}
function isCheck(s,color){
  const k=findKing(s,color);
  return attacksTo(s,k,color^1).length>0;
}
function findKing(s,color){
  for(let i=0;i<81;i++){const p=s.board[i];if(p&&p.c===color&&p.t==='K')return i;}
  return -1;
}
function attacksTo(s,idx,att){
  const moves=[];
  for(let i=0;i<81;i++){const p=s.board[i];if(p&&p.c===att)genPieceMoves(i,p.t,att,s.board,moves);}
  return moves.filter(m=>m.to===idx);
}
function isMate(s,color){
  if(!isCheck(s,color))return false;
  return generateLegalMoves(s,color).length===0;
}
