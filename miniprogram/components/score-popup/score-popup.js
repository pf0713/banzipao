Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    players: {
      type: Array,
      value: []
    },
    heavenInfo: {
      type: Object,
      value: null
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onContinue() {
      this.triggerEvent('continue');
    },

    onBack() {
      this.triggerEvent('back');
    }
  }
});
