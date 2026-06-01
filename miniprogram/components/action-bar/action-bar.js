Component({
  properties: {
    canPlay: {
      type: Boolean,
      value: false
    },
    canPass: {
      type: Boolean,
      value: false
    },
    selectedCards: {
      type: Array,
      value: []
    },
    isMyTurn: {
      type: Boolean,
      value: false
    },
    phase: {
      type: String,
      value: ''
    },
    showHint: {
      type: Boolean,
      value: false
    },
    hintCards: {
      type: Array,
      value: []
    }
  },

  methods: {
    onPlay() {
      if (!this.data.canPlay) {
        wx.showToast({ title: '请选择要出的牌', icon: 'none' });
        return;
      }
      this.triggerEvent('play');
    },

    onPass() {
      this.triggerEvent('pass');
    },

    onHint() {
      this.triggerEvent('hint');
    }
  }
});
