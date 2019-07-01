import { ClientPlay, GameState, Player } from '../app/types';

function fromJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function toJSON(object: any) {
  return JSON.stringify(object, null, 2);
}

class TicTacToe {
  state: GameState;
  client: WebSocket;

  getCurrentPlayer() {
    const playerId = this.getPlayerId();
    return this.state.players.playerA === playerId ? Player.A : Player.B;
  }

  private getPlayerId() {
    return localStorage.getItem('playerId') || '';
  }

  updateBoard() {
    if (!this.state) {
      return;
    }

    const scoreboard = document.getElementById('scoreboard');
    const currentPlayer = this.getCurrentPlayer();

    scoreboard.innerText = this.state.winner ?
      (this.state.winner === currentPlayer ? 'You win!' : 'You lose!') :
      '';

    scoreboard.style.opacity = String(Number(!!this.state.winner));

    const board = document.getElementById('board');
    if (!!board.textContent.trim()) {
      board.innerHTML =
        `<div class="board__row">
          <div class="board__cell" data-position="8"></div>
          <div class="board__cell" data-position="7"></div>
          <div class="board__cell" data-position="6"></div>
        </div>
        <div class="board__row">
          <div class="board__cell" data-position="5"></div>
          <div class="board__cell" data-position="4"></div>
          <div class="board__cell" data-position="3"></div>
        </div>
        <div class="board__row">
          <div class="board__cell" data-position="2"></div>
          <div class="board__cell" data-position="1"></div>
          <div class="board__cell" data-position="0"></div>
        </div>`;
    }
    board.setAttribute('player', currentPlayer);
    board.setAttribute('turn', this.state.turn);

    const boardCells = Array.from(board.querySelectorAll('.board__cell'))
      .map((cell: HTMLDivElement) => ({
        node: cell,
        position: Number(cell.dataset.position),
      }));

    const isPlayerA = currentPlayer === Player.A;
    const allMoves = this.state.moves;

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

  startClient(endpoint) {
    console.log('Connecting to ', endpoint);

    let client = new WebSocket(endpoint);

    client.onmessage = (event) => {
      const action = fromJSON(event.data);
      console.log('INCOMING', toJSON(action));

      if (!action) {
        return;
      }

      switch (action.type) {
        case 'register':
          localStorage.setItem('playerId', action.payload.id);
          client.send(toJSON({
            type: 'requestjoin', payload: {
              playerId: action.payload.id,
              sessionId: ''
            }
          }));
          break;

        case 'updatesessionlist':
          this.updateSessionList(action.payload);
          break;

        case 'update':
          this.state = action.payload;
          break;
      }

      this.updateBoard();
    };

    client.onopen = () => {
      console.log('Connected');

      const playerId = localStorage.getItem('playerId');
      client.send(toJSON({
        type: 'register',
        payload: { id: playerId }
      }));
    };

    client.onclose = () => {
      console.log('Disconnected');
      client = null;
    };

    return client;
  }

  updateSessionList(sessions) {
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

  join(sessionId = '') {
    if (this.client) {
      const playerId = localStorage.getItem('playerId');

      if (sessionId === 'new') {
        this.client.send(toJSON({ type: 'requestnew', payload: { playerId } }));
        return;
      }

      if (!sessionId) {
        sessionId = this.state ? this.state.id : '';
      }

      this.client.send(toJSON({ type: 'requestjoin', payload: { playerId, sessionId } }));
    }
  }

  play(position: number) {
    if (!this.client || !this.state) {
      return;
    }

    const play: ClientPlay = {
      id: this.state.id,
      playerId: this.getPlayerId(),
      position,
    };

    this.client.send(toJSON({
      type: 'play',
      payload: play
    }));
  }

  reset() {
    fetch('/reset');
  }

  start() {
    document.body.addEventListener('click', e => this.onCellClick(e));

    fetch('/sockets').then(output => output.json()).then(sockets => {
      if (!sockets.length) {
        console.log('No server available');
        return;
      }

      this.client = this.startClient(sockets[0].url);
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

export default new TicTacToe();
