const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  // 生成6位房间码
  const roomCode = String(Math.floor(100000 + Math.random() * 900000));

  const room = {
    roomCode,
    hostOpenId: openId,
    players: [{
      openId,
      seat: 0,
      ready: true,
      nickname: event.nickname || '玩家',
      avatarUrl: event.avatarUrl || ''
    }],
    status: 'waiting',
    maxPlayers: 4,
    createdAt: db.serverDate()
  };

  const result = await db.collection('rooms').add({ data: room });

  return {
    success: true,
    roomId: result._id,
    roomCode
  };
};
