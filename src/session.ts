import { GameState } from './types';
import * as WebSocket from 'ws';

export interface SessionState {
  playerId?: string;
  client?: WebSocket;
}
export interface Session {
  playerA: SessionState;
  playerB: SessionState;
  state: GameState;
}
