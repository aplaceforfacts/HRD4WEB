export function assignRanksDescending<T extends { score: number }>(rows: T[]) {
  let currentRank = 1

  return rows.map((row, index) => {
    if (index > 0 && rows[index - 1].score > row.score) {
      currentRank = index + 1
    }

    const isTied =
      (index > 0 && rows[index - 1].score === row.score) ||
      (index < rows.length - 1 && rows[index + 1].score === row.score)

    return {
      ...row,
      rank: currentRank,
      isTied,
    }
  })
}
