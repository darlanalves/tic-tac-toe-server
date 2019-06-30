import { SessionSummary } from './types';
// tslint:disable: max-classes-per-file

import { Play, GameState, PlayerState } from './types';

export interface Action {
  type: string;
  payload: any;
}

export class RequestJoinAction implements Action {
  readonly type = 'requestjoin';
  constructor(public payload: { playerId: string; sessionId: string; }) { }
}

export class PlayerJoinAction implements Action {
  readonly type = 'join';
  constructor(public payload: PlayerState) { }
}

export class UpdateAction implements Action {
  readonly type = 'update';
  constructor(public payload: GameState) { }
}

export class PlayAction implements Action {
  readonly type = 'play';
  constructor(public payload: { id: string; play: Play }) { }
}

export class UpdateSessionListAction implements Action {
  readonly type = 'updatesessionlist';
  constructor(public payload: SessionSummary[]) { }
}

export class EndGameAction implements Action {
  readonly type = 'endgame';
  constructor(public payload: GameState) { }
}
