export enum Player {
  A = 'a',
  B = 'b',
}

export interface ClientPlay {
  id: string;
  playerId: string;
  position: number;
}

export type GameMoveArray = [number?, number?, number?, number?, number?];
export interface GameMoves {
  playerA: GameMoveArray;
  playerB: GameMoveArray;
}
export class GameState {
  id: string;
  players = {
    playerA: '',
    playerB: '',
  };
  winner: Player = null;
  moves: GameMoves = {
    playerA: [],
    playerB: [],
  };

  constructor(p: Partial<GameState>) {
    Object.assign(this, p);
  }

  get turn(): Player {
    if (this.moves.playerA.length === 0) {
      return Player.A;
    }

    return this.moves.playerB.length < this.moves.playerA.length ?
      Player.B : Player.A;
  }

  toJSON() {
    return {
      id: this.id,
      winner: this.winner,
      turn: this.turn,
      moves: this.moves,
      players: this.players,
    };
  }
}

export interface SessionSummary {
  id: string;
  playerA: string;
  playerB: string;
}
