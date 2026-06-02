// 牌点定义（3-2）
const RANK = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
};

const RANK_NAMES = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};

const SUITS = ['spade', 'heart', 'club', 'diamond'];
const SUIT_NAMES = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };

// 牌型枚举（从小到大）
const HAND_TYPE = {
  SINGLE: 1,       // 单张
  PAIR: 2,         // 对子
  STRAIGHT: 3,     // 顺子（≥3张连牌，2不参与）
  BOMB: 4,         // 炸弹（3张相同）
  BANZIPAO: 5,     // 板子炮（≥3对连对，2不参与）
  DOU: 6,          // 豆（4张相同）
  GUNTONG: 7,      // 滚筒（≥3连炸）
  GUNLONG: 8,      // 滚龙（≥3连豆）- 天牌
  THIRTEEN: 9      // 十三烂 - 天牌
};

// 积分常量
const SCORE = {
  BAO_WIN: 9,
  BAO_LOSE: -9,
  ANTI_BAO_WIN: 9,
  ANTI_BAO_LOSE: -18,
  SHUANGFEI_WIN: 2,
  SHUANGFEI_LOSE: -2,
  NORMAL_WIN: 1,
  NORMAL_LOSE: -1,
  DOU_BONUS: 3,
  FOUR_TWO_BONUS: 6,
  GUNTONG_BONUS: 9,
  THIRTEEN_SCORE: 18,
  GUNLONG_SCORE: 36
};

// 每人手牌数
const HAND_SIZE = 13;

// 游戏阶段
const PHASE = {
  INIT: 'init',
  DEAL: 'deal',
  CHECK_HEAVEN: 'check_heaven',
  BIDDING: 'bidding',
  PLAYING: 'playing',
  SETTLEMENT: 'settlement'
};

// 对战模式
const MODE = {
  AI: 'ai',           // 人机对战
  ONLINE: 'online'    // 联网对战
};

module.exports = {
  RANK,
  RANK_NAMES,
  SUITS,
  SUIT_NAMES,
  HAND_TYPE,
  SCORE,
  HAND_SIZE,
  PHASE,
  MODE
};
