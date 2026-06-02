var { SCORE } = require('./constants');

/**
 * 计算牌局分（叫牌模式+2,4规则）
 * @returns {number[]} 4个玩家的分数变化 [p0, p1, p2, p3]
 */
function calculateGameScore(gameState) {
  var scores = [0, 0, 0, 0];
  var bidInfo = gameState.bidInfo;
  var players = gameState.players;
  var banker = gameState.banker;

  // 包牌局
  if (bidInfo.bidder !== null && bidInfo.antiBidder === null) {
    var bidder = bidInfo.bidder;
    var winner = findFirst(players);
    var isSuBao = bidInfo.suBao || false;
    if (winner === bidder) {
      var ws = isSuBao ? SCORE.BAO_WIN * 2 : SCORE.BAO_WIN;
      var ls = isSuBao ? -6 : -3;
      scores[bidder] = ws;
      for (var i = 0; i < 4; i++) {
        if (i !== bidder) scores[i] = ls;
      }
    } else {
      scores[bidder] = SCORE.BAO_LOSE;
      for (var i = 0; i < 4; i++) {
        if (i !== bidder) scores[i] = 3;
      }
    }
    return scores;
  }

  // 反包局
  if (bidInfo.bidder !== null && bidInfo.antiBidder !== null) {
    var bd = bidInfo.bidder;
    var ab = bidInfo.antiBidder;
    var w = findFirst(players);
    if (w === ab) {
      scores[ab] = SCORE.ANTI_BAO_WIN;
      scores[bd] = -9;
    } else {
      scores[ab] = SCORE.ANTI_BAO_LOSE;
      scores[bd] = 18;
    }
    return scores;
  }

  // ===== 叫牌局（2v2）=====
  var partner = bidInfo.partner;
  var teamA = [banker, partner];
  var teamB = [];
  for (var j = 0; j < 4; j++) {
    if (j !== banker && j !== partner) teamB.push(j);
  }

  // 获取每人完赛排名
  var orders = players.map(function(p) { return p.finishOrder || 99; });

  // 双飞检测：一方占1、2名
  var aOrders = [orders[teamA[0]], orders[teamA[1]]].sort(function(a, b) { return a - b; });
  var bOrders = [orders[teamB[0]], orders[teamB[1]]].sort(function(a, b) { return a - b; });

  if (aOrders[0] === 1 && aOrders[1] === 2) {
    // A队双飞
    scores[teamA[0]] = SCORE.SHUANGFEI_WIN;
    scores[teamA[1]] = SCORE.SHUANGFEI_WIN;
    scores[teamB[0]] = SCORE.SHUANGFEI_LOSE;
    scores[teamB[1]] = SCORE.SHUANGFEI_LOSE;
    return scores;
  }
  if (bOrders[0] === 1 && bOrders[1] === 2) {
    // B队双飞
    scores[teamB[0]] = SCORE.SHUANGFEI_WIN;
    scores[teamB[1]] = SCORE.SHUANGFEI_WIN;
    scores[teamA[0]] = SCORE.SHUANGFEI_LOSE;
    scores[teamA[1]] = SCORE.SHUANGFEI_LOSE;
    return scores;
  }

  // 非双飞：比得牌数
  // 2,4规则：如果某队占2名和4名，4名的牌归对手
  var teamACards = 0;
  var teamBCards = 0;

  if (aOrders[0] === 2 && aOrders[1] === 4) {
    // A队2+4，4名的牌归B队
    var fourthSeat = findSeatByOrder(players, 4);
    teamACards = getCollected(players, teamA[0]) + getCollected(players, teamA[1])
      - getCollected(players, fourthSeat);
    teamBCards = getCollected(players, teamB[0]) + getCollected(players, teamB[1])
      + getCollected(players, fourthSeat);
  } else if (bOrders[0] === 2 && bOrders[1] === 4) {
    // B队2+4，4名的牌归A队
    var fs = findSeatByOrder(players, 4);
    teamBCards = getCollected(players, teamB[0]) + getCollected(players, teamB[1])
      - getCollected(players, fs);
    teamACards = getCollected(players, teamA[0]) + getCollected(players, teamA[1])
      + getCollected(players, fs);
  } else {
    // 正常合分
    teamACards = getCollected(players, teamA[0]) + getCollected(players, teamA[1]);
    teamBCards = getCollected(players, teamB[0]) + getCollected(players, teamB[1]);
  }

  if (teamACards > teamBCards) {
    scores[teamA[0]] = SCORE.NORMAL_WIN;
    scores[teamA[1]] = SCORE.NORMAL_WIN;
    scores[teamB[0]] = SCORE.NORMAL_LOSE;
    scores[teamB[1]] = SCORE.NORMAL_LOSE;
  } else if (teamBCards > teamACards) {
    scores[teamB[0]] = SCORE.NORMAL_WIN;
    scores[teamB[1]] = SCORE.NORMAL_WIN;
    scores[teamA[0]] = SCORE.NORMAL_LOSE;
    scores[teamA[1]] = SCORE.NORMAL_LOSE;
  } else {
    // 平局：第1名队伍胜
    var first = findFirst(players);
    if (teamA.indexOf(first) >= 0) {
      scores[teamA[0]] = SCORE.NORMAL_WIN;
      scores[teamA[1]] = SCORE.NORMAL_WIN;
      scores[teamB[0]] = SCORE.NORMAL_LOSE;
      scores[teamB[1]] = SCORE.NORMAL_LOSE;
    } else {
      scores[teamB[0]] = SCORE.NORMAL_WIN;
      scores[teamB[1]] = SCORE.NORMAL_WIN;
      scores[teamA[0]] = SCORE.NORMAL_LOSE;
      scores[teamA[1]] = SCORE.NORMAL_LOSE;
    }
  }

  return scores;
}

function findFirst(players) {
  for (var i = 0; i < players.length; i++) {
    if (players[i].finishOrder === 1) return i;
  }
  return 0;
}

function findSeatByOrder(players, order) {
  for (var i = 0; i < players.length; i++) {
    if (players[i].finishOrder === order) return i;
  }
  return -1;
}

function getCollected(players, seat) {
  return players[seat].collectedCount || 0;
}

/**
 * 计算附加分（豆、四个2、滚筒）
 */
function calculateBonus(collectRecord) {
  var scores = [0, 0, 0, 0];
  if (!collectRecord) return scores;

  var seat = collectRecord.seat;
  var handType = collectRecord.handType;
  var cards = collectRecord.cards;

  if (handType === 'dou' || handType === 'DOU' || handType === 6) {
    var isFourTwo = cards && cards.length === 4 && cards.every(function(c) { return c.rank === '2'; });
    var bonus = isFourTwo ? SCORE.FOUR_TWO_BONUS : SCORE.DOU_BONUS;
    scores[seat] = bonus;
    for (var i = 0; i < 4; i++) {
      if (i !== seat) scores[i] = -(bonus / 3);
    }
  }

  if (handType === 'guntong' || handType === 'GUNTONG' || handType === 7) {
    scores[seat] = SCORE.GUNTONG_BONUS;
    for (var i = 0; i < 4; i++) {
      if (i !== seat) scores[i] = -(SCORE.GUNTONG_BONUS / 3);
    }
  }

  return scores;
}

/**
 * 计算天牌分
 */
function calculateHeavenScore(seat, type) {
  var scores = [0, 0, 0, 0];
  if (type === 'thirteen') {
    scores[seat] = SCORE.THIRTEEN_SCORE;
    for (var i = 0; i < 4; i++) {
      if (i !== seat) scores[i] = -(SCORE.THIRTEEN_SCORE / 3);
    }
  } else if (type === 'gunlong') {
    scores[seat] = SCORE.GUNLONG_SCORE;
    for (var i = 0; i < 4; i++) {
      if (i !== seat) scores[i] = -(SCORE.GUNLONG_SCORE / 3);
    }
  }
  return scores;
}

module.exports = {
  calculateGameScore: calculateGameScore,
  calculateBonus: calculateBonus,
  calculateHeavenScore: calculateHeavenScore
};
