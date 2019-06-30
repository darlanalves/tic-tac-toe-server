import { ClientPlay, GameState } from './types';

enum Player {
  A = 'a',
  B = 'b',
}

let state: GameState;
let client: WebSocket;

function fromJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function toJSON(object) {
  return JSON.stringify(object, null, 2);
}

function getCurrentPlayer() {
  const playerId = getPlayerId();
  return state.players.playerA === playerId ? Player.A : Player.B;
}

function getPlayerId() {
  return sessionStorage.getItem('playerId');
}

function updateBoard() {
  if (!state) {
    return;
  }

  const scoreboard = document.getElementById('scoreboard');
  const currentPlayer = getCurrentPlayer();
  scoreboard.className = 'scoreboard' +
    (state.winner === currentPlayer && ' scoreboard--winner' || '') +
    (state.winner && state.winner !== currentPlayer && ' scoreboard--loser' || '');

  const board = document.getElementById('board');
  board.setAttribute('player', currentPlayer);
  board.setAttribute('turn', state.turn);

  const boardCells = Array.from(board.querySelectorAll('.board__cell'))
    .map((cell: HTMLDivElement) => ({
      node: cell,
      position: Number(cell.dataset.position),
    }));

  const isPlayerA = currentPlayer === Player.A;
  const allMoves = state.moves;

  let moves: { player: number[]; opponent: number[]; };

  if (isPlayerA) {
    moves = {
      player: allMoves.playerA,
      opponent: allMoves.playerB,
    };
  } else {
    moves = {
      player: allMoves.playerB,
      opponent: allMoves.playerA,
    };
  }

  boardCells.forEach(cell => {
    let tac = false;
    let toe = false;

    if (isPlayerA) {
      tac = moves.player.indexOf(cell.position) > -1;
      toe = moves.opponent.indexOf(cell.position) > -1;
    } else {
      tac = moves.opponent.indexOf(cell.position) > -1;
      toe = moves.player.indexOf(cell.position) > -1;
    }

    let cellState = 'tic';

    if (tac) {
      cellState = 'tac';
    }

    if (toe) {
      cellState = 'toe';
    }

    cell.node.setAttribute('data-state', cellState);
  });
}

function startClient(endpoint) {
  client = new WebSocket(endpoint);

  client.onmessage = (event) => {
    const action = fromJSON(event.data);
    console.log('INCOMING', toJSON(action));

    if (!action) {
      return;
    }

    switch (action.type) {
      case 'register':
        sessionStorage.setItem('playerId', action.payload.id);
        client.send(toJSON({
          type: 'requestjoin', payload: {
            playerId: action.payload.id,
            sessionId: ''
          }
        }));
        break;

      case 'updatesessionlist':
        updateSessionList(action.payload);
        break;

      case 'update':
        state = action.payload;
        break;
    }

    updateBoard();
  };

  client.onopen = () => {
    console.log('Connected');

    const playerId = sessionStorage.getItem('playerId');
    client.send(toJSON({
      type: 'register',
      payload: { id: playerId }
    }));
  };

  client.onclose = () => {
    console.log('Disconnected');
    client = null;
  };
}

function updateSessionList(sessions) {
  document.getElementById('session-list').innerHTML = sessions
    .map((item) =>
      `<li class="session-list__item">
        <strong>${item.id}</strong>
        <span>${item.playerA || '-'}</span>
        <span>${item.playerB || '-'}</span>
        <span><button class="button" onclick="TTT.join('${item.id}')">join</button></span>
      </li>`)
    .join('');
}

class TicTacToe {
  get client() {
    return client;
  }

  get session() {
    return state;
  }

  join(sessionId = '') {
    if (client) {
      const playerId = sessionStorage.getItem('playerId');

      if (sessionId === 'new') {
        client.send(toJSON({ type: 'requestnew', payload: { playerId } }));
        return;
      }

      if (!sessionId) {
        sessionId = state ? state.id : '';
      }

      client.send(toJSON({ type: 'requestjoin', payload: { playerId, sessionId } }));
    }
  }

  play(position: number) {
    if (!client || !state) {
      return;
    }

    const play: ClientPlay = {
      id: state.id,
      playerId: getPlayerId(),
      position,
    };

    client.send(toJSON({
      type: 'play',
      payload: play
    }));
  }

  reset() {
    fetch('/reset');
  }

  start() {
    fetch('/sockets').then(output => output.json()).then(sockets => {
      if (!sockets.length) {
        console.log('No server available');
        return;
      }

      startClient(sockets[0].url);
    });
  }

  onCellClick(event: MouseEvent) {
    const cell = event.target as HTMLDivElement;
    const position = cell.dataset.position;

    if (position) {
      this.play(Number(position));
    }
  }
}

export const TTT = new TicTacToe();

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', e => TTT.onCellClick(e));
    TTT.start();
  });
})();

