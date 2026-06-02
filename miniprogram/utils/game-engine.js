const { createDeck, shuffle, deal, sortHand, findBanker, removeCards } = require('./card');
const { isThirteen, hasGunLong, identify, findPlayable } = require('./hand-type');
const { canBeat } = require('./compare');
const { calculateGameScore, calculateBonus, calculateHeavenScore } = require('./scorer');
const { HAND_TYPE, PHASE, HAND_SIZE } = require('./constants');

/**
 * 创建新游戏
 */
function createGame(mode, players) {
  return {
    mode,
    phase: PHASE.INIT,
    players: players.map((p, i) => ({
      seat: i,
      name: p.name || `玩家${i + 1}`,
      isAI: p.isAI || false,
      cards: [],
      collectedCards: [],   // 得的牌
      collectedCount: 0,    // 得牌数量
      finished: false,
      finishOrder: 0,       // 出完顺序（1最先出完）
      score: 0,
      bonus: 0
    })),
    banker: -1,
    bidInfo: {
      bidder: null,         // 包牌者
      antiBidder: null,     // 反包者
      partner: null,        // 叫牌的队友
      calledCard: null      // 庄家叫的牌 { rank, suit? }
    },
    currentTurn: -1,
    lastPlay: null,         // 上一轮出的牌信息
    lastPlayCards: null,   // 上一轮出的牌
    lastPlaySeat: -1,       // 上一轮出牌人
    passCount: 0,
    roundComplete: false,
    finishCounter: 0,       // 出完计数
    heavenInfo: null,       // 天牌信息
    totalScores: null,      // 累计总分
    stateHistory: []        // 历史记录（用于回放等）
  };
}

/**
 * 初始化并开始一局
 */
function startRound(game) {
  // 洗牌发牌
  const deck = shuffle(createDeck());
  const hands = deal(deck);

  // 分配手牌
  for (let i = 0; i < 4; i++) {
    game.players[i].cards = sortHand(hands[i]);
    game.players[i].collectedCards = [];
    game.players[i].collectedCount = 0;
    game.players[i].finished = false;
    game.players[i].finishOrder = 0;
    game.players[i].score = 0;
    game.players[i].bonus = 0;
  }

  // 找庄家（黑桃7）
  game.banker = findBanker(hands);
  game.bidInfo = { bidder: null, antiBidder: null, partner: null, calledCard: null };
  game.finishCounter = 0;
  game.passCount = 0;
  game.lastPlay = null;
  game.lastPlayCards = null;
  game.lastPlaySeat = -1;
  game.tableCardCount = 0;
  game.roundComplete = false;
  game.heavenInfo = null;
  game._pendingReminder = null;
  // 重置三张提醒标记
  for (var k = 0; k < 4; k++) {
    game.players[k]._threeCardReminded = false;
  }

  // 检查天牌
  game.phase = PHASE.CHECK_HEAVEN;
  return checkHeaven(game);
}

/**
 * 检查天牌
 */
function checkHeaven(game) {
  const heavenPlayers = [];

  for (let i = 0; i < 4; i++) {
    const hand = game.players[i].cards;
    const gl = hasGunLong(hand);
    if (gl) {
      heavenPlayers.push({ seat: i, type: 'gunlong', info: gl });
    }
    if (isThirteen(hand)) {
      heavenPlayers.push({ seat: i, type: 'thirteen', info: null });
    }
  }

  if (heavenPlayers.length > 0) {
    // 天牌：滚龙优先，否则庄家开始最近者
    const gunlongs = heavenPlayers.filter(h => h.type === 'gunlong');
    if (gunlongs.length > 0) {
      // 滚龙大的胜
      gunlongs.sort((a, b) => b.info.mainRank - a.info.mainRank);
      game.heavenInfo = gunlongs[0];
    } else {
      // 十三烂：从庄家起最近者
      let winner = null;
      for (let offset = 0; offset < 4; offset++) {
        const seat = (game.banker + offset) % 4;
        const found = heavenPlayers.find(h => h.seat === seat);
        if (found) { winner = found; break; }
      }
      game.heavenInfo = winner;
    }
    game.phase = PHASE.SETTLEMENT;
    return game;
  }

  // 无天牌，进入叫牌阶段
  game.phase = PHASE.BIDDING;
  game.currentTurn = game.banker;
  game.biddingOrder = [game.banker, (game.banker + 1) % 4, (game.banker + 2) % 4, (game.banker + 3) % 4];
  game.biddingIndex = 0;
  return game;
}

/**
 * 处理叫牌选择
 * @param {number} seat - 叫牌人座位
 * @param {string} choice - 'bao' | 'pass' | 'antibao' | 'call' | { rank, suit? }
 */
function handleBid(game, seat, choice) {
  if (game.phase !== PHASE.BIDDING) return { error: '不是叫牌阶段' };
  if (seat !== game.currentTurn) return { error: '还没轮到你叫牌' };

  if (choice === 'bao') {
    game.bidInfo.bidder = seat;
    // 检查是否素包
    var canSuBao = require('./hand-type').isSuBao(game.players[seat].cards);
    if (canSuBao) {
      // 素包可选，等玩家确认
      game._pendingSuBaoChoice = true;
      return game;
    }
    // 不能素包，直接包牌
    game.bidInfo.suBao = false;
    game.currentTurn = (seat + 1) % 4;
    game.biddingOrder = getRemainingBidders(game);
    if (game.currentTurn === game.banker && game.bidInfo.bidder === game.banker) {
      return startPlaying(game);
    }
    return game;
  }

  // 确认素包选择
  if (choice === 'subao_yes' || choice === 'subao_no') {
    if (seat !== game.bidInfo.bidder) return { error: '只有包牌者可选素包' };
    game.bidInfo.suBao = (choice === 'subao_yes');
    game._pendingSuBaoChoice = false;
    game.currentTurn = (seat + 1) % 4;
    game.biddingOrder = getRemainingBidders(game);
    if (game.currentTurn === game.banker && game.bidInfo.bidder === game.banker) {
      return startPlaying(game);
    }
    return game;
  }

  if (choice === 'antibao') {
    game.bidInfo.antiBidder = seat;
    return startPlaying(game);
  }

  if (choice === 'pass') {
    // 检查是否四人均不包
    const allDone = advanceBidding(game);
    if (allDone) {
      // 如果已经有人包牌，直接开始
      if (game.bidInfo.bidder !== null) {
        return startPlaying(game);
      }
      // 庄家必须叫牌
      game.currentTurn = game.banker;
      return { ...game, needCallCard: true };
    }
    return game;
  }

  if (choice === 'call' || (typeof choice === 'object' && choice.callCard)) {
    // 庄家叫牌：指定rank+suit，如果没有suit则自动选一个自己没有的
    var calledRank = choice.callCard.rank || choice.callCard;
    var calledSuit = choice.callCard.suit || null;
    var hand = game.players[game.banker].cards;

    // 如果没有指定suit，选一个自己手中没有的花色
    if (!calledSuit) {
      var suits = ['spade', 'heart', 'club', 'diamond'];
      for (var si = 0; si < suits.length; si++) {
        var hasCard = hand.some(function(c) { return c.rank === calledRank && c.suit === suits[si]; });
        if (!hasCard) { calledSuit = suits[si]; break; }
      }
    }

    game.bidInfo.calledCard = { rank: calledRank, suit: calledSuit };

    // 找到持有该牌的玩家作为队友
    for (var i = 0; i < 4; i++) {
      if (i === game.banker) continue;
      var h = game.players[i].cards;
      var found = h.some(function(c) { return c.rank === calledRank && c.suit === calledSuit; });
      if (found) {
        game.bidInfo.partner = i;
        break;
      }
    }
    return startPlaying(game);
  }

  return { error: '无效选择' };
}

function getRemainingBidders(game) {
  const all = [];
  for (let i = 0; i < 4; i++) {
    const seat = (game.bidInfo.bidder + 1 + i) % 4;
    if (seat === game.bidInfo.bidder) continue;
    if (seat === game.bidInfo.antiBidder) continue;
    all.push(seat);
  }
  return all;
}

function advanceBidding(game) {
  game.biddingIndex++;
  if (game.biddingIndex >= 4) {
    return true; // 都pass了
  }
  game.currentTurn = game.biddingOrder[game.biddingIndex];
  return false;
}

/**
 * 开始出牌阶段
 */
function startPlaying(game) {
  game.phase = PHASE.PLAYING;

  // 确定先出牌者
  if (game.bidInfo.antiBidder !== null) {
    game.currentTurn = game.bidInfo.antiBidder;
  } else if (game.bidInfo.bidder !== null) {
    game.currentTurn = game.bidInfo.bidder;
  } else {
    game.currentTurn = game.banker;
  }

  game.lastPlay = null;
  game.lastPlayCards = null;
  game.lastPlaySeat = -1;
  game.passCount = 0;

  // 反包局：只有两人参与
  if (game.bidInfo.antiBidder !== null) {
    game.activePlayers = [game.bidInfo.bidder, game.bidInfo.antiBidder];
  } else {
    game.activePlayers = [0, 1, 2, 3];
  }

  return game;
}

/**
 * 出牌
 */
function playCards(game, seat, cards) {
  if (game.phase !== PHASE.PLAYING) return { error: '不是出牌阶段' };
  if (seat !== game.currentTurn) return { error: '还没轮到你' };
  if (game.players[seat].finished) return { error: '你已经出完了' };

  // 反包局：非参与玩家跳过
  if (game.bidInfo.antiBidder !== null && !game.activePlayers.includes(seat)) {
    return { error: '本局你不参与' };
  }

  const handType = identify(cards);
  if (!handType) return { error: '无效牌型' };

  // 检查是否能压过上一手牌
  if (game.lastPlay && !canBeat(cards, game.lastPlay)) {
    return { error: '打不过，请选择更大的牌型或PASS' };
  }

  // 从手牌中移除
  game.players[seat].cards = removeCards(game.players[seat].cards, cards);
  var newCount = game.players[seat].cards.length;

  // 检查是否打出了庄家叫的牌，揭示队友身份
  if (game.bidInfo.calledCard && !game.bidInfo.calledCardRevealed) {
    var cc = game.bidInfo.calledCard;
    for (var ci = 0; ci < cards.length; ci++) {
      if (cards[ci].rank === cc.rank && cards[ci].suit === cc.suit) {
        game.bidInfo.calledCardRevealed = true;
        break;
      }
    }
  }

  // 三张提醒：首次降到≤3张时提醒对手（包牌者不需被提醒）
  if (newCount <= 3 && newCount > 0 && !game.players[seat]._threeCardReminded) {
    game.players[seat]._threeCardReminded = true;
    game._pendingReminder = { seat: seat };
  }

  // 更新出牌信息
  const playInfo = {
    seat,
    cards,
    handType: handType.type,
    mainRank: handType.mainRank,
    length: handType.length
  };
  game.tableCardCount = (game.tableCardCount || 0) + cards.length;
  game.lastPlay = handType;
  game.lastPlayCards = cards;
  game.lastPlaySeat = seat;
  game.passCount = 0;

  // 得牌（添加出牌记录）
  if (!game.players[seat]._playHistory) game.players[seat]._playHistory = [];
  game.players[seat]._playHistory.push(playInfo);

  // 检查是否出完
  if (game.players[seat].cards.length === 0) {
    game.finishCounter++;
    game.players[seat].finished = true;
    game.players[seat].finishOrder = game.finishCounter;
  }

  // 检查游戏是否结束
  if (isGameOver(game)) {
    return finishGame(game);
  }

  // 轮换到下一个有效玩家
  advanceTurn(game);
  return game;
}

/**
 * PASS
 */
function passTurn(game, seat) {
  if (game.phase !== PHASE.PLAYING) return { error: '不是出牌阶段' };
  if (seat !== game.currentTurn) return { error: '还没轮到你' };
  if (game.players[seat].finished) return { error: '你已经出完了' };

  // 自由出牌不能PASS
  if (!game.lastPlay) return { error: '轮到你自由出牌，不能PASS' };

  game.passCount++;

  // 检查一圈都PASS了
  const activeCount = getActivePlayerCount(game);
  if (game.passCount >= activeCount - 1) {
    // 一圈PASS，上轮出牌者得牌并自由出牌
    var collector = game.lastPlaySeat;
    collectRound(game);
    game.lastPlay = null;
    game.lastPlayCards = null;
    game.lastPlaySeat = -1;
    game.passCount = 0;
    game.currentTurn = collector;
  } else {
    advanceTurn(game);
  }

  return game;
}

function getActivePlayerCount(game) {
  if (game.bidInfo.antiBidder !== null) {
    return game.activePlayers.filter(s => !game.players[s].finished).length;
  }
  return game.players.filter(p => !p.finished).length;
}

function collectRound(game) {
  const collector = game.lastPlaySeat;
  if (collector < 0) return;
  // 累计桌上所有牌给收集者
  game.players[collector].collectedCount += (game.tableCardCount || game.lastPlayCards ? game.lastPlayCards.length : 0);
  game.tableCardCount = 0;
  if (!game.players[collector]._collectedRounds) {
    game.players[collector]._collectedRounds = [];
  }
  game.players[collector]._collectedRounds.push({
    cards: game.lastPlayCards || [],
    type: game.lastPlay ? game.lastPlay.type : null
  });
}

function getLastCollector(game) {
  return game.lastPlaySeat;
}

function isGameOver(game) {
  if (game.bidInfo.antiBidder !== null) {
    // 反包局：一人出完即结束
    return game.players[game.bidInfo.bidder].finished ||
           game.players[game.bidInfo.antiBidder].finished;
  }
  if (game.bidInfo.bidder !== null) {
    // 包牌局：一人出完即结束
    return game.finishCounter >= 1;
  }
  // 叫牌局：一方两人都出完，或只剩一人
  var unfinished = game.players.filter(function(p) { return !p.finished; });
  if (unfinished.length <= 1) return true;
  if (unfinished.length === 0) return true;

  // 检查是否一方两人都出完
  var banker = game.banker;
  var partner = game.bidInfo.partner;
  if (partner !== null && partner !== undefined) {
    if (game.players[banker].finished && game.players[partner].finished) return true;
    var otherTeam = [0, 1, 2, 3].filter(function(i) { return i !== banker && i !== partner; });
    if (otherTeam.length === 2 && game.players[otherTeam[0]].finished && game.players[otherTeam[1]].finished) return true;
  }

  return false;
}

function finishGame(game) {
  game.phase = PHASE.SETTLEMENT;

  // 计算基础得分
  var gameScores = calculateGameScore(game);

  // 计算附加分
  var bonusScores = [0, 0, 0, 0];
  for (var i = 0; i < 4; i++) {
    var player = game.players[i];
    if (player._collectedRounds) {
      for (var ri = 0; ri < player._collectedRounds.length; ri++) {
        var round = player._collectedRounds[ri];
        if (round.type === HAND_TYPE.DOU || round.type === HAND_TYPE.GUNTONG) {
          var bonus = calculateBonus({ seat: i, handType: round.type, cards: round.cards });
          for (var j = 0; j < 4; j++) bonusScores[j] += bonus[j];
        }
      }
    }
  }

  // 累计总分
  if (!game.totalScores) game.totalScores = [0, 0, 0, 0];
  for (var k = 0; k < 4; k++) {
    game.players[k].score = gameScores[k];
    game.players[k].bonus = bonusScores[k];
    game.totalScores[k] = (game.totalScores[k] || 0) + gameScores[k] + bonusScores[k];
  }

  return game;
}

function advanceTurn(game) {
  var active = game.bidInfo.antiBidder !== null ? game.activePlayers : [0, 1, 2, 3];
  var start = game.currentTurn;
  for (var offset = 1; offset <= 4; offset++) {
    var next = (start + offset) % 4;
    var found = false;
    for (var ai = 0; ai < active.length; ai++) {
      if (active[ai] === next) { found = true; break; }
    }
    if (found && !game.players[next].finished) {
      game.currentTurn = next;
      return;
    }
  }
  // 找不到玩家 → 该结束了
  finishGame(game);
  game.currentTurn = start;
}

/**
 * 获取AI可用的操作
 */
function getAIActions(game, seat) {
  if (seat !== game.currentTurn) return null;
  const hand = game.players[seat].cards;

  if (game.lastPlay) {
    const playable = findPlayable(hand, game.lastPlay);
    return { canPass: true, playable };
  }
  // 自由出牌
  return { canPass: false, playable: null };
}

module.exports = {
  createGame,
  startRound,
  handleBid,
  playCards,
  passTurn,
  getAIActions,
  identify,
  findPlayable
};
