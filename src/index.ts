import { Action, UpdateAction, RequestJoinAction, UpdateSessionListAction } from './actions';
import * as WebSocket from 'ws';
import * as uuid from 'uuid';
import { Session } from './session';
import { Player, GameState, SessionSummary } from './types';
import { winners } from './constants';

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

function sessionIsNotFull(session: Session) {
  return !session.playerA || !session.playerB;
}

export class TicTacToe {
  private sessions: Map<string, Session> = new Map();
  private players: Map<string, string> = new Map();

  broadcast(message: any) {
    const json = toJSON(message);

    this.sessions.forEach(session => {
      if (session.playerA) {
        session.playerA.send(json);
      }

      if (session.playerB) {
        session.playerB.send(json);
      }
    });
  }

  onPlay(session: Session, position: number, playerId: string) {
    const currentState = session.state;
    const player = currentState.players.playerA === playerId ? Player.A : Player.B;

    if (currentState.turn !== player) {
      console.log('Invalid turn', currentState, player);
      return;
    }

    const isPlayerA = player === Player.A;
    const moves = currentState.moves;
    const playerMoves = isPlayerA ? moves.playerA : moves.playerB;
    const opponentMoves = isPlayerA ? moves.playerB : moves.playerA;

    if (playerMoves.indexOf(position) > -1 || opponentMoves.indexOf(position) > -1) {
      return;
    }

    playerMoves.push(position);
    playerMoves.sort();

    this.checkMoves(currentState, currentState.moves.playerA, Player.A);
    this.checkMoves(currentState, currentState.moves.playerB, Player.B);

    if (currentState.winner) {
      return new UpdateAction(currentState);
    }

    return new UpdateAction(currentState);
  }

  onRegister(payload: { id: string | null }) {
    if (payload.id) {
      this.sessions.forEach(session => {
        if (session.state.players.playerA === payload.id) {
          session.playerA = null;
        }

        if (session.state.players.playerB === payload.id) {
          session.playerB = null;
        }
      });
    }

    const playerId = payload.id || uuid.v4();
    return { type: 'register', payload: { id: playerId } };
  }

  onJoinNew(client: WebSocket, { payload }: RequestJoinAction) {
    const { playerId } = payload;
    const session = this.createSession();

    return this.onJoinImpl(client, session, playerId);
  }

  onJoin(client: WebSocket, { payload }: RequestJoinAction) {
    const { playerId } = payload;
    const previousSession = this.findPreviousSession(playerId);

    if (previousSession) {
      if (previousSession.state.players.playerA === playerId) {
        previousSession.playerA = client;
      } else {
        previousSession.playerB = client;
      }

      return new UpdateAction(previousSession.state);
    }

    const sessionToJoin = this.findAvailableSession(payload.sessionId);

    return this.onJoinImpl(client, sessionToJoin, playerId);
  }

  private onJoinImpl(client: WebSocket, session: Session, playerId: string) {
    if (session.playerA) {
      session.playerB = client;
      session.state.players.playerB = playerId;
    } else {
      session.playerA = client;
      session.state.players.playerA = playerId;
    }

    return new UpdateAction(session.state);
  }

  onUpdateSessionList() {
    const sessionList: SessionSummary[] = [];

    Array.from(this.sessions).reduce((stack, [, session]) => {
      if (sessionIsNotFull(session)) {
        stack.push({
          id: session.state.id,
          playerA: this.players.get(session.state.players.playerA),
          playerB: this.players.get(session.state.players.playerB),
        });
      }

      return stack;
    }, sessionList);

    return new UpdateSessionListAction(sessionList);
  }

  onClientConnect(client: WebSocket) {
    client.on('message', (data) => {
      const action: Action = fromJSON(data);

      if (!action) {
        return;
      }

      console.log('INCOMING', toJSON(action));

      const payload = action.payload;

      switch (action.type) {
        case 'register':
          client.send(toJSON(this.onRegister(payload)));
          client.send(toJSON(this.onUpdateSessionList()));
          break;

        case 'requestjoin':
          if (!payload.playerId) {
            return;
          }

          client.send(toJSON(this.onJoin(client, new RequestJoinAction(payload))));
          this.broadcast(this.onUpdateSessionList());
          break;

        case 'requestnew':
          if (!payload.playerId) {
            return;
          }

          client.send(toJSON(this.onJoinNew(client, new RequestJoinAction(payload))));
          this.broadcast(this.onUpdateSessionList());
          break;

        case 'play':
          const session = this.sessions.get(payload.id);

          if (!session) {
            return;
          }

          const updateState = this.onPlay(session, payload.position, payload.playerId);
          if (session.playerA) {
            session.playerA.send(toJSON(updateState));
          }

          if (session.playerB) {
            session.playerB.send(toJSON(updateState));
          }
          break;
      }
    });

    client.on('close', (_) => {
      this.sessions.forEach(session => {
        if (session.playerA === client) {
          session.playerA = null;
        }

        if (session.playerB === client) {
          session.playerB = null;
        }
      });
    });
  }

  private checkMoves(state: GameState, moves: number[], player: Player) {
    if (winners.indexOf(moves.join(',').slice(0, 5)) > -1) {
      state.winner = player;
    }
  }

  private findPreviousSession(playerId: string): Session | null {
    return Array.from(this.sessions).map(([, session]) => session).find(session => {
      return (session.state.players.playerA === playerId || session.state.players.playerB === playerId)
        && !session.state.winner;
    });
  }

  private findAvailableSession(sessionId?: string): Session {
    const existingSession = sessionId && this.sessions.get(sessionId);

    if (existingSession && sessionIsNotFull(existingSession)) {
      return existingSession;
    }

    const availableSession = Array.from(this.sessions)
      .map(([, session]) => session)
      .find(sessionIsNotFull);

    return availableSession || this.createSession();
  }

  private createSession(): Session {
    const id = uuid.v4();
    const state = new GameState({ id });
    const session = { state, playerA: null, playerB: null };

    this.sessions.set(id, session);

    return session;
  }
}

const gameServer = new TicTacToe();

function createServer(socketServerConfiguration): { socketServer: WebSocket.Server } {
  const socketServer = new WebSocket.Server(socketServerConfiguration);
  const output = { socketServer };

  socketServer.on('connection', (client) => gameServer.onClientConnect(client));
  socketServer.on('error', () => {
    socketServer.close();
    output.socketServer = createServer(socketServerConfiguration).socketServer;
  });

  return output;
}

export function start(socketServerConfiguration) {
  const server = createServer(socketServerConfiguration);

  return {
    close() {
      server.socketServer.close();
    }
  };
}
