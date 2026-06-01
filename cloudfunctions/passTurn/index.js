const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { gameStateId } = event;

  const { data: states } = await db.collection('gameStates')
    .doc(gameStateId).get();

  if (!states) return { success: false, error: '游戏不存在' };

  const state = states;
  const playerIdx = state.players.findIndex(p => p.openId === openId);

  if (playerIdx !== state.currentTurn) {
    return { success: false, error: '还没轮到你' };
  }

  if (!state.lastPlay) {
    return { success: false, error: '自由出牌不能PASS' };
  }

  state.passCount++;

  // 检查是否一圈都PASS
  const activeCount = state.players.filter(p => !p.finished).length;
  if (state.passCount >= activeCount - 1) {
    // 出牌人得牌
    const collector = state.lastPlaySeat;
    state.players[collector].collectedCount += (state.lastPlay?.cards?.length || 0);
    state.lastPlay = null;
    state.passCount = 0;
    state.currentTurn = collector;
  } else {
    state.currentTurn = (state.currentTurn + 1) % 4;
    // 跳过已出完的玩家
    while (state.players[state.currentTurn]?.finished) {
      state.currentTurn = (state.currentTurn + 1) % 4;
    }
  }

  await db.collection('gameStates').doc(gameStateId).update({
    data: state
  });

  return { success: true };
};
