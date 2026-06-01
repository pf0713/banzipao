Component({
  properties: {
    player: {
      type: Object,
      value: {}
    },
    position: {
      type: String,
      value: 'bottom'
    },
    isSelf: {
      type: Boolean,
      value: false
    },
    isCurrent: {
      type: Boolean,
      value: false
    },
    showCards: {
      type: Boolean,
      value: false
    },
    selectedCards: {
      type: Array,
      value: []
    },
    lastPlayedCards: {
      type: Array,
      value: []
    },
    gamePhase: {
      type: String,
      value: ''
    }
  },

  methods: {
    onCardTap(e) {
      this.triggerEvent('cardtap', e.detail);
    },

    isCardSelected(card) {
      if (!card) return false;
      var selected = this.data.selectedCards || this.properties.selectedCards || [];
      for (var i = 0; i < selected.length; i++) {
        if (selected[i].id === card.id) return true;
      }
      return false;
    }
  }
});
