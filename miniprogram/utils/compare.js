const { HAND_TYPE } = require('./constants');
const { identify } = require('./hand-type');

/**
 * 判断 play 是否能大过 target
 * @param {Card[]} playCards - 要出的牌
 * @param {Object} target - 上一轮的牌型结果（identify的输出），null表示自由出牌
 * @returns {boolean}
 */
function canBeat(playCards, target) {
  if (!playCards || playCards.length === 0) return false;

  // 自由出牌：任意合法牌型都可以
  if (!target) {
    return identify(playCards) !== null;
  }

  const playType = identify(playCards);
  if (!playType) return false; // 非法牌型

  const t = target;

  // 滚龙和十三烂是天牌，不可被压
  if (t.type === HAND_TYPE.GUNLONG || t.type === HAND_TYPE.THIRTEEN) {
    return false;
  }

  // 同类型比较
  if (playType.type === t.type) {
    // 对于需要张数相同的牌型
    if (t.type === HAND_TYPE.STRAIGHT || t.type === HAND_TYPE.BANZIPAO ||
        t.type === HAND_TYPE.GUNTONG) {
      if (playType.length !== t.length) return false;
    }
    return playType.mainRank > t.mainRank;
  }

  // 跨类型压制规则：
  // 炸弹(4) 可压 单张(1)/对子(2)/顺子(3)
  // 板子炮(5) 可压 单张/对子/顺子/炸弹(4)?
  // 豆(6) 可压 以上所有
  // 滚筒(7) 可压 以上所有
  // 滚龙(8) 可压 以上所有

  if (playType.type === HAND_TYPE.BOMB &&
      [HAND_TYPE.SINGLE, HAND_TYPE.PAIR, HAND_TYPE.STRAIGHT].includes(t.type)) {
    return true;
  }

  if (playType.type === HAND_TYPE.BANZIPAO &&
      [HAND_TYPE.SINGLE, HAND_TYPE.PAIR, HAND_TYPE.STRAIGHT, HAND_TYPE.BOMB].includes(t.type)) {
    return true;
  }

  if (playType.type === HAND_TYPE.DOU &&
      t.type < HAND_TYPE.DOU) {
    return true;
  }

  if (playType.type === HAND_TYPE.GUNTONG &&
      t.type < HAND_TYPE.GUNTONG) {
    return true;
  }

  if (playType.type === HAND_TYPE.GUNLONG &&
      t.type < HAND_TYPE.GUNLONG) {
    return true;
  }

  return false;
}

module.exports = { canBeat };
