const http = require('http');
const fs = require('fs');
const path = require('path');
const { Shogi, Color } = require('shogi.js');

let game = new Shogi();
let history = [];

function sendFile(res, filepath, type) {
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
    } else {
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    }
  });
}

function getState() {
  const board = [];
  for (let y = 1; y <= 9; y++) {
    const row = [];
    for (let x = 1; x <= 9; x++) {
      const p = game.get(x, y);
      row.push(p ? { color: p.color, kind: p.kind } : null);
    }
    board.push(row);
  }
  return {
    board,
    hands: {
      0: game.hands[Color.Black].map(p => p.kind),
      1: game.hands[Color.White].map(p => p.kind)
    },
    turn: game.turn,
    message: ''
  };
}

function hasMove(color) {
  for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
      const p = game.get(x, y);
      if (p && p.color === color && game.getMovesFrom(x, y).length > 0) {
        return true;
      }
    }
  }
  if (game.getDropsBy(color).length > 0) return true;
  return false;
}

function isKingCaptured() {
  let b = false;
  let w = false;
  for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
      const p = game.get(x, y);
      if (p && p.kind === 'OU') {
        if (p.color === Color.Black) b = true; else w = true;
      }
    }
  }
  return !(b && w);
}

function aiMove() {
  const color = game.turn;
  const moves = [];
  for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
      const p = game.get(x, y);
      if (p && p.color === color) {
        game.getMovesFrom(x, y).forEach(m => moves.push({ type: 'move', from: m.from, to: m.to }));
      }
    }
  }
  game.getDropsBy(color).forEach(d => moves.push({ type: 'drop', to: d.to, kind: d.kind }));
  if (moves.length === 0) return;
  const mv = moves[Math.floor(Math.random() * moves.length)];
  history.push(game.toSFENString());
  if (mv.type === 'move') {
    game.move(mv.from.x, mv.from.y, mv.to.x, mv.to.y, true);
  } else {
    game.drop(mv.to.x, mv.to.y, mv.kind, color);
  }
}

function handleMessage() {
  let message = '';
  const opp = game.turn === Color.Black ? Color.White : Color.Black;
  if (isKingCaptured()) {
    message = (opp === Color.Black ? '先手' : '後手') + 'の勝ち！';
    game = new Shogi();
    history = [];
  } else if (!hasMove(game.turn) && game.isCheck(game.turn)) {
    message = (game.turn === Color.Black ? '先手' : '後手') + 'は詰みです。';
  } else if (game.isCheck(game.turn)) {
    message = '王手！';
  }
  return message;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    if (req.url === '/' || req.url === '/index.html') {
      return sendFile(res, path.join(__dirname, 'index.html'), 'text/html');
    } else if (req.url === '/app.js') {
      return sendFile(res, path.join(__dirname, 'app.js'), 'application/javascript');
    } else if (req.url === '/style.css') {
      return sendFile(res, path.join(__dirname, 'style.css'), 'text/css');
    } else if (req.url.startsWith('/state')) {
      const st = getState();
      st.message = handleMessage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(st));
    } else if (req.url.startsWith('/moves')) {
      const u = new URL(req.url, 'http://localhost');
      const x = parseInt(u.searchParams.get('x'));
      const y = parseInt(u.searchParams.get('y'));
      const moves = game.getMovesFrom(x, y).map(m => m.to);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ moves }));
    } else if (req.url.startsWith('/drops')) {
      const u = new URL(req.url, 'http://localhost');
      const kind = u.searchParams.get('kind');
      const color = game.turn;
      const drops = game.getDropsBy(color).filter(d => d.kind === kind).map(d => d.to);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ drops }));
    }
    res.writeHead(404); res.end('not found');
  } else if (req.method === 'POST') {
    if (req.url === '/move') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          history.push(game.toSFENString());
          if (data.from) {
            game.move(+data.from.x, +data.from.y, +data.to.x, +data.to.y, true);
          } else if (data.drop) {
            game.drop(+data.drop.x, +data.drop.y, data.drop.kind);
          }
          if (!isKingCaptured()) aiMove();
          const st = getState();
          st.message = handleMessage();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(st));
        } catch (e) {
          if (history.length) game.initializeFromSFENString(history.pop());
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(getState()));
        }
      });
    } else if (req.url === '/undo') {
      if (history.length) {
        const s = history.pop();
        game.initializeFromSFENString(s);
      }
      const st = getState();
      st.message = handleMessage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(st));
    } else {
      res.writeHead(404); res.end('not found');
    }
  }
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
