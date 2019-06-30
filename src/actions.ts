// tslint:disable: max-classes-per-file
import { SessionSummary } from './types';
import { GameState } from './types';

export interface Action {
  type: string;
  payload: any;
}

export class RequestJoinAction implements Action {
  readonly type = 'requestjoin';
  constructor(public payload: { playerId: string; sessionId: string; }) { }
}

export class UpdateAction implements Action {
  readonly type = 'update';
  constructor(public payload: GameState) { }
}

export class UpdateSessionListAction implements Action {
  readonly type = 'updatesessionlist';
  constructor(public payload: SessionSummary[]) { }
}
