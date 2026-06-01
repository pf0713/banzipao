const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { roomCode } = event;

  // 查找房间
  const { data: rooms } = await db.collection('rooms')
    .where({ roomCode, status: 'waiting' })
    .get();

  if (rooms.length === 0) {
    return { success: false, error: '房间不存在或已开始游戏' };
  }

  const room = rooms[0];
  if (room.players.length >= 4) {
    return { success: false, error: '房间已满' };
  }

  if (room.players.some(p => p.openId === openId)) {
    return { success: false, error: '你已在房间中' };
  }

  // 加入房间
  const newPlayer = {
    openId,
    seat: room.players.length,
    ready: true,
    nickname: event.nickname || '玩家',
    avatarUrl: event.avatarUrl || ''
  };

  await db.collection('rooms').doc(room._id).update({
    data: { players: _.push(newPlayer) }
  });

  return { success: true, roomCode };
};
