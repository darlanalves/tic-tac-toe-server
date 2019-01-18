export enum Player {
  A = 'a',
  B = 'b',
}

export interface Play {
  player: Player;
  position: number;
}

export interface GameState {
  id: string;
  playerA: number;
  playerB: number;
}
