const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { gameStateId, cards } = event;

  const { data: states } = await db.collection('gameStates')
    .doc(gameStateId).get();

  if (!states) return { success: false, error: '游戏不存在' };

  const state = states;
  const playerIdx = state.players.findIndex(p => p.openId === openId);

  if (playerIdx !== state.currentTurn) {
    return { success: false, error: '还没轮到你' };
  }

  // 验证牌型合法性（在实际项目中应完整校验）
  // 这里简化处理，客户端已验证

  // 从手牌中移除
  const playerCards = state.players[playerIdx].cards;
  const cardIds = new Set(cards.map(c => c.id));
  state.players[playerIdx].cards = playerCards.filter(c => !cardIds.has(c.id));

  // 更新出牌信息
  state.lastPlay = { seat: playerIdx, cards };
  state.lastPlaySeat = playerIdx;
  state.passCount = 0;

  // 更新回合
  state.currentTurn = (playerIdx + 1) % 4;

  await db.collection('gameStates').doc(gameStateId).update({
    data: state
  });

  return { success: true };
};
