const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONSTANTS ---
const ACTION_TYPES = ['Punch', 'Hug', 'Drink', 'BFF'];
// Danh sách Spell chuẩn theo yêu cầu của bạn
const SPELL_TYPES = [
    'The Blind', 'The Gamble', 'The Copycat', 'The Drag',
    'The Faint', 'The Nope', 'The Reflection', 'The Stalker', 'The Steal'
];
const PLAYERS = ['A', 'B', 'C', 'D'];

let gameState = {
    players: [],
    turnOrder: ['A', 'B', 'C', 'D'],
    currentTurnIndex: 0,
    chain: [],
    logs: [],
    gameOver: false,
    winner: null,

    // State cho Action Phase
    isResolvingChain: false,
    roundWinnerId: null,

    // State cho Spell Phase
    pendingSpell: null, // { spellName, casterId, targetId, timestamp }
    lastSuccessfulSpell: null, // { spellName, casterId, targetId }

    // Decks
    actionDeck: [
        ...Array(13).fill('Punch'),
        ...Array(13).fill('Hug'),
        ...Array(13).fill('Drink'),
        'BFF'
    ],
    spellDeck: SPELL_TYPES.flatMap(spell => Array(3).fill(spell)),

    // Các hiệu ứng kéo dài (Persistent Effects)
    effects: {
        reflection: false,   // Đảo ngược sức mạnh
        blinded: {},         // { 'B': 2 } -> Player B bị mù 2 turn
        fainted: [],         // ['C'] -> Player C bị choáng (không được tham gia Chain)
        stalking: {},        // { 'A': 'B' } -> A đang soi bài B
        pendingDrags: []
    }
};

// --- INIT GAME ---
function initGame() {
    // Khởi tạo và trộn Action Deck
    gameState.actionDeck = shuffleDeck([
        ...Array(13).fill('Punch'),
        ...Array(13).fill('Hug'),
        ...Array(13).fill('Drink'),
        'BFF'
    ]);

    // Khởi tạo và trộn Spell Deck
    gameState.spellDeck = shuffleDeck(SPELL_TYPES.flatMap(spell => Array(3).fill(spell)));

    // Tạo player và chia bài từ Deck
    gameState.players = PLAYERS.map(id => {
        const p = {
            id,
            hand: { action: [], spell: [] },
            scoring: { Punch: 0, Hug: 0, Drink: 0, BFF: 0 }
        };

        // Rút 3 lá Action
        for (let i = 0; i < 3; i++) {
            if (gameState.actionDeck.length > 0) {
                p.hand.action.push(gameState.actionDeck.pop());
            }
        }

        // Rút 3 lá Spell
        for (let i = 0; i < 3; i++) {
            if (gameState.spellDeck.length > 0) {
                p.hand.spell.push(gameState.spellDeck.pop());
            }
        }

        return p;
    });

    // Reset state
    gameState.chain = [];
    gameState.logs = ["📢 Game Start!"];
    gameState.currentTurnIndex = 0;
    gameState.gameOver = false;
    gameState.winner = null;
    gameState.isResolvingChain = false;
    gameState.roundWinnerId = null;
    gameState.pendingSpell = null;
    gameState.lastSuccessfulSpell = null;
    gameState.effects = {
        reflection: false,
        blinded: {},
        fainted: [],
        stalking: {},
        pendingDrags: []
    };
}

// --- HELPER FUNCTIONS ---
function getRandomAction() {
    return Math.random() < 0.05 ? 'BFF' : ACTION_TYPES[Math.floor(Math.random() * 3)];
}
function getRandomSpell() {
    return SPELL_TYPES[Math.floor(Math.random() * SPELL_TYPES.length)];
}
function refillActionHand(playerId) {
    const p = gameState.players.find(x => x.id === playerId);
    while (p && p.hand.action.length < 3 && gameState.actionDeck.length > 0) {
        p.hand.action.push(gameState.actionDeck.pop());
    }
}
function rewardSpell(playerId) {
    const p = gameState.players.find(x => x.id === playerId);
    if (p && p.hand.spell.length < 3 && gameState.spellDeck.length > 0) {
        p.hand.spell.push(gameState.spellDeck.pop());
    }
}
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}


// --- LOGIC CHIẾN ĐẤU (CÓ REFLECTION) ---
function resolveBattle(chainCard, newCard) {
    // 1. Nếu giống nhau -> Tiếp tục chuỗi
    if (newCard === chainCard) return 'CONTINUE';

    // 2. Logic thắng thua cơ bản (Normal: Key thắng Value)
    // Punch > Drink > Hug > Punch
    const normalWins = {
        'Punch': 'Drink',
        'Drink': 'Hug',
        'Hug': 'Punch'
    };

    let isBreakerWin = false;

    if (!gameState.effects.reflection) {
        // Normal Mode: Breaker thắng nếu newCard ăn được chainCard
        // Ví dụ: newCard (Punch) ăn chainCard (Drink)
        if (normalWins[newCard] === chainCard) {
            isBreakerWin = true;
        }
    } else {
        // Reflection Mode: Đảo ngược sức mạnh
        // Nếu chainCard vốn ăn được newCard (theo logic Normal), thì nay newCard sẽ thắng lại.
        // Ví dụ: chainCard (Punch) vốn ăn được newCard (Drink) -> Trong Reflection, Drink sẽ thắng Punch.
        if (normalWins[chainCard] === newCard) {
            isBreakerWin = true;
        }
    }

    // 3. Trả về kết quả thắng/thua của người phá chuỗi (Breaker)
    // BFF sẽ rơi vào trường hợp Lose nếu không được định nghĩa trong normalWins (tức là yếu thế hơn các card cơ bản)
    return isBreakerWin ? 'BREAKER_WIN' : 'BREAKER_LOSE';
}

// --- XỬ LÝ SPELL (PHỨC TẠP) ---
function handleUseSpell(playerId, spellIndex, targets) {
    if (gameState.gameOver) return;

    // Nếu đang có Spell chờ (Pending), chỉ cho phép đánh "The Nope"
    if (gameState.pendingSpell && gameState.players.find(p => p.id === playerId).hand.spell[spellIndex] !== 'The Nope') {
        return; // Bị chặn vì đang có người khác niệm chú
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.hand.spell[spellIndex]) return;

    const spellName = player.hand.spell[spellIndex];

    // Check Turn Condition (Trừ Nope và Blind, còn lại phải đúng lượt)
    const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === playerId;
    if (!['The Nope', 'The Blind'].includes(spellName) && !isMyTurn) {
        return;
    }

    // 1. Trừ bài ngay lập tức
    player.hand.spell.splice(spellIndex, 1);

    // 2. Xử lý logic đặc biệt cho "The Nope"
    if (spellName === 'The Nope') {
        if (gameState.pendingSpell) {
            gameState.logs.push(`🚫 ${playerId} used NOPE! Cancelled ${gameState.pendingSpell.spellName}!`);
            gameState.pendingSpell = null; // Hủy spell đang chờ
            io.emit('gameState', sanitizeState());
            return;
        } else {
            // Dùng Nope mà không có gì để chặn -> Phí bài
            gameState.logs.push(`🚫 ${playerId} used NOPE on nothing... Awkward.`);
            io.emit('gameState', sanitizeState());
            return;
        }
    }

    // 3. Với các Spell khác -> Đưa vào trạng thái Pending (Chờ 3s để người khác Nope)
    // Cập nhật: Lưu targets (array) thay vì targetId để hỗ trợ The Drag và The Blind
    gameState.pendingSpell = {
        spellName,
        casterId: playerId,
        targets: targets || [],
        timestamp: Date.now()
    };

    gameState.logs.push(`✨ ${playerId} is casting ${spellName}... (3s to Nope)`);
    io.emit('gameState', sanitizeState());

    // 4. Timeout để kích hoạt hiệu ứng thực
    setTimeout(() => {
        // Kiểm tra xem spell còn tồn tại không (hay đã bị Nope rồi)
        if (gameState.pendingSpell && gameState.pendingSpell.timestamp === gameState.pendingSpell.timestamp) {
            executeSpellEffect(gameState.pendingSpell);
            gameState.pendingSpell = null; // Clear
            io.emit('gameState', sanitizeState());
        }
    }, 2000);
}

// HÀM THỰC THI HIỆU ỨNG SPELL (SAU KHI QUA ĐƯỢC 3 GIÂY)
function executeSpellEffect({ spellName, casterId, targetId }) {
    const caster = gameState.players.find(p => p.id === casterId);
    const target = gameState.players.find(p => p.id === targetId);

    gameState.logs.push(`⚡ SPELL CAST: ${spellName} (Target: ${targetId || 'None'})`);

    switch (spellName) {
        case 'The Blind':
            if (target) {
                // Không gắn theo lượt, chỉ tồn tại cho chain hiện tại.
                // Reset tại endChain().
                gameState.effects.blinded[targetId] = true;
            }
            break;

        case 'The Gamble': {
            const victim = target || caster; // cho phép dùng lên người khác hoặc bản thân

            // 1. Đếm tổng số lá trên tay (action + spell)
            const totalCards = victim.hand.action.length + victim.hand.spell.length;

            // 2. Xoá toàn bộ bài trên tay
            victim.hand.action = [];
            victim.hand.spell = [];

            // 3. Rút lại ĐÚNG số lượng lá bằng số đã xoá (Random Action)
            const actions = ['Punch', 'Hug', 'Drink'];
            for (let i = 0; i < totalCards; i++) {
                const randomAction = actions[Math.floor(Math.random() * actions.length)];
                victim.hand.action.push(randomAction);
            }

            break;
        }

        case 'The Copycat':
            // Copy spell gần nhất trong Log? (Phức tạp, tạm thời cho random 1 spell mới)
            gameState.logs.push(`🐱 Copycat logic is complex, giving 1 random spell instead.`);
            rewardSpell(casterId);
            break;

        case 'The Drag': {
            // Sửa logic: Check targets array thay vì target đơn lẻ
            if (!targets || targets.length < 2) break;

            const a = targets[0];
            const b = targets[1];

            const chainPlayers = gameState.chain.map(e => e.playerId);
            const someonePlayedInChain =
                chainPlayers.includes(a) || chainPlayers.includes(b);

            if (someonePlayedInChain) {
                // hoãn drag
                gameState.effects.pendingDrags.push({ a, b });
            } else {
                // đổi ngay
                const idxA = gameState.turnOrder.indexOf(a);
                const idxB = gameState.turnOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) {
                    [gameState.turnOrder[idxA], gameState.turnOrder[idxB]] =
                        [gameState.turnOrder[idxB], gameState.turnOrder[idxA]];
                }
            }
            break;
        }

        case 'The Faint':
            if (target) gameState.effects.fainted.push(targetId);
            break;

        case 'The Reflection':
            gameState.effects.reflection = !gameState.effects.reflection;
            gameState.logs.push(`🪞 Reflection is now ${gameState.effects.reflection ? 'ON' : 'OFF'}`);
            break;

        case 'The Stalker':
            if (target) gameState.effects.stalking[casterId] = targetId;
            break;

        case 'The Steal':
            if (!target) break;

            // tìm loại điểm cao nhất của target
            let maxType = null;
            let maxVal = 0;

            ['Punch', 'Hug', 'Drink', 'BFF'].forEach(type => {
                if (target.scoring[type] > maxVal) {
                    maxVal = target.scoring[type];
                    maxType = type;
                }
            });
            if (maxType && maxVal > 0) {
                target.scoring[maxType]--;
                caster.scoring[maxType]++;
            }
            break;
    }

    // Ghi lại spell thành công (trừ The Copycat)
    if (spellName !== 'The Copycat') {
        gameState.lastSuccessfulSpell = { spellName, casterId, targetId };
    }
}

// --- XỬ LÝ ACTION (BÀI ĐÁNH) ---
function handlePlayAction(playerId, actionIndex) {
    if (gameState.gameOver || gameState.isResolvingChain || gameState.pendingSpell) return;

    // Check Faint (Bị choáng thì không được đánh)
    if (gameState.effects.fainted.includes(playerId)) {
        // Tự động skip turn nếu bị faint
        advanceTurn();
        // Remove faint effect sau khi skip
        gameState.effects.fainted = gameState.effects.fainted.filter(id => id !== playerId);
        io.emit('gameState', sanitizeState());
        return;
    }

    const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
    if (playerId !== currentPlayerId) return;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.hand.action[actionIndex]) return;

    const card = player.hand.action.splice(actionIndex, 1)[0];

    if (gameState.chain.length === 0) {
        // Không cho phép dùng BFF để mở chain
        if (card === 'BFF') {
            // Trả lại bài vào tay (Undo việc trừ bài trước đó)
            player.hand.action.splice(actionIndex, 0, card);
            return; // Dừng hàm, không advanceTurn, không log chain
        }

        gameState.chain.push({ action: card, playerId });
        gameState.logs.push(`🔵 ${playerId} starts: ${card}`);
        advanceTurn();
        io.emit('gameState', sanitizeState());
    } else {
        const lastEntry = gameState.chain[gameState.chain.length - 1];
        const result = resolveBattle(lastEntry.action, card);
        gameState.chain.push({ action: card, playerId }); // Luôn hiện bài mới

        if (result === 'CONTINUE') {
            gameState.logs.push(`🔄 ${playerId} chains: ${card}`);
            advanceTurn();
            io.emit('gameState', sanitizeState());
        } else {
            // RESOLVING PHASE
            gameState.isResolvingChain = true;
            gameState.logs.push(`⚔️ COMBAT: ${lastEntry.action} vs ${card} (${result})`);
            io.emit('gameState', sanitizeState());

            setTimeout(() => {
                finalizeRound(playerId, card, result);
            }, 2000);
        }
    }
}

function endChain() {
    // Reset hiệu ứng
    gameState.effects.reflection = false;
    gameState.effects.stalking = {};
    gameState.effects.fainted = [];
    gameState.effects.blinded = {};

    // Thực thi các Drag bị hoãn
    if (gameState.effects.pendingDrags) {
        gameState.effects.pendingDrags.forEach(({ a, b }) => {
            const idxA = gameState.turnOrder.indexOf(a);
            const idxB = gameState.turnOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) {
                [gameState.turnOrder[idxA], gameState.turnOrder[idxB]] =
                    [gameState.turnOrder[idxB], gameState.turnOrder[idxA]];
            }
        });
    }
    gameState.effects.pendingDrags = [];

    // Clear chain
    gameState.chain = [];
    gameState.isResolvingChain = false;
}

function finalizeRound(breakerId, breakerCard, result) {
    // Xác định người tham gia trước khi clear chain
    const participants = new Set();
    gameState.chain.forEach(entry => participants.add(entry.playerId));

    // Xác định thắng thua và cộng điểm
    let roundWinnerId = null;
    if (result === 'BFF_WIN' || result === 'BREAKER_WIN') {
        roundWinnerId = breakerId;
        addScore(breakerId, result === 'BFF_WIN' ? 'BFF' : breakerCard);
    } else {
        roundWinnerId = gameState.chain[0].playerId;
        gameState.chain.forEach(entry => {
            if (entry.playerId !== breakerId) addScore(entry.playerId, entry.action);
        });
    }

    gameState.roundWinnerId = roundWinnerId;

    // Refill bài cho người chơi
    participants.forEach(pid => { refillActionHand(pid); rewardSpell(pid); });

    // Gọi hàm dọn dẹp chain và effect
    endChain();

    // Người thắng đi trước (người Breaker)
    const nextStartIdx = gameState.turnOrder.indexOf(breakerId);
    gameState.currentTurnIndex = nextStartIdx !== -1 ? nextStartIdx : 0;

    checkWinCondition();
    io.emit('gameState', sanitizeState());
    checkBotTurn();
    setTimeout(() => { gameState.roundWinnerId = null; io.emit('gameState', sanitizeState()); }, 1500);
}

// --- HELPER: SANITIZE STATE (BẢO MẬT & BLIND) ---
// Hàm này lọc dữ liệu trước khi gửi xuống Client
function sanitizeState() {
    // Clone deep để không sửa state gốc
    const publicState = JSON.parse(JSON.stringify(gameState));

    // Xử lý Blind: Nếu ai bị Blind, ẩn bài của họ (với chính họ)
    // Nhưng Socket.io emit broadcast, nên ta phải xử lý khéo.
    // Cách đơn giản nhất: Gửi toàn bộ, Client tự che (không bảo mật lắm nhưng nhanh cho Prototype).
    // Cách bảo mật hơn: Ở đây mình giữ nguyên, Client sẽ lo việc hiển thị dấu "?"

    return publicState;
}

function addScore(playerId, cardType) {
    const p = gameState.players.find(pl => pl.id === playerId);
    if (p) p.scoring[cardType] = (p.scoring[cardType] || 0) + 1;
}

function advanceTurn() {
    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
}

function checkWinCondition() {
    const winner = gameState.players.find(p => {
        const s = p.scoring;
        return (s.Punch >= 5 || s.Hug >= 5 || s.Drink >= 5) || (s.BFF >= 1 && s.Punch >= 1 && s.Hug >= 1 && s.Drink >= 1);
    });
    if (winner) {
        gameState.gameOver = true;
        gameState.winner = winner.id;
    }
}

// --- LOGIC XỬ LÝ CHUNG (Cho cả Người và Bot) ---


// --- LOGIC BOT TỰ ĐỘNG ---
function checkBotTurn() {
    // Nếu game đã kết thúc thì thôi
    if (gameState.gameOver) return;

    const currentId = gameState.turnOrder[gameState.currentTurnIndex];

    // Nếu lượt hiện tại KHÔNG phải là A (Người thật) -> Thì là Bot (B, C, D)
    if (currentId !== 'A') {
        console.log(`🤖 Bot ${currentId} đang suy nghĩ...`);

        // Đợi 1.5 giây cho giống thật rồi đánh
        setTimeout(() => {
            if (gameState.gameOver || gameState.isResolvingChain) return;

            const bot = gameState.players.find(p => p.id === currentId);
            if (!bot) return;

            // Nếu bot bị faint → skip
            if (gameState.effects.fainted.includes(currentId)) {
                advanceTurn();
                return;
            }

            // Nếu không có Action → skip
            if (bot.hand.action.length === 0) {
                advanceTurn();
                return;
            }

            // Đánh lá Action đầu tiên
            handlePlayAction(currentId, 0);

        }, 2000); // giảm delay cho bot phản hồi nhanh
    }
}

// Sửa lại hàm advanceTurn để kích hoạt Bot
const originalAdvanceTurn = advanceTurn; // Lưu hàm cũ (hoặc viết lại logic đơn giản)
advanceTurn = function () {
    // Logic chuyển lượt cũ
    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;

    // Sau khi chuyển lượt, kiểm tra xem có phải lượt Bot không
    checkBotTurn();
};

// --- SERVER LISTENING ---
initGame();

io.on('connection', (socket) => {
    // Gửi state ban đầu
    socket.emit('gameState', sanitizeState());

    // Nếu server vừa khởi động lại mà đang là lượt Bot thì kích hoạt Bot chạy
    checkBotTurn();

    // Xử lý khi NGƯỜI CHƠI (A) đánh bài
    socket.on('playAction', (data) => {
        const { cardName, targetId } = data;

        // Kiểm tra đúng lượt người chơi 'A'
        const currentId = gameState.turnOrder[gameState.currentTurnIndex];

        if (currentId === 'A') {
            const player = gameState.players.find(p => p.id === 'A');
            if (!player) return;

            // Xử lý tách bạch: SPELL
            const spellIndex = player.hand.spell.indexOf(cardName);
            if (spellIndex !== -1) {
                handleUseSpell('A', spellIndex, targetId);
                return; // Spell thực thi xong thì return ngay, không chạy xuống Action, không end turn
            }

            // Xử lý tách bạch: ACTION
            const actionIndex = player.hand.action.indexOf(cardName);
            if (actionIndex !== -1) {
                handlePlayAction('A', actionIndex);
            }
        }
    });

    socket.on('restart', () => {
        initGame();
        io.emit('gameState', sanitizeState());
    });
});

server.listen(3000, () => console.log(`✅ Server running on 3000`));