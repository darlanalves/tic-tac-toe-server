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

  moves: GameMoves = {
    playerA: [],
    playerB: [],
  };

  constructor(p: Partial<GameState>) {
    Object.assign(this, p);
  }

  toJSON() {
    return {
      id: this.id,
      turn: this.turn,
      moves: this.moves,
    };
  }
}

export interface PlayerState {
  player: Player;
  state: GameState;
}
