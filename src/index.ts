import { Action, PlayAction, UpdateAction, PlayerJoinAction } from './actions';
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

function onPlay(action: PlayAction): void {
  const session = sessions.get(action.payload.id);

  if (!session) {
    console.log(`Session not found: ${action.payload.id}`);
    return;
  }

  const currentState = session.state;
  const play = action.payload.play;

  if (currentState.turn !== play.player) {
    return;
  }

  const isPlayerA = play.player === Player.A;
  const moves = currentState.moves;
  const playerMoves = isPlayerA ? moves.playerA : moves.playerB;
  const opponentMoves = isPlayerA ? moves.playerB : moves.playerA;

  currentState.turn = isPlayerA ? Player.B : Player.A;

  if (playerMoves.indexOf(play.position) > -1 || opponentMoves.indexOf(play.position) > -1) {
    return;
  }

  playerMoves.push(play.position);

  const updatePayload = toJSON(new UpdateAction(session.state));

  if (session.playerA.client) {
    session.playerA.client.send(updatePayload);
  }

  if (session.playerB.client) {
    session.playerB.client.send(updatePayload);
  }
}

function onRegister(payload: { id: string | null }) {
  if (payload.id) {
    sessions.forEach(session => {
      if (session.playerA.playerId === payload.id) {
        session.playerA.client = null;
      }

      if (session.playerB.playerId === payload.id) {
        session.playerB.client = null;
      }
    });
  }

  const playerId = payload.id || uuid.v4();
  return { type: 'register', payload: { id: playerId } };
}

function onJoin(client: WebSocket, playerId: string) {
  const previousSession = findPreviousSession(playerId);

  if (previousSession) {
    if (previousSession.playerA.playerId === playerId) {
      previousSession.playerA.client = client;
    } else {
      previousSession.playerB.client = client;
    }

    return new UpdateAction(previousSession.state);
  }

  const sessionToJoin = findAvailableSession();
  let player = Player.A;

  if (sessionToJoin.playerA.client) {
    player = Player.B;
    sessionToJoin.playerB.client = client;
  } else {
    sessionToJoin.playerA.client = client;
  }

  return new PlayerJoinAction({
    player: player,
    state: sessionToJoin.state
  });
}

function findPreviousSession(playerId: string): Session | null {
  return Array.from(sessions).map(([, session]) => session).find(session => {
    return (session.playerA.playerId === playerId || session.playerB.playerId === playerId);
  });
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
  const state = new GameState({ id });
  const session = { state };
  sessions.set(id, session);

  return session;
}

function onClientConnect(client: WebSocket) {
  client.on('message', (data) => {
    const action: Action = fromJSON(data);

    if (!action) {
      return;
    }

    const payload = action.payload;

    switch (action.type) {
      case 'register':
        client.send(toJSON(onRegister(action.payload)));
        break;

      case 'join':
        if (!payload.id) {
          return;
        }

        const joinAction = onJoin(client, payload.id);
        client.send(toJSON(joinAction));
        break;

      case 'play':
        onPlay(new PlayAction(payload));
        break;

    }
  });

  client.on('close', (_) => {
    sessions.forEach(session => {
      if (session.playerA.client === client) {
        session.playerA.client = null;
      }

      if (session.playerB.client === client) {
        session.playerB.client = null;
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
    close() {
      socketServer.close();
    },

    getSessions(): GameState[] {
      const sessionSummary: GameState[] = [];
      Array.from(sessions).reduce((stack, [, session]) => {
        stack.push(session.state);

        return stack;
      }, sessionSummary);

      return sessionSummary;
    }
  };
}
