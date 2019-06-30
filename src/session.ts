import { GameState } from './types';
import * as WebSocket from 'ws';

export interface Session {
  playerA?: WebSocket;
  playerB?: WebSocket;
  state: GameState;
}

export interface SessionSummary {
  id: string;
  state: GameState;
}
