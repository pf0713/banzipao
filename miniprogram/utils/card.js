const { RANK, SUITS, HAND_SIZE } = require('./constants');

/**
 * 创建一副牌（52张，无大小王）
 */
function createDeck() {
  const deck = [];
  const ranks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  for (const rank of ranks) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, id: `${rank}_${suit}` });
    }
  }
  return deck;
}

/**
 * Fisher-Yates 洗牌
 */
function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 发牌：每人13张
 */
function deal(deck) {
  const hands = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands;
}

/**
 * 获取牌点数字
 */
function getRankValue(card) {
  return RANK[card.rank];
}

/**
 * 手牌排序（从大到小，按花色）
 */
function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const rankDiff = RANK[b.rank] - RANK[a.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

/**
 * 找到黑桃7的持有者
 */
function findBanker(hands) {
  for (let i = 0; i < hands.length; i++) {
    for (const card of hands[i]) {
      if (card.rank === '7' && card.suit === 'spade') {
        return i;
      }
    }
  }
  return 0;
}

/**
 * 从手牌中移除指定牌
 */
function removeCards(hand, cards) {
  const cardIds = new Set(cards.map(c => c.id));
  return hand.filter(c => !cardIds.has(c.id));
}

/**
 * 检查手中是否有某张牌
 */
function hasCard(hand, rank, suit) {
  return hand.some(c => c.rank === rank && c.suit === suit);
}

module.exports = {
  createDeck,
  shuffle,
  deal,
  getRankValue,
  sortHand,
  findBanker,
  removeCards,
  hasCard
};
