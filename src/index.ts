import { Action, StartAction, PlayAction, UpdateAction } from './actions';
import * as WebSocket from 'ws';
import * as uuid from 'uuid';
import { Session } from './session';
import { Player, GameState } from './types';

let socketServer: WebSocket.Server;
let sessions: Map<string, Session>;

function toJSON(object) {
  return JSON.stringify(object);
}

function fromJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

const playerTargetMap = {
  [Player.A]: 'playerA',
  [Player.B]: 'playerB',
};

function onPlay(session: Session, play: PlayAction): void {
  const flipBit = 0 << play.payload.position;
  const player = play.payload.player;
  const playerTarget = playerTargetMap[player];
  const bits = session.state[playerTarget];
  session.state[playerTarget] = bits | flipBit;

  const updatePayload = toJSON(new UpdateAction(session.state));
  session.playerA.send(updatePayload);
  session.playerB.send(updatePayload);
}

function findAvailableSession(): Session {
  const availableSession = Array.from(sessions)
    .map(([, session]) => session)
    .find((session) => {
      return !session.playerB;
    });

  return availableSession || createSession();
}

function createSession(): Session {
  const id = uuid.v4();
  const state: GameState = {
    id,
    playerA: 0,
    playerB: 0,
  };

  const session: Session = { state };
  return session;
}

function onClientConnect(socket: WebSocket) {
  socket.on('message', (data) => {
    const action: Action = fromJSON(data);

    if (!action) {
      return;
    }

    switch (action.type) {
      case 'play':
        const session = sessions.get(action.payload.id);
        const newState = onPlay(session, action.payload);

        break;

      case 'join':
        const sessionToJoin = findAvailableSession();

        if (availableSession.playerA) {
          const player: Player = availableSession ? Player.B : Player.A;
        }


        socket.send(toJSON({
          action: 'start',
          payload: {
            player: player,
            state: sessionToJoin.state
          }
        }));
        break;
    }
  });

  const startAction: StartAction = {
    type: 'start',
    payload: { id }
  };

  socket.send(toJSON(startAction));
}

function createServer(socketServerConfiguration) {
  sessions = new Map();
  socketServer = new WebSocket.Server(socketServerConfiguration);

  socketServer.on('error', () => {
    socketServer.close();
    createServer(socketServerConfiguration);
  });
}

export function start(socketServerConfiguration) {
  createServer(socketServerConfiguration);
  socketServer.on('connection', onClientConnect);

  return {
    getSessions() {
      Array.from(sessions).reduce((stack, [, session]) => {
        stack.push({
          id: session.id,
          state: session.state,
        });

        return stack;
      }, []);
    }
  };
}
