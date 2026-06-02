const app = getApp();

Page({
  data: {
    rooms: [],
    roomCode: '',
    showCreate: false,
    playerName: '',
    isHost: false,
    currentRoom: null
  },

  onLoad() {
    this.loadRooms();
  },

  async loadRooms() {
    // TODO: 从云数据库加载房间列表
    // 当前使用模拟数据
    this.setData({
      rooms: []
    });
  },

  onCodeInput(e) {
    this.setData({ roomCode: e.detail.value });
  },

  onNameInput(e) {
    this.setData({ playerName: e.detail.value });
  },

  async createRoom() {
    const name = this.data.playerName || app.globalData.userInfo?.nickName || '玩家';
    // TODO: 调用云函数 createRoom
    wx.showLoading({ title: '创建房间...' });

    // 模拟创建
    const roomCode = String(Math.floor(100000 + Math.random() * 900000));
    this.setData({
      isHost: true,
      currentRoom: {
        roomCode,
        players: [{ name, seat: 0, ready: true }],
        status: 'waiting'
      },
      showCreate: true
    });
    wx.hideLoading();
  },

  async joinRoom() {
    if (!this.data.roomCode) {
      wx.showToast({ title: '请输入房间码', icon: 'none' });
      return;
    }
    const name = this.data.playerName || app.globalData.userInfo?.nickName || '玩家';
    // TODO: 调用云函数 joinRoom
    wx.showLoading({ title: '加入房间...' });
    // 模拟加入
    this.setData({
      currentRoom: {
        roomCode: this.data.roomCode,
        players: [
          { name, seat: 0, ready: true },
          { name: '等待中...', seat: 1, ready: false }
        ],
        status: 'waiting'
      },
      showCreate: true
    });
    wx.hideLoading();
  },

  startGame() {
    if (!this.data.isHost) return;
    // TODO: 调用云函数 startGame
    app.globalData.roomInfo = this.data.currentRoom;
    wx.navigateTo({ url: '/pages/game/game' });
  },

  leaveRoom() {
    this.setData({
      showCreate: false,
      currentRoom: null,
      isHost: false
    });
    // TODO: 调用云函数 leaveRoom
  },

  copyRoomCode() {
    wx.setClipboardData({
      data: this.data.currentRoom.roomCode,
      success() {
        wx.showToast({ title: '房间码已复制', icon: 'success' });
      }
    });
  }
});
