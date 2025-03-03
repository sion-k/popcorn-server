export type RoomState = {
  roomId: string;
  players: Map<string, PlayerState>;
  table: TableState;
  score: number;
  duration: number;
};

export type TableState = {
  n: number;
  m: number;
  table: number[][];
};

export type PlayerState = {
  playerId: string;
  pointer: Pointer;
  selectedArea: Area | null;
};

export type Pointer = { x: number; y: number };
export type Area = { r1: number; c1: number; r2: number; c2: number };

export function joinGame(room: RoomState, playerId: string) {
  room.players.set(playerId, {
    playerId,
    pointer: { x: 0, y: 0 },
    selectedArea: null,
  });
}

export function tryPop(table: TableState, selectedArea: Area) {
  const { n, m, table: t } = table;
  const { r1, c1, r2, c2 } = selectedArea;

  let sum = 0;
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
      sum += t[r][c];
    }
  }

  if (sum === 10) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        t[r][c] = 0;
      }
    }
    return Math.abs(r1 - r2 + 1) * Math.abs(c1 - c2 + 1);
  }
  return 0;
}

export function availableAreaExists(table: TableState) {
  const { n, m, table: t } = table;

  for (let r1 = 0; r1 < n; r1++) {
    for (let r2 = r1; r2 < n; r2++) {
      for (let c1 = 0; c1 < m; c1++) {
        for (let c2 = c1; c2 < m; c2++) {
          let sum = 0;
          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              sum += t[r][c];
            }
          }
          if (sum === 10) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function generateTable(oldTable: TableState): TableState {
  const { n, m } = oldTable;

  const newTableState = {
    n,
    m,
    table: Array.from({ length: n }, () =>
      Array.from({ length: m }, () => Math.floor(Math.random() * 9) + 1),
    ),
  };

  return newTableState;
}
