App({
  onLaunch() {
    const that = this;
    if (wx.cloud) {
      wx.cloud.init({
        env: 'banzipao-0gxxxx', // TODO: 替换为你的云环境ID
        traceUser: true
      });
    }
    // 获取用户信息
    wx.getUserInfo({
      success(res) {
        that.globalData.userInfo = res.userInfo;
      }
    });
  },
  globalData: {
    userInfo: null,
    gameMode: 'ai',     // 'ai' | 'online'
    roomInfo: null,     // 房间信息
    gameResult: null    // 结算数据
  }
});
