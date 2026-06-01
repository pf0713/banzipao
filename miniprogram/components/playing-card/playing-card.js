const { SUIT_NAMES } = require('../../utils/constants');

Component({
  properties: {
    card: {
      type: Object,
      value: null
    },
    selected: {
      type: Boolean,
      value: false
    },
    small: {
      type: Boolean,
      value: false
    },
    faceDown: {
      type: Boolean,
      value: false
    }
  },

  data: {
    suitSymbol: '',
    isRed: false
  },

  observers: {
    'card'() {
      this.updateCard();
    }
  },

  methods: {
    updateCard() {
      const card = this.data.card || this.properties.card;
      if (!card) return;
      const suitSymbol = SUIT_NAMES[card.suit] || '';
      const isRed = card.suit === 'heart' || card.suit === 'diamond';
      this.setData({ suitSymbol, isRed });
    },

    onTap() {
      this.triggerEvent('cardtap', { card: this.data.card || this.properties.card });
    }
  }
});
