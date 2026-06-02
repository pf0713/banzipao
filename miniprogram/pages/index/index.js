var app = getApp();

Page({
  data: {},

  startAIGame: function() {
    app.globalData.gameMode = 'ai';
    wx.navigateTo({ url: '/pages/game/game' });
  },

  goToRoom: function() {
    app.globalData.gameMode = 'online';
    wx.navigateTo({ url: '/pages/room/room' });
  },

  goToRules: function() {
    wx.navigateTo({ url: '/pages/rules/rules' });
  }
});
