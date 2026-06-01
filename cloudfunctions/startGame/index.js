const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 引入游戏逻辑（简化版，服务端只做状态同步）
const { createDeck, shuffle, deal, findBanker } = require('./card-utils');
const { isThirteen, hasGunLong } = require('./hand-type-utils');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { roomCode } = event;

  const { data: rooms } = await db.collection('rooms')
    .where({ roomCode, hostOpenId: openId })
    .get();

  if (rooms.length === 0) {
    return { success: false, error: '只有房主可以开始游戏' };
  }

  const room = rooms[0];
  if (room.players.length < 4) {
    return { success: false, error: '需要4人才能开始' };
  }

  // 洗牌发牌
  const deck = shuffle(createDeck());
  const hands = deal(deck);
  const banker = findBanker(hands);

  // 创建游戏状态
  const gameState = {
    roomId: room._id,
    roomCode,
    phase: 'check_heaven',
    players: room.players.map((p, i) => ({
      ...p,
      cards: hands[i],         // 注意：生产环境应对非本人加密
      handCount: 13,
      collectedCount: 0,
      finished: false,
      finishOrder: 0,
      score: 0
    })),
    currentTurn: -1,
    lastPlay: null,
    lastPlaySeat: -1,
    passCount: 0,
    banker,
    bidInfo: {
      bidder: null,
      antiBidder: null,
      partner: null,
      calledCard: null
    },
    createdAt: db.serverDate()
  };

  // 检查天牌
  let heavenInfo = null;
  for (let i = 0; i < 4; i++) {
    const gl = hasGunLong(hands[i]);
    if (gl) { heavenInfo = { seat: i, type: 'gunlong' }; break; }
    if (isThirteen(hands[i])) {
      heavenInfo = { seat: i, type: 'thirteen' };
    }
  }

  if (heavenInfo) {
    gameState.phase = 'settlement';
    gameState.heavenInfo = heavenInfo;
  } else {
    gameState.phase = 'bidding';
    gameState.currentTurn = banker;
  }

  const result = await db.collection('gameStates').add({ data: gameState });

  // 更新房间状态
  await db.collection('rooms').doc(room._id).update({
    data: { status: 'playing' }
  });

  return {
    success: true,
    gameStateId: result._id,
    gameState
  };
};
