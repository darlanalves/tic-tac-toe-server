import { PlayerState } from './types';

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

function startClient(endpoint) {
  client = new WebSocket(endpoint);

  client.onmessage = (event) => {
    const action = fromJSON(event.data);
    console.log('INCOMING', toJSON(action));

    if (!action) {
      return;
    }

    switch (action.type) {
      case 'join':
        session = action.payload;
        break;

      case 'update':
        session.state = action.payload;
        break;
    }
  };

  client.onopen = () => {
    fetch('/sessions').then(v => v.json()).then((sessions) => {
      document.getElementById('session-list').innerHTML = sessions
        .map((item) => `<li>
          <strong>${item.id}</strong>
          <code>${toJSON(item.state)}</code>
            </li>
          </ul>`)
        .join('');
    });
  };

  client.onclose = () => { client = null; };
}

class TicTacToe {
  constructor() {
    document.body.addEventListener('click', e => this.onCellClick(e));
  }

  get client() {
    return client;
  }

  get session() {
    return session;
  }

  join() {
    if (!client) {
      client.send(toJSON({ type: 'join' }));
    }
  }

  play(position) {
    if (!client) {
      return;
    }

    client.send(toJSON({
      type: 'play',
      payload: {
        id: session.state.id,
        play: {
          player: session.player,
          position,
        }
      }
    }));
  }

  start() {
    fetch('/sockets').then(output => output.json()).then(sockets => {
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
