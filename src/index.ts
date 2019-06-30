import { Action, PlayAction, UpdateAction, PlayerJoinAction } from './actions';
import * as WebSocket from 'ws';
import * as uuid from 'uuid';
import { Session, SessionSummary } from './session';
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

function onPlay(action: PlayAction): void {
  const session = sessions.get(action.payload.id);
  if (!session) {
    return;
  }

  const play = action.payload.play;
  const flipBit = 0 << play.position;
  const playerTarget = playerTargetMap[play.player];
  const bits = session.state[playerTarget];
  session.state[playerTarget] = bits | flipBit;

  const updatePayload = toJSON(new UpdateAction(session.state));
  session.playerA.send(updatePayload);
  session.playerB.send(updatePayload);
}

function onJoin(client: WebSocket) {
  const playerId = uuid.v4();
  const sessionToJoin = findAvailableSession();
  let player = Player.A;

  if (sessionToJoin.playerA) {
    player = Player.B;
    sessionToJoin.playerB = client;
  } else {
    sessionToJoin.playerA = client;
  }

  client.send(toJSON(new PlayerJoinAction({
    id: playerId,
    player: player,
    state: sessionToJoin.state
  })));
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

  return { state };
}

function onClientConnect(client: WebSocket) {
  client.on('message', (data) => {
    const action: Action = fromJSON(data);

    if (!action) {
      return;
    }

    console.log('INCOMING', action);
    const payload = action.payload;

    switch (action.type) {
      case 'play':
        onPlay(new PlayAction(payload));
        break;

      case 'join':
        onJoin(client);
        break;
    }
  });

  client.on('close', (_) => {
    sessions.forEach(session => {
      if (session.playerA === client) {
        session.playerA = null;
      }

      if (session.playerB === client) {
        session.playerB = null;
      }
    });
  });
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
    getSessions(): SessionSummary[] {
      const sessionSummary: SessionSummary[] = [];
      Array.from(sessions).reduce((stack, [, session]) => {
        stack.push({
          id: session.state.id,
          state: session.state,
        });

        return stack;
      }, sessionSummary);

      return sessionSummary;
    }
  };
}
