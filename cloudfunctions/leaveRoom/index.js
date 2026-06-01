const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const { roomCode } = event;

  const { data: rooms } = await db.collection('rooms')
    .where({ roomCode })
    .get();

  if (rooms.length === 0) {
    return { success: false, error: '房间不存在' };
  }

  const room = rooms[0];

  // 过滤掉离开的玩家
  const players = room.players.filter(p => p.openId !== openId);

  if (players.length === 0) {
    // 删除空房间
    await db.collection('rooms').doc(room._id).remove();
  } else {
    // 如果房主离开，转移房主
    let updateData = { players };
    if (room.hostOpenId === openId) {
      updateData.hostOpenId = players[0].openId;
    }
    await db.collection('rooms').doc(room._id).update({ data: updateData });
  }

  return { success: true };
};
