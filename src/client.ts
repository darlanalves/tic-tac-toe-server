import { PlayerState, ClientPlay } from './types';

enum Player {
  A = 'a',
  B = 'b',
}

let session: PlayerState;
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

function updateStateView() {
  document.getElementById('state').innerText = toJSON(session);
}

function updateBoard() {
  if (!session) {
    return;
  }

  const boardCells = Array.from(document.querySelectorAll('.board__cell'))
    .map((cell: HTMLDivElement) => ({
      node: cell,
      position: Number(cell.dataset.position),
    }));

  const isPlayerA = session.player === Player.A;
  const allMoves = session.state.moves;

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

    let state = 'tic';

    if (tac) {
      state = 'tac';
    }

    if (toe) {
      state = 'toe';
    }

    cell.node.setAttribute('data-state', state);
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
        break;

      case 'join':
        session = action.payload;
        break;

      case 'update':
        if (!session) {
          return;
        }

        session.state = action.payload;
        break;
    }

    updateBoard();
    updateStateView();
    updateSessionList();
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

function updateSessionList() {
  fetch('/sessions').then(v => v.json()).then((sessions) => {
    document.getElementById('session-list').innerHTML = sessions
      .map((item) =>
        `<li class="session-list__item">
          <strong>${item.id}</strong>
          <span>${item.playerA}</span>
          <span>${item.playerB}</span>
          <span><button class="button" onclick="TTT.join('${item.id}')">join</button></span>
        </li>`)
      .join('');
  });
}

class TicTacToe {
  get client() {
    return client;
  }

  get session() {
    return session;
  }

  join(sessionId = '') {
    if (client) {
      const playerId = sessionStorage.getItem('playerId');

      if (!sessionId) {
        sessionId = session ? session.state.id : '';
      }

      client.send(toJSON({ type: 'requestjoin', payload: { playerId, sessionId } }));
    }
  }

  play(position: number) {
    if (!client || !session) {
      return;
    }

    const play: ClientPlay = {
      id: session.state.id,
      play: {
        position,
        player: session.player,
      }
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
    updateSessionList();
    document.body.addEventListener('click', e => TTT.onCellClick(e));
    TTT.start();
  });
})();

