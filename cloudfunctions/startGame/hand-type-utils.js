const RANK = { '3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15 };

function getRankValue(card) { return RANK[card.rank]; }

function isConsecutive(ranks) {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i - 1] - ranks[i] !== 1) return false;
  }
  return true;
}

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    const v = getRankValue(card);
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(card);
  }
  return groups;
}

function isThirteen(hand) {
  if (hand.length !== 13) return false;
  const groups = groupByRank(hand);
  return groups.size === 13;
}

function hasGunLong(hand) {
  if (hand.length !== 13) return false;
  const groups = groupByRank(hand);
  const douRanks = [];
  for (const [rank, cards] of groups) {
    if (cards.length === 4) douRanks.push(rank);
  }
  douRanks.sort((a, b) => b - a);
  if (douRanks.length < 3) return null;
  for (let i = 0; i <= douRanks.length - 3; i++) {
    const slice = douRanks.slice(i, i + 3);
    if (isConsecutive(slice)) {
      return { mainRank: slice[0], length: 3, ranks: slice };
    }
  }
  return null;
}

module.exports = { isThirteen, hasGunLong };
