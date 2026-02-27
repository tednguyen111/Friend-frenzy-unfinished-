const socket = io();
const myId = 'A'; // Người chơi hiện tại (Client này là A)
// --- [MỚI] BIẾN TRẠNG THÁI CHỌN MỤC TIÊU ---
let selectedSpell = null;
let selectedSpellName = null;
let dragTargets = []; // Biến lưu danh sách target cho The Drag // Lưu tên lá bài đang cầm trên tay
// --- CẤU HÌNH HÌNH ẢNH (Theo danh sách bạn cung cấp) ---
const IMAGES = {
    'Punch': 'images/The Punch.svg',
    'Hug': 'images/The Hug.svg',
    'Drink': 'images/The Drink.svg',
    'BFF': 'images/The Bro.svg',
    'The Blind': 'images/The Blind.svg',
    'The Gamble': 'images/The Gamble.svg',
    'The Copycat': 'images/The Copycat.svg',
    'The Drag': 'images/The Drag.svg',
    'The Faint': 'images/The Faint.svg',
    'The Nope': 'images/The Nope.svg',
    'The Reflection': 'images/The Reflection.svg',
    'The Stalker': 'images/The Stalker.svg',
    'The Steal': 'images/The Steal.svg'
};

// --- LẤY CÁC ELEMENT TỪ HTML ---
// --- LẤY CÁC ELEMENT TỪ HTML ---
const dom = {
    turnIndicator: document.getElementById('turn-indicator'),
    chainStack: document.getElementById('chain-stack'),
    logContent: document.getElementById('log-content'),
    myScore: document.getElementById('my-score'),
    handActions: document.getElementById('hand-actions'),
    handSpells: document.getElementById('hand-spells'),
    gameOverScreen: document.getElementById('game-over-screen'),
    winnerText: document.getElementById('winner-text'),
    btnRestart: document.getElementById('btn-restart'),
    // [MỚI] Lấy dòng thông báo hướng dẫn
    guideMessage: document.getElementById('guide-message'),
    opponents: {
        'B': document.getElementById('player-B'),
        'C': document.getElementById('player-C'),
        'D': document.getElementById('player-D')
    }
};

// --- HÀM HIỂN THỊ ĐIỂM SỐ ---
function renderScore(scoring) {
    if (!scoring) return '';
    return `
        <span title="Punch">👊${scoring.Punch}</span>
        <span title="Hug">🫂${scoring.Hug}</span>
        <span title="Drink">🥂${scoring.Drink}</span>
        <span title="BFF">💖${scoring.BFF}</span>
    `;
}

// --- HÀM TẠO THẺ BÀI ---
// --- HÀM TẠO THẺ BÀI ---
function createCardElement(name, type, index, isMine, isBlinded) {
    const el = document.createElement('div');
    el.className = `card ${type.toLowerCase()}`;

    // 1. XỬ LÝ KHI BỊ MÙ (BLIND)
    if (isMine && isBlinded) {
        el.className += ' blinded';
        el.innerHTML = `<div style="font-size:40px; display:flex; justify-content:center; align-items:center; height:100%; color:#555;">❓</div>`;
        // Vẫn cho phép đánh lụi (Blind play)
        el.onclick = () => {
            // Gửi playAction cho cả 2 loại để khớp với server
            socket.emit('playAction', { cardName: name, targetId: null });
        };
        return el;
    }

    // 2. HIỂN THỊ ẢNH
    if (IMAGES[name]) {
        el.classList.add('has-image');
        el.innerHTML = `<img src="${IMAGES[name]}" alt="${name}" class="card-img-content">`;
    } else {
        el.innerHTML = `<div class="card-header"><span>${name}</span></div><div class="card-footer">${type}</div>`;
    }

    // 3. XỬ LÝ CLICK (QUAN TRỌNG)
    if (isMine && type === 'ACTION') {
        el.onclick = () => {
            cancelTargetingMode();
            socket.emit('playAction', { cardName: name, targetId: null });
        };
    }

    if (isMine && type === 'SPELL') {
        el.onclick = () => {
            handleSpellClick(name, el);
        };
    }
    else {
        el.style.cursor = 'default';
    }

    return el;
}

// --- XỬ LÝ LOGIC CLICK SPELL (CHỌN MỤC TIÊU) ---
// --- [MỚI] XỬ LÝ KHI BẤM VÀO THẺ SPELL ---
function handleSpellClick(spellName, el) {
    // Click lại lá đang chọn → huỷ
    if (selectedSpellName === spellName) {
        cancelTargetingMode();
        return;
    }

    cancelTargetingMode();

    selectedSpellName = spellName;
    el.classList.add('selected');
    document.body.classList.add('targeting-mode');

    // Spell dùng ngay
    if (spellName === 'The Nope' || spellName === 'The Reflection') {
        socket.emit('playAction', { cardName: spellName, targetId: null });
        cancelTargetingMode();
        return;
    }

    if (dom.guideMessage) {
        dom.guideMessage.innerText = `Đang dùng ${spellName}: hãy chọn mục tiêu`;
        dom.guideMessage.classList.remove('hidden');
    }
}



// --- [MỚI] HỦY CHẾ ĐỘ CHỌN MỤC TIÊU ---
function cancelTargetingMode() {
    selectedSpellName = null;
    document.body.classList.remove('targeting-mode');

    document.querySelectorAll('.card.spell.selected')
        .forEach(el => el.classList.remove('selected'));

    if (dom.guideMessage) dom.guideMessage.classList.add('hidden');
}

// --- [MỚI] GÁN SỰ KIỆN CLICK CHO CÁC ĐỐI THỦ (B, C, D) ---
// Đoạn này sẽ chạy 1 lần khi load trang để lắng nghe click
Object.keys(dom.opponents).forEach(playerId => {
    const opponentDiv = dom.opponents[playerId];
    if (opponentDiv) {
        const avatar = opponentDiv.querySelector('.avatar');

        // Logic visual: Thêm/Gỡ class trên avatar
        if (avatar) {
            if (selectedSpellName) {
                avatar.classList.add('targetable');
            } else {
                avatar.classList.remove('targetable');
            }
        }

        // Logic interaction
        opponentDiv.onclick = () => {
            if (selectedSpellName) {
                if (selectedSpellName === 'The Drag') {
                    // Logic riêng cho The Drag: Cần 2 target
                    dragTargets.push(playerId);

                    if (dragTargets.length === 2) {
                        socket.emit('playAction', {
                            cardName: selectedSpellName,
                            targets: dragTargets
                        });

                        dragTargets = []; // Reset list
                        cancelTargetingMode();
                    }
                } else {
                    // Logic cũ cho các spell thường (1 target)
                    socket.emit('playAction', {
                        cardName: selectedSpellName,
                        targetId: playerId
                    });

                    cancelTargetingMode();
                }

                // Dọn dẹp class visual nếu targeting mode đã tắt
                if (!selectedSpellName && avatar) {
                    avatar.classList.remove('targetable');
                }
            }
        }
    };
});

// --- LẮNG NGHE TRẠNG THÁI GAME TỪ SERVER ---
socket.on('gameState', (state) => {
    const me = state.players.find(p => p.id === myId);
    const currentTurn = state.turnOrder[state.currentTurnIndex];
    const amIBlinded = state.effects.blinded && state.effects.blinded[myId];

    // 1. CẬP NHẬT THÔNG TIN ĐỐI THỦ
    ['B', 'C', 'D'].forEach(pid => {
        const p = state.players.find(pl => pl.id === pid);
        const oppEl = dom.opponents[pid];

        if (p && oppEl) {
            const avatar = oppEl.querySelector('.avatar');
            const stats = oppEl.querySelector('.stats');

            // Active Turn
            if (currentTurn === pid) avatar.classList.add('active');
            else avatar.classList.remove('active');

            // Faint Effect
            if (state.effects.fainted.includes(pid)) {
                avatar.style.filter = "grayscale(100%) blur(3px)";
                avatar.style.border = "3px solid #555";
            } else {
                avatar.style.filter = "none";
                avatar.style.border = "3px solid transparent";
            }

            // Blind Effect
            const blindBadgeId = `blind-badge-${pid}`;
            let blindBadge = document.getElementById(blindBadgeId);

            if (state.effects.blinded[pid]) {
                avatar.style.opacity = "0.4";

                // Thêm icon ❓ (element nhỏ)
                if (!blindBadge) {
                    blindBadge = document.createElement('div');
                    blindBadge.id = blindBadgeId;
                    blindBadge.textContent = '❓';
                    Object.assign(blindBadge.style, {
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: 'white',
                        textShadow: '0 0 4px black',
                        zIndex: '10',
                        pointerEvents: 'none'
                    });

                    // Gắn vào parent của avatar để tránh lỗi nếu avatar là thẻ img
                    if (avatar.parentNode) {
                        avatar.parentNode.style.position = 'relative';
                        avatar.parentNode.appendChild(blindBadge);
                    }
                }
            } else {
                avatar.style.opacity = "1";
                if (blindBadge) blindBadge.remove();
            }

            // Winner Effect
            if (state.roundWinnerId === pid) avatar.classList.add('winner-glow');
            else avatar.classList.remove('winner-glow');

            // Kiểm tra xem mình có đang soi bài đối thủ này không
            if (state.effects.stalking[myId] === pid) {
                // STALKING MODE: Hiển thị chi tiết bài
                const actionsHtml = p.hand.action.map((c, i) =>
                    `<div style="background:#ff6b6b; color:white; padding:2px 4px; border-radius:3px; margin:1px; font-size:9px; border:1px solid #333; animation: popIn 0.3s ease-out backwards; animation-delay:${i * 0.05}s;">${c}</div>`
                ).join('');

                const spellsHtml = p.hand.spell.map((c, i) =>
                    `<div style="background:#4ecdc4; color:black; padding:2px 4px; border-radius:3px; margin:1px; font-size:9px; border:1px solid #333; animation: popIn 0.3s ease-out backwards; animation-delay:${(i * 0.05) + 0.1}s;">${c}</div>`
                ).join('');

                stats.innerHTML = `
                    <style>@keyframes popIn { 0% { opacity:0; transform:scale(0.5); } 100% { opacity:1; transform:scale(1); } }</style>
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:center; width:100%;">
                        <div style="font-size:10px; color:#ffeaa7; font-weight:bold;">👁️ REVEALED</div>
                        
                        <div style="display:flex; flex-wrap:wrap; justify-content:center; width:100%;">
                            ${actionsHtml || '<span style="font-size:9px; opacity:0.5;">No Actions</span>'}
                        </div>
                        
                        <div style="display:flex; flex-wrap:wrap; justify-content:center; width:100%;">
                            ${spellsHtml || '<span style="font-size:9px; opacity:0.5;">No Spells</span>'}
                        </div>

                        <div class="mini-score" style="font-size: 0.85em; opacity: 0.8; border-top:1px solid #444; width:100%; text-align:center; padding-top:2px;">
                            ${renderScore(p.scoring)}
                        </div>
                    </div>
                `;
            } else {
                // NORMAL MODE: Chỉ hiển thị số lượng
                stats.innerHTML = `
                    <div style="margin-bottom: 5px;">
                        <span style="color:#ff6b6b">Cards: ${p.hand.action.length}</span> | 
                        <span style="color:#4ecdc4">Spells: ${p.hand.spell.length}</span>
                    </div>
                    <div class="mini-score" style="font-size: 0.85em; opacity: 0.8;">
                        ${renderScore(p.scoring)}
                    </div>
                `;
            }
        }
    });

    // 2. THANH TRẠNG THÁI (INFO BAR)
    let statusText = "";
    let statusColor = "#333";

    if (state.pendingSpell) {
        statusText = `✨ Casting: ${state.pendingSpell.spellName} (Waiting...)`;
        statusColor = "#d35400";
    } else if (state.isResolvingChain) {
        statusText = "⚔️ Resolving Battle...";
        statusColor = "#c0392b";
    } else {
        if (currentTurn === myId) {
            statusText = "YOUR TURN";
            dom.turnIndicator.classList.add('your-turn');
        } else {
            statusText = `PLAYER ${currentTurn}'S TURN`;
            dom.turnIndicator.classList.remove('your-turn');
        }

        if (state.effects.reflection) {
            statusText += " (🪞 REFLECTION ACTIVE)";
            statusColor = "#8e44ad";
        }
    }

    dom.turnIndicator.innerText = statusText;
    dom.turnIndicator.style.color = statusColor;

// 3. KHU VỰC CHAIN
    dom.chainStack.innerHTML = '';
    
    // Kiểm tra: Nếu Chain rỗng VÀ không có Spell đang chờ -> Hiện Placeholder
    if (state.chain.length === 0 && !state.pendingSpell) {
        dom.chainStack.innerHTML = '<div class="empty-placeholder">CHAIN ZONE</div>';
    } else {
        // A. RENDER CÁC LÁ ACTION ĐANG CÓ TRONG CHAIN
        state.chain.forEach((entry, i) => {
            // Tạo thẻ bài
            const cardEl = createCardElement(entry.action, 'ACTION', i, false, false);
            const isLastCard = (i === state.chain.length - 1);

            // Config vị trí: Absolute để chồng lên nhau (stack)
            cardEl.style.position = 'absolute';
            cardEl.style.zIndex = i;

            // Tính toán Offsets (Xen kẽ trái phải, nhích lên trên)
            const spreadX = 10 + Math.random() * 5;
            const offsetX = (i % 2 === 0) ? -spreadX : spreadX;
            const offsetY = i * -6;

            // Rotate: Xoay nhẹ, trừ card cuối cùng
            const rotateDeg = (Math.random() * 12) - 6;
            const rotate = isLastCard ? 0 : rotateDeg;

            // Apply Transform
            cardEl.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`;

            // Animation cho card mới nhất
            if (isLastCard) {
                cardEl.classList.add('just-played');
            }

            // Thêm huy hiệu người chơi (Badge)
            const badge = document.createElement('div');
            badge.className = 'owner-badge';
            badge.innerText = entry.playerId;
            cardEl.appendChild(badge);

            dom.chainStack.appendChild(cardEl);
        });

        // B. RENDER SPELL CARD (Visual Only - Pending State)
        // Phần này hiển thị lá Spell đang chờ NOPE, nằm đè lên trên cùng
        if (state.pendingSpell) {
            const spellEl = createCardElement(state.pendingSpell.spellName, 'SPELL', state.chain.length, false, false);
            
            spellEl.style.position = 'absolute';
            spellEl.style.zIndex = 1000; // Đảm bảo cao hơn tất cả Action cards
            spellEl.classList.add('just-played');

            const spellBadge = document.createElement('div');
            spellBadge.className = 'owner-badge';
            spellBadge.innerText = state.pendingSpell.casterId;
            spellEl.appendChild(spellBadge);

            dom.chainStack.appendChild(spellEl);
        }
    }


    // 4. KHU VỰC BÀI CỦA TÔI (HAND)

    // -- Action Cards --
    dom.handActions.innerHTML = '';
    me.hand.action.forEach((card, i) => {
        const el = createCardElement(card, 'ACTION', i, true, amIBlinded);

        el.style.setProperty('--i', i);
        el.style.setProperty('--total', me.hand.action.length);

        if (currentTurn !== myId) el.style.opacity = '0.4';
        dom.handActions.appendChild(el);
    });

    // -- Spell Cards --
    dom.handSpells.innerHTML = '';
me.hand.spell.forEach((card, i) => {
    const el = createCardElement(card, 'SPELL', i, true, amIBlinded);

    el.style.setProperty('--i', i);
    el.style.setProperty('--total', me.hand.spell.length);

    const isAnytimeSpell = ['The Nope', 'The Blind'].includes(card);
    const isMyTurn = (currentTurn === myId);

    if (isAnytimeSpell || isMyTurn) {
        el.style.opacity = '1';
        el.style.cursor = 'pointer';
    } else {
        el.style.opacity = '0.4';
        el.style.cursor = 'not-allowed';
        el.onclick = null;
    }

    dom.handSpells.appendChild(el);
});


    // 5. CẬP NHẬT HUD CÁ NHÂN
    dom.myScore.innerHTML = renderScore(me.scoring);

    const myAvatar = document.querySelector('.my-avatar') || document.getElementById('player-A');
    if (myAvatar) {
        if (state.roundWinnerId === myId) myAvatar.classList.add('winner-glow');
        else myAvatar.classList.remove('winner-glow');
    }

    // 6. LOGS
    dom.logContent.innerHTML = state.logs.slice().reverse().map(l => `<div>> ${l}</div>`).join('');

    // 7. GAME OVER
    if (state.gameOver) {
        dom.gameOverScreen.classList.remove('hidden');
        dom.winnerText.innerHTML = `🏆 WINNER: PLAYER ${state.winner} 🏆`;
    } else {
        dom.gameOverScreen.classList.add('hidden');
    }
});

// --- NÚT KHỞI ĐỘNG LẠI ---
dom.btnRestart.onclick = () => {
    socket.emit('restart');
};