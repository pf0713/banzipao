const { HAND_TYPE, RANK } = require('./constants');
const { getRankValue } = require('./card');

/**
 * 对手牌按点数分组
 * @returns {Map<number, Card[]>} 点数 -> 牌数组
 */
function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    const v = getRankValue(card);
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(card);
  }
  return groups;
}

/**
 * 获取排序后的点数数组（从大到小）
 */
function getSortedRanks(groups) {
  return [...groups.keys()].sort((a, b) => b - a);
}

/**
 * 检查一组点数是否连续
 */
function isConsecutive(ranks) {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i - 1] - ranks[i] !== 1) return false;
  }
  return true;
}

/**
 * 识别牌型
 * @returns {{ type: number, mainRank: number|null, length: number, cards: Card[] }}
 *   type: 牌型编号, mainRank: 主要点数, length: 顺子/连对/滚筒长度
 */
function identify(cards) {
  if (!cards || cards.length === 0) return null;

  const groups = groupByRank(cards);
  const sortedRanks = getSortedRanks(groups);
  const n = cards.length;

  // 1. 单张
  if (n === 1) {
    return {
      type: HAND_TYPE.SINGLE,
      mainRank: getRankValue(cards[0]),
      length: 1,
      cards
    };
  }

  // 2. 对子
  if (n === 2 && sortedRanks.length === 1) {
    return {
      type: HAND_TYPE.PAIR,
      mainRank: getRankValue(cards[0]),
      length: 1,
      cards
    };
  }

  // 3. 顺子（≥3张连续，2不参与）
  if (n >= 3 && groups.size === n) {
    // 每组必须只有1张
    const allSingles = [...groups.values()].every(g => g.length === 1);
    if (allSingles && isConsecutive(sortedRanks) && !sortedRanks.includes(15)) {
      return {
        type: HAND_TYPE.STRAIGHT,
        mainRank: sortedRanks[0],
        length: n,
        cards
      };
    }
  }

  // 4. 炸弹（3张相同）
  if (n === 3 && sortedRanks.length === 1) {
    return {
      type: HAND_TYPE.BOMB,
      mainRank: sortedRanks[0],
      length: 1,
      cards
    };
  }

  // 5. 板子炮（≥3对连对，即≥6张，每对2张，2不参与）
  if (n >= 6 && n % 2 === 0) {
    const allPairs = [...groups.values()].every(g => g.length === 2);
    if (allPairs && sortedRanks.length === n / 2 && isConsecutive(sortedRanks) && !sortedRanks.includes(15)) {
      return {
        type: HAND_TYPE.BANZIPAO,
        mainRank: sortedRanks[0],
        length: n / 2, // 几对
        cards
      };
    }
  }

  // 6. 豆（4张相同）
  if (n === 4 && sortedRanks.length === 1) {
    return {
      type: HAND_TYPE.DOU,
      mainRank: sortedRanks[0],
      length: 1,
      cards
    };
  }

  // 7. 滚筒（≥3个连续炸弹，每个炸弹3张）
  if (n >= 9 && n % 3 === 0) {
    const allBombs = [...groups.values()].every(g => g.length === 3);
    if (allBombs && sortedRanks.length === n / 3 && isConsecutive(sortedRanks)) {
      return {
        type: HAND_TYPE.GUNTONG,
        mainRank: sortedRanks[0],
        length: n / 3, // 几个炸弹
        cards
      };
    }
  }

  // 8. 滚龙（≥3个连续豆，每个豆4张）
  if (n >= 12 && n % 4 === 0) {
    const allDous = [...groups.values()].every(g => g.length === 4);
    if (allDous && sortedRanks.length === n / 4 && isConsecutive(sortedRanks)) {
      return {
        type: HAND_TYPE.GUNLONG,
        mainRank: sortedRanks[0],
        length: n / 4,
        cards
      };
    }
  }

  return null; // 无效牌型
}

/**
 * 检查整副手牌是否十三烂（全单张，无任何重复）
 */
function isThirteen(hand) {
  if (hand.length !== 13) return false;
  const groups = groupByRank(hand);
  return groups.size === 13; // 13张牌13个不同点数
}

/**
 * 检查整副手牌是否滚龙天牌
 * 滚龙：连续3组或以上豆（4张相同）
 */
function hasGunLong(hand) {
  if (hand.length !== 13) return false;
  const groups = groupByRank(hand);
  const sortedRanks = getSortedRanks(groups);

  // 找到所有4张的组
  const douRanks = [];
  for (const [rank, cards] of groups) {
    if (cards.length === 4) douRanks.push(rank);
  }
  douRanks.sort((a, b) => b - a);

  // 检查是否有≥3连续豆
  if (douRanks.length < 3) return null;
  for (let i = 0; i <= douRanks.length - 3; i++) {
    const slice = douRanks.slice(i, i + 3);
    if (isConsecutive(slice)) {
      return {
        type: HAND_TYPE.GUNLONG,
        mainRank: slice[0],
        length: 3,
        ranks: slice
      };
    }
  }
  return null;
}

/**
 * 在手牌中找到可以压过目标牌型的最小牌组
 * @param {Card[]} hand - 手牌
 * @param {Object} target - 目标牌型（identify的结果），null表示自由出牌
 * @returns {Object|null} { cards, type, mainRank, length } 或 null（无法压）
 */
function findPlayable(hand, target) {
  if (!target) {
    // 自由出牌：返回null让AI自己选
    return null;
  }

  const groups = groupByRank(hand);
  const sortedRanks = getSortedRanks(groups);

  // 根据目标牌型找可压的牌
  if (target.type === HAND_TYPE.SINGLE || target.type === HAND_TYPE.PAIR ||
      target.type === HAND_TYPE.STRAIGHT || target.type === HAND_TYPE.BANZIPAO) {
    // 同类型更大压
    const sameType = findSameType(hand, target);
    if (sameType) return sameType;
    // 炸弹可压单/对/顺
    const bomb = findBomb(hand, target.mainRank);
    if (bomb) return bomb;
    // 豆可压
    const dou = findDou(hand);
    if (dou) return dou;
    // 滚筒可压
    const guntong = findGuntong(hand);
    if (guntong) return guntong;
    return null;
  }

  if (target.type === HAND_TYPE.BOMB) {
    const biggerBomb = findBomb(hand, target.mainRank);
    if (biggerBomb) return biggerBomb;
    const dou = findDou(hand);
    if (dou) return dou;
    const guntong = findGuntong(hand);
    if (guntong) return guntong;
    return null;
  }

  if (target.type === HAND_TYPE.DOU) {
    const biggerDou = findDou(hand, target.mainRank);
    if (biggerDou) return biggerDou;
    const guntong = findGuntong(hand);
    if (guntong) return guntong;
    return null;
  }

  if (target.type === HAND_TYPE.GUNTONG) {
    const biggerGuntong = findBiggerGuntong(hand, target);
    if (biggerGuntong) return biggerGuntong;
    return null;
  }

  return null;
}

function findSameType(hand, target) {
  const groups = groupByRank(hand);
  if (target.type === HAND_TYPE.SINGLE) {
    const sorted = [...hand].sort((a, b) => getRankValue(b) - getRankValue(a));
    for (const card of sorted) {
      if (getRankValue(card) > target.mainRank) {
        return { cards: [card], type: HAND_TYPE.SINGLE, mainRank: getRankValue(card), length: 1 };
      }
    }
  }
  if (target.type === HAND_TYPE.PAIR) {
    for (const [rank, cards] of groups) {
      if (cards.length >= 2 && rank > target.mainRank) {
        return { cards: cards.slice(0, 2), type: HAND_TYPE.PAIR, mainRank: rank, length: 1 };
      }
    }
  }
  if (target.type === HAND_TYPE.STRAIGHT) {
    return findStraight(hand, target.mainRank, target.length);
  }
  if (target.type === HAND_TYPE.BANZIPAO) {
    return findLianDui(hand, target.mainRank, target.length);
  }
  return null;
}

function findStraight(hand, minRank, len) {
  const groups = groupByRank(hand);
  // 从大到小找连续len张
  for (let start = minRank + 1; start <= 14; start++) {
    if (start + len - 1 > 14) break;
    const cards = [];
    for (let r = start; r < start + len; r++) {
      if (!groups.has(r)) { cards.length = 0; break; }
      cards.push(groups.get(r)[0]);
    }
    if (cards.length === len) {
      return { cards, type: HAND_TYPE.STRAIGHT, mainRank: start + len - 1, length: len };
    }
  }
  return null;
}

function findLianDui(hand, minRank, len) {
  const groups = groupByRank(hand);
  for (let start = minRank + 1; start <= 14; start++) {
    if (start + len - 1 > 14) break;
    const cards = [];
    for (let r = start; r < start + len; r++) {
      if (!groups.has(r) || groups.get(r).length < 2) { cards.length = 0; break; }
      cards.push(...groups.get(r).slice(0, 2));
    }
    if (cards.length === len * 2) {
      return { cards, type: HAND_TYPE.BANZIPAO, mainRank: start + len - 1, length: len };
    }
  }
  return null;
}

function findBomb(hand, minRank = 0) {
  const groups = groupByRank(hand);
  let best = null;
  for (const [rank, cards] of groups) {
    if (cards.length >= 3 && rank > minRank) {
      if (!best || rank < best.mainRank) {
        best = { cards: cards.slice(0, 3), type: HAND_TYPE.BOMB, mainRank: rank, length: 1 };
      }
    }
  }
  return best;
}

function findDou(hand, minRank = 0) {
  const groups = groupByRank(hand);
  let best = null;
  for (const [rank, cards] of groups) {
    if (cards.length === 4 && rank > minRank) {
      if (!best || rank < best.mainRank) {
        best = { cards: [...cards], type: HAND_TYPE.DOU, mainRank: rank, length: 1 };
      }
    }
  }
  return best;
}

function findGuntong(hand) {
  const groups = groupByRank(hand);
  const bombRanks = [];
  for (const [rank, cards] of groups) {
    if (cards.length >= 3) bombRanks.push(rank);
  }
  bombRanks.sort((a, b) => b - a);

  for (let i = 0; i <= bombRanks.length - 3; i++) {
    const slice = bombRanks.slice(i, i + 3);
    if (isConsecutive(slice)) {
      const cards = [];
      for (const r of slice) {
        cards.push(...groups.get(r).slice(0, 3));
      }
      return { cards, type: HAND_TYPE.GUNTONG, mainRank: slice[0], length: 3 };
    }
  }
  return null;
}

function findBiggerGuntong(hand, target) {
  const groups = groupByRank(hand);
  const bombRanks = [];
  for (const [rank, cards] of groups) {
    if (cards.length >= 3) bombRanks.push(rank);
  }
  bombRanks.sort((a, b) => b - a);

  for (let i = 0; i <= bombRanks.length - target.length; i++) {
    const slice = bombRanks.slice(i, i + target.length);
    if (isConsecutive(slice) && slice[0] > target.mainRank) {
      const cards = [];
      for (const r of slice) {
        cards.push(...groups.get(r).slice(0, 3));
      }
      return { cards, type: HAND_TYPE.GUNTONG, mainRank: slice[0], length: target.length };
    }
  }
  return null;
}

/**
 * 检查手牌是否"素包"：手牌中没有任何能管得起2的牌型
 * 能管2的牌型：炸弹(3张)、板子炮(3+连对)、豆(4张)、滚筒、滚龙
 */
function isSuBao(hand) {
  var groups = groupByRank(hand);
  var sortedRanks = [];
  var keys = groups.keys();
  var entry;
  // 收集所有有≥2张的点数
  for (entry of groups) {
    sortedRanks.push(entry[0]);
  }
  sortedRanks.sort(function(a, b) { return a - b; });

  // 检查是否有3张相同（炸弹）
  for (entry of groups) {
    if (entry[1].length >= 3) return false;
  }

  // 检查是否有4张相同（豆）
  for (entry of groups) {
    if (entry[1].length >= 4) return false;
  }

  // 检查是否有3+连对（板子炮），2不参与
  var consCount = 0;
  for (var i = 1; i < sortedRanks.length; i++) {
    var r = sortedRanks[i];
    var prev = sortedRanks[i - 1];
    if (r === 15) continue; // 2不参与连对
    if (r - prev === 1 && groups.get(r).length >= 2 && groups.get(prev).length >= 2) {
      consCount++;
      if (consCount >= 2) return false; // 有3对连对=板子炮
    } else {
      consCount = 0;
    }
  }

  // 如果没有炸弹/豆/板子炮，但有≥3个连炸(滚筒)的可能——需要每个点数≥3张且连续
  // 因为已经检查过没有≥3张的，所以不会有滚筒
  // 同理也没有滚龙

  return true;
}

module.exports = {
  groupByRank,
  isThirteen,
  hasGunLong,
  identify,
  findPlayable,
  isConsecutive,
  isSuBao
};
