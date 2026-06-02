const app = getApp();

Page({
  data: {
    result: null
  },

  onLoad() {
    this.setData({ result: app.globalData.gameResult });
  },

  playAgain() {
    wx.redirectTo({ url: '/pages/game/game' });
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' });
  }
});
