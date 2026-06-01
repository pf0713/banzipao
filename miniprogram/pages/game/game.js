const engine = require('../../utils/game-engine');
const ai = require('../../utils/ai');
const { identify, findPlayable } = require('../../utils/hand-type');
const { PHASE } = require('../../utils/constants');

const app = getApp();

Page({
  data: {
    players: [],
    myCards: [],
    selectedCards: [],
    selectedIds: [],
    gameRound: 1,
    isMyTurn: false,
    canPlay: false,
    canPass: false,
    phase: '',
    phaseText: '',
    lastPlayInfo: '',
    currentTurn: -1,
    needBid: false,
    needCallCard: false,
    callCardOptions: [],
    selectedCallCard: '',
    showResult: false,
    heavenInfo: null,
    showSuBaoChoice: false,
    bidBtnType: ''
  },

  onLoad() {
    var mode = app.globalData.gameMode || 'ai';
    this.startNewGame(mode);
  },

  startNewGame(mode) {
    var players = [
      { name: '你', isAI: false },
      { name: '电脑A', isAI: true },
      { name: '电脑B', isAI: true },
      { name: '电脑C', isAI: true }
    ];
    var game = engine.createGame(mode, players);
    this._game = engine.startRound(game);
    this._mySeat = 0;
    this.syncState();
  },

  syncState() {
    var game = this._game;
    if (!game) return;

    var me = game.players[this._mySeat];
    var suBao = game.bidInfo.suBao || false;
    var needBid = false;
    var needCallCard = false;
    var bidBtnType = '';

    // 如果需要叫牌，只显示第一个缺的等级（从2往下找）
    var callOptions = this.data.callCardOptions;
    if (game.needCallCard && game.currentTurn === this._mySeat) {
      var bankerHand = game.players[game.banker].cards;
      var rankCount = {};
      for (var hi = 0; hi < bankerHand.length; hi++) {
        var hr = bankerHand[hi].rank;
        rankCount[hr] = (rankCount[hr] || 0) + 1;
      }
      var suitNames = { spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方块' };
      var suits = ['spade', 'heart', 'club', 'diamond'];
      var callRanks = ['2', 'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];
      var callRank = null;
      for (var cri = 0; cri < callRanks.length; cri++) {
        var cr = callRanks[cri];
        if (!rankCount[cr] || rankCount[cr] < 4) { callRank = cr; break; }
      }
      if (callRank) {
        callOptions = [];
        for (var csi = 0; csi < suits.length; csi++) {
          var hasIt = bankerHand.some(function(c) { return c.rank === callRank && c.suit === suits[csi]; });
          if (!hasIt) {
            callOptions.push({ suit: suits[csi], suitName: suitNames[suits[csi]], rank: callRank });
          }
        }
        this.setData({
          callCardOptions: callOptions,
          callRank: callRank,
          selectedCallCard: callOptions.length > 0 ? { rank: callRank, suit: callOptions[0].suit } : ''
        });
      }
    }

    if (game.phase === PHASE.BIDDING && game.currentTurn === this._mySeat) {
      needBid = true;
      if (game.needCallCard) {
        needCallCard = true;
      } else if (game.bidInfo.bidder !== null && game.bidInfo.bidder !== this._mySeat && game.bidInfo.antiBidder === null) {
        bidBtnType = 'antibao';
      } else {
        bidBtnType = 'bidder';
      }
    }

    var viewPlayers = game.players.map(function(p, i) {
      return {
        name: p.name,
        isAI: p.isAI,
        finished: p.finished,
        finishOrder: p.finishOrder,
        score: p.score,
        bonus: p.bonus,
        collectedCount: p.collectedCount,
        totalScore: game.totalScores ? game.totalScores[i] : undefined,
        cards: (i === this._mySeat || game.phase === PHASE.SETTLEMENT) ? p.cards : null,
        handCount: p.cards ? p.cards.length : 0,
        isBanker: game.banker === i,
        isBidder: game.bidInfo.bidder === i,
        isSuBao: game.bidInfo.suBao && game.bidInfo.bidder === i,
        isAntiBidder: game.bidInfo.antiBidder === i,
        // 友标记：只有知情人才看得到
        // - 如果我是 partner，我看庄家是友
        // - 如果叫牌打出了，大家都能看到友标记
        isPartnerToMe: game.bidInfo.partner !== null && game.bidInfo.partner === i && (
          !!game.bidInfo.calledCardRevealed || this._mySeat === game.bidInfo.partner
        ),
        isBankerToMe: game.bidInfo.partner !== null && game.banker === i && (
          !!game.bidInfo.calledCardRevealed || this._mySeat === game.bidInfo.partner
        ),
        // 公开标记（叫牌打出后所有人都能看到）
        isPartnerPublic: game.bidInfo.partner === i && !!game.bidInfo.calledCardRevealed,
        isBankerPublic: game.banker === i && !!game.bidInfo.calledCardRevealed,
        _lastPlayed: (game.lastPlayCards && game.lastPlaySeat === i) ? game.lastPlayCards : []
      };
    }.bind(this));

    var lastPlayInfo = '';
    if (game.lastPlay) {
      var typeNames = ['','单张','对子','顺子','炸弹','板子炮','豆','滚筒','滚龙','十三烂'];
      lastPlayInfo = typeNames[game.lastPlay.type] || '';
    }

    var suitNames = { spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方块' };
    var calledCardText = '';
    if (game.bidInfo.calledCard) {
      calledCardText = '叫' + (suitNames[game.bidInfo.calledCard.suit] || '') + game.bidInfo.calledCard.rank;
    }

    var phaseText = '';
    switch (game.phase) {
      case PHASE.BIDDING: phaseText = '叫牌阶段'; break;
      case PHASE.PLAYING: phaseText = '出牌阶段' + (calledCardText ? ' | ' + calledCardText : ''); break;
      case PHASE.SETTLEMENT: phaseText = '结算'; break;
      case PHASE.CHECK_HEAVEN: phaseText = '检查天牌...'; break;
    }

    this.setData({
      players: viewPlayers,
      myCards: me.cards || [],
      selectedCards: [],
      selectedIds: [],
      currentTurn: game.currentTurn,
      lastPlaySeat: game.lastPlaySeat,
      isMyTurn: game.currentTurn === this._mySeat && game.phase === PHASE.PLAYING,
      canPlay: false,
      canPass: !!(game.lastPlay && game.phase === PHASE.PLAYING && game.currentTurn === this._mySeat),
      phase: game.phase,
      phaseText: phaseText,
      lastPlayInfo: lastPlayInfo,
      needBid: needBid,
      needCallCard: needCallCard,
      bidBtnType: bidBtnType,
      showResult: game.phase === PHASE.SETTLEMENT,
      heavenInfo: game.heavenInfo,
      showSuBaoChoice: !!game._pendingSuBaoChoice
    });

    // 查询手牌区域位置（用于滑动选牌）
    if (!this._handInnerRect) {
      var that = this;
      wx.createSelectorQuery().select('.hand-fan').boundingClientRect(function(rect) {
        if (rect) that._handInnerRect = rect;
      }).exec();
    }

    // 三张提醒
    if (game._pendingReminder) {
      var remindedSeat = game._pendingReminder.seat;
      var remindedPlayer = game.players[remindedSeat];
      var isBidder = game.bidInfo.bidder === remindedSeat;
      if (!isBidder) {
        var names = ['你', '电脑A', '电脑B', '电脑C'];
        wx.showToast({
          title: names[remindedSeat] + '只剩' + remindedPlayer.cards.length + '张牌!',
          icon: 'none',
          duration: 2000
        });
      }
      game._pendingReminder = null;
    }

    if (game.phase === PHASE.BIDDING && game.currentTurn !== this._mySeat) {
      this.runAIBid();
    }
    if (game.phase === PHASE.PLAYING && game.currentTurn !== this._mySeat && !game.players[game.currentTurn].finished) {
      this.runAIPlay();
    }
  },

  onBidBao: function() {
    if (!this.data.needBid) return;
    var r = engine.handleBid(this._game, this._mySeat, 'bao');
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onSuBaoYes: function() {
    var r = engine.handleBid(this._game, this._mySeat, 'subao_yes');
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onSuBaoNo: function() {
    var r = engine.handleBid(this._game, this._mySeat, 'subao_no');
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onBidPass: function() {
    if (!this.data.needBid) return;
    var r = engine.handleBid(this._game, this._mySeat, 'pass');
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onBidAnti: function() {
    if (!this.data.needBid) return;
    var r = engine.handleBid(this._game, this._mySeat, 'antibao');
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onSelectCallSuit: function(e) {
    var rank = e.currentTarget.dataset.rank;
    var suit = e.currentTarget.dataset.suit;
    this.setData({ selectedCallCard: { rank: rank, suit: suit } });
  },

  onConfirmCall: function() {
    var card = this.data.selectedCallCard;
    if (!card) { wx.showToast({ title: '请选择一张牌', icon: 'none' }); return; }
    var r = engine.handleBid(this._game, this._mySeat, { callCard: { rank: card.rank, suit: card.suit } });
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  // ===== 选牌：点击 + 滑动 =====

  onCardTap: function(e) {
    if (this._wasSwiping) { this._wasSwiping = false; return; }
    if (!this.data.isMyTurn) return;
    var card = e.detail.card;
    if (!card || !card.id) return;
    this._doToggleCard(card);
  },

  onHandTouchStart: function(e) {
    if (!this.data.isMyTurn) return;
    this._touchStartX = e.touches[0].pageX;
    this._touchStartY = e.touches[0].pageY;
    this._touchMoved = false;
    this._lastSwipedIdx = -1;

    var idx = this._getCardIndexAtX(e.touches[0].pageX);
    if (idx >= 0 && idx < this.data.myCards.length) {
      this._doToggleCard(this.data.myCards[idx]);
      this._lastSwipedIdx = idx;
    }
  },

  onHandTouchMove: function(e) {
    if (!this.data.isMyTurn) return;
    var dx = Math.abs(e.touches[0].pageX - this._touchStartX);
    var dy = Math.abs(e.touches[0].pageY - this._touchStartY);
    if (dx < 6 && dy < 6) return;

    this._touchMoved = true;
    this._wasSwiping = true;
    var idx = this._getCardIndexAtX(e.touches[0].pageX);
    if (idx >= 0 && idx < this.data.myCards.length && idx !== this._lastSwipedIdx) {
      this._doToggleCard(this.data.myCards[idx]);
      this._lastSwipedIdx = idx;
    }
  },

  onHandTouchEnd: function(e) {
    if (this._touchMoved) {
      this._wasSwiping = true;
      setTimeout(function() { this._wasSwiping = false; }.bind(this), 200);
    }
  },

  _getCardIndexAtX: function(pageX) {
    if (!this._handInnerRect) return -1;
    var rect = this._handInnerRect;
    var relX = pageX - rect.left;
    var frac = relX / rect.width;
    var idx = Math.round(frac * (this.data.myCards.length - 1));
    return Math.max(0, Math.min(this.data.myCards.length - 1, idx));
  },

  _doToggleCard: function(card) {
    var sel = this.data.selectedCards.slice();
    var idx = -1;
    for (var i = 0; i < sel.length; i++) {
      if (sel[i].id === card.id) { idx = i; break; }
    }
    if (idx >= 0) {
      sel.splice(idx, 1);
    } else {
      sel.push(card);
    }
    var ok = sel.length > 0 ? identify(sel) : null;
    var ids = sel.map(function(c) { return c.id; });
    this.setData({ selectedCards: sel, selectedIds: ids, canPlay: !!ok });
  },

  onPlay: function() {
    if (!this.data.canPlay) return;
    var cards = this.data.selectedCards;
    var r = engine.playCards(this._game, this._mySeat, cards);
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onPass: function() {
    if (!this.data.canPass) return;
    var r = engine.passTurn(this._game, this._mySeat);
    if (r.error) { wx.showToast({ title: r.error, icon: 'none' }); return; }
    this._game = r;
    this.syncState();
  },

  onHint: function() {
    if (!this.data.isMyTurn) {
      wx.showToast({ title: '还没轮到你出牌', icon: 'none' });
      return;
    }
    var hand = this._game.players[this._mySeat].cards;
    var hint;
    if (this._game.lastPlay) {
      hint = findPlayable(hand, this._game.lastPlay);
    } else {
      hint = ai.decideFreePlay(hand);
    }
    if (hint && hint.cards) {
      var ids = hint.cards.map(function(c) { return c.id; });
      this.setData({ selectedCards: hint.cards, selectedIds: ids, canPlay: true });
      wx.showToast({ title: '已推荐 ' + hint.cards.length + ' 张牌', icon: 'none', duration: 1200 });
    } else {
      wx.showToast({ title: '没有能压过的牌，请PASS', icon: 'none', duration: 1500 });
    }
  },

  runAIBid: function() {
    var that = this;
    var seat = this._game.currentTurn;
    var player = this._game.players[seat];
    if (!player.isAI || player.finished) return;

    setTimeout(function() {
      var ctx = {
        banker: that._game.banker,
        bidInfo: that._game.bidInfo,
        isBanker: seat === that._game.banker,
        needCallCard: that._game.needCallCard
      };
      var choice;
      if (that._game.needCallCard) {
        choice = ai.chooseCallCard(that._game.players[seat].cards);
        if (!choice || !choice.callCard) { choice = { callCard: { rank: '3', suit: 'spade' } }; }
      } else {
        choice = ai.decideBid(player.cards, ctx);
      }
      var r = engine.handleBid(that._game, seat, choice);
      if (r.error) r = engine.handleBid(that._game, seat, 'pass');
      that._game = r;
      // AI素包选择：有素包资格时随机50%选素包
      if (that._game._pendingSuBaoChoice) {
        var chooseSuBao = Math.random() < 0.5;
        r = engine.handleBid(that._game, seat, chooseSuBao ? 'subao_yes' : 'subao_no');
        if (!r.error) that._game = r;
      }
      that.syncState();
    }, 400);
  },

  runAIPlay: function() {
    var that = this;
    var seat = this._game.currentTurn;
    var player = this._game.players[seat];
    if (!player.isAI || player.finished) return;

    if (this._game.bidInfo.antiBidder !== null &&
        seat !== this._game.bidInfo.bidder &&
        seat !== this._game.bidInfo.antiBidder) {
      this._game.currentTurn = (seat + 1) % 4;
      this.runAIPlay();
      return;
    }

    setTimeout(function() {
      var hand = player.cards;
      var r;
      if (that._game.lastPlay) {
        var choice = ai.decideFollowPlay(hand, that._game.lastPlay);
        if (choice) {
          r = engine.playCards(that._game, seat, choice.cards);
        } else {
          r = engine.passTurn(that._game, seat);
        }
      } else {
        var choice = ai.decideFreePlay(hand);
        r = engine.playCards(that._game, seat, choice.cards);
      }
      if (r.error) r = engine.passTurn(that._game, seat);
      that._game = r;
      that.syncState();
    }, 600);
  },

  onContinueGame: function() {
    this.setData({ showResult: false });
    this.startNewGame(this._game.mode);
  },

  onBackToHome: function() {
    wx.navigateBack();
  }
});
