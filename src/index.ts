import { Action, PlayAction, UpdateAction, PlayerJoinAction, RequestJoinAction, UpdateSessionListAction, EndGameAction } from './actions';
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
  return !session.playerA.client || !session.playerB.client;
}

export class TicTacToe {
  private sessions: Map<string, Session> = new Map();
  private players: Map<string, string> = new Map();

  broadcast(message: any) {
    const json = toJSON(message);

    this.sessions.forEach(session => {
      if (session.playerA.client) {
        session.playerA.client.send(json);
      }

      if (session.playerB.client) {
        session.playerB.client.send(json);
      }
    });
  }

  onPlay(session: Session, action: PlayAction) {
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
    playerMoves.sort();

    this.checkMoves(currentState, currentState.moves.playerA, Player.A);
    this.checkMoves(currentState, currentState.moves.playerB, Player.B);

    if (currentState.winner) {
      return new EndGameAction(currentState);
    }

    return new UpdateAction(currentState);
  }

  onRegister(payload: { id: string | null }) {
    if (payload.id) {
      this.sessions.forEach(session => {
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

  onJoin(client: WebSocket, { payload }: RequestJoinAction) {
    const { playerId } = payload;
    const previousSession = this.findPreviousSession(playerId);

    if (previousSession) {
      if (previousSession.playerA.playerId === playerId) {
        previousSession.playerA.client = client;
      } else {
        previousSession.playerB.client = client;
      }

      return new UpdateAction(previousSession.state);
    }

    const sessionToJoin = this.findAvailableSession(payload.sessionId);
    let player = Player.A;

    if (sessionToJoin.playerA.client && sessionToJoin.playerA.playerId !== playerId) {
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

  onUpdateSessionList() {
    const sessionList: SessionSummary[] = [];

    Array.from(this.sessions).reduce((stack, [, session]) => {
      if (sessionIsNotFull(session)) {
        stack.push({
          id: session.state.id,
          playerA: this.players.get(session.playerA.playerId) || '',
          playerB: this.players.get(session.playerB.playerId) || '',
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
          client.send(toJSON(this.onRegister(action.payload)));
          client.send(toJSON(this.onUpdateSessionList()));
          break;

        case 'requestjoin':
          if (!payload.playerId) {
            return;
          }

          client.send(toJSON(this.onJoin(client, new RequestJoinAction(payload))));
          this.broadcast(this.onUpdateSessionList());
          break;

        case 'play':
          const session = this.sessions.get(action.payload.id);

          if (!session) {
            return;
          }

          const updateState = this.onPlay(session, new PlayAction(payload));
          if (session.playerA.client) {
            session.playerA.client.send(toJSON(updateState));
            session.playerA.client = null;
          }

          if (session.playerB.client) {
            session.playerB.client.send(toJSON(updateState));
            session.playerB.client = null;
          }
          break;
      }
    });

    client.on('close', (_) => {
      this.sessions.forEach(session => {
        if (session.playerA.client === client) {
          session.playerA.client = null;
        }

        if (session.playerB.client === client) {
          session.playerB.client = null;
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
      return (session.playerA.playerId === playerId || session.playerB.playerId === playerId);
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
    const session = { state, playerA: {}, playerB: {} };

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
