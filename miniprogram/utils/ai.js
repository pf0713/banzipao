const { identify, findPlayable, groupByRank, isConsecutive } = require('./hand-type');
const { getRankValue } = require('./card');
const { HAND_TYPE } = require('./constants');

/**
 * AI叫牌决策
 * @param {Card[]} hand - AI手牌
 * @param {Object} context - { banker, bidInfo, isBanker }
 * @returns {string} 'bao' | 'pass' | 'antibao' | { callCard }
 */
function decideBid(hand, context) {
  const strength = evaluateHand(hand);

  // 强牌（有滚龙或十三烂已在前面处理）
  if (strength.score >= 70) return 'bao';

  // 如果前面有人包牌，考虑反包
  if (context.bidInfo?.bidder !== null && context.bidInfo?.antiBidder === null) {
    if (strength.score >= 60) return 'antibao';
  }

  // 庄家叫牌
  if (context.isBanker && context.needCallCard) {
    return { callCard: chooseCallCard(hand) };
  }

  return 'pass';
}

/**
 * 手牌估值
 */
function evaluateHand(hand) {
  let score = 0;
  const groups = groupByRank(hand);

  for (const [rank, cards] of groups) {
    const count = cards.length;
    const rv = rank;

    // 大牌加分
    if (rv >= 14) score += count * 3;  // A=14, 2=15
    else if (rv >= 11) score += count * 2;  // J/K/Q

    // 炸弹加分
    if (count === 3) score += 10;
    // 豆加分
    if (count === 4) score += 20;
  }

  // 板子炮加分
  const sortedRanks = [...groups.keys()].sort((a, b) => a - b);
  let consecutive = 0;
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] - sortedRanks[i - 1] === 1 && sortedRanks[i] !== 15) {
      consecutive++;
      if (consecutive >= 2) {
        // 检查是否每对都有2张以上
        let valid = true;
        for (let j = i - consecutive; j <= i; j++) {
          if (groups.get(sortedRanks[j]).length < 2) { valid = false; break; }
        }
        if (valid) score += consecutive * 5;
      }
    } else {
      consecutive = 0;
    }
  }

  return { score, hand };
}

/**
 * 庄家选叫牌（选自己手牌中没有的，从2往下找，附带花色）
 * 如果庄家有4张该点数，则跳到下一级
 */
function chooseCallCard(hand) {
  var suits = ['spade', 'heart', 'club', 'diamond'];
  var suitNames = { spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方块' };
  var allRanks = ['2', 'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];

  // 统计每个点数的张数
  var rankCount = {};
  for (var i = 0; i < hand.length; i++) {
    var r = hand[i].rank;
    rankCount[r] = (rankCount[r] || 0) + 1;
  }

  for (var ri = 0; ri < allRanks.length; ri++) {
    var rank = allRanks[ri];
    // 如果庄家有4张这个点数，跳过
    if (rankCount[rank] && rankCount[rank] >= 4) continue;
    // 找一个自己手中没有的花色
    for (var si = 0; si < suits.length; si++) {
      var hasThis = hand.some(function(c) { return c.rank === rank && c.suit === suits[si]; });
      if (!hasThis) {
        return {
          callCard: { rank: rank, suit: suits[si] },
          displayName: suitNames[suits[si]] + rank
        };
      }
    }
  }
  return { callCard: { rank: '3', suit: 'spade' }, displayName: '黑桃3' };
}

/**
 * AI自由出牌（最先出牌或一轮PASS后）
 * 策略：优先出小单张
 */
function decideFreePlay(hand) {
  const groups = groupByRank(hand);
  const sortedRanks = [...groups.keys()].sort((a, b) => a - b);

  // 找单张
  for (const rank of sortedRanks) {
    const cards = groups.get(rank);
    if (cards.length === 1) {
      return { cards: [cards[0]], type: HAND_TYPE.SINGLE, mainRank: rank, length: 1 };
    }
  }

  // 找对子中较小的
  const pairs = [];
  for (const [rank, cards] of groups) {
    if (cards.length === 2) pairs.push({ rank, cards: cards.slice(0, 2) });
  }
  if (pairs.length > 0) {
    pairs.sort((a, b) => a.rank - b.rank);
    return { cards: pairs[0].cards, type: HAND_TYPE.PAIR, mainRank: pairs[0].rank, length: 1 };
  }

  // 最小的顺子
  for (let len = 3; len <= 5; len++) {
    for (let i = 0; i <= sortedRanks.length - len; i++) {
      const slice = sortedRanks.slice(i, i + len);
      if (slice[slice.length - 1] !== 15 && isConsecutive(slice)) {
        const cards = [];
        for (const r of slice) cards.push(groups.get(r)[0]);
        return { cards, type: HAND_TYPE.STRAIGHT, mainRank: slice[slice.length - 1], length: len };
      }
    }
  }

  // 就出最小的单张
  const smallestRank = sortedRanks[sortedRanks.length - 1];
  return { cards: [groups.get(smallestRank)[0]], type: HAND_TYPE.SINGLE, mainRank: smallestRank, length: 1 };
}

/**
 * AI跟牌决策
 * @returns {{ cards: Card[] } | null} cards或null(PASS)
 */
function decideFollowPlay(hand, target) {
  const result = findPlayable(hand, target);

  if (!result || !result.cards || result.cards.length === 0) {
    // 没有能压的牌，PASS
    return null;
  }

  // 如果能压的牌比较珍贵（豆/滚筒），且不是必须出，考虑PASS
  if (result.type === HAND_TYPE.DOU || result.type === HAND_TYPE.GUNTONG) {
    // 如果目标不是豆/滚筒，且手牌还多，先PASS保留大牌
    if (target.type < HAND_TYPE.DOU && hand.length > 5) {
      // 先看看有没有更低级的牌可出
      const cheaperResult = findCheaperPlay(hand, target);
      if (cheaperResult) return cheaperResult;
    }
  }

  return result;
}

function findCheaperPlay(hand, target) {
  const groups = groupByRank(hand);

  if (target.type === HAND_TYPE.SINGLE) {
    const sorted = [...hand].sort((a, b) => getRankValue(a) - getRankValue(b));
    for (const card of sorted) {
      if (getRankValue(card) > target.mainRank) {
        return { cards: [card], type: HAND_TYPE.SINGLE, mainRank: getRankValue(card), length: 1 };
      }
    }
  }
  return null;
}

module.exports = {
  decideBid,
  decideFreePlay,
  decideFollowPlay,
  evaluateHand,
  chooseCallCard
};
