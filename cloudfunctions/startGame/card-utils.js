const RANK = { '3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,'2':15 };
const SUITS = ['spade','heart','club','diamond'];

function createDeck() {
  const deck = [];
  const ranks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  for (const rank of ranks) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, id: `${rank}_${suit}` });
    }
  }
  return deck;
}

function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deal(deck) {
  const hands = [[],[],[],[]];
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands;
}

function findBanker(hands) {
  for (let i = 0; i < hands.length; i++) {
    for (const card of hands[i]) {
      if (card.rank === '7' && card.suit === 'spade') return i;
    }
  }
  return 0;
}

module.exports = { createDeck, shuffle, deal, findBanker };
