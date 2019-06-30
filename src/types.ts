export enum Player {
  A = 'a',
  B = 'b',
}

export interface Play {
  player: Player;
  position: number;
}

export interface ClientPlay {
  id: string;
  play: Play;
}

export interface GameMoves {
  playerA: number[];
  playerB: number[];
}
export class GameState {
  id: string;
  turn = Player.A;
  winner: Player = null;

  moves: GameMoves = {
    playerA: [],
    playerB: [],
  };

  constructor(p: Partial<GameState>) {
    Object.assign(this, p);
  }
}

export interface SessionSummary {
  id: string;
  playerA: string;
  playerB: string;
}

export interface PlayerState {
  player: Player;
  state: GameState;
}
