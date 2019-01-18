// tslint:disable: max-classes-per-file

import { Play, GameState } from './types';

export interface Action {
  type: string;
  payload: any;
}

export class StartAction implements Action {
  readonly type = 'start';
  constructor(public payload: { id: string }) { }
}

export class UpdateAction implements Action {
  readonly type = 'update';
  constructor(public payload: GameState) { }
}

export class PlayAction implements Action {
  readonly type = 'play';
  constructor(public payload: Play) { }
}
