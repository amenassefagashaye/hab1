// Game State
const gameState = {
    playerId: null,
    playerName: 'Player',
    boardId: null,
    bingoBoard: [],
    markedNumbers: new Set(),
    gameActive: false,
    calledNumbers: [],
    playersOnline: 0,
    connectionStatus: 'disconnected',
    autoMarkEnabled: false
};

// WebSocket connection
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Initialize the game
function initGame() {
    generateBoardSelect();
    showPlayerSetupModal();
    connectWebSocket();
    setupEventListeners();
}

// Show player setup modal
function showPlayerSetupModal() {
    document.getElementById('playerSetupModal').style.display = 'flex';
}

// Join game
function joinGame() {
    const nameInput = document.getElementById('inputPlayerName');
    const boardSelect = document.getElementById('inputBoardNumber');
    
    if (!nameInput.value.trim()) {
        showToast('እባክዎ ስምዎን ያስገቡ', 'warning');
        return;
    }
    
    gameState.playerName = nameInput.value.trim();
    gameState.boardId = boardSelect.value || Math.floor(Math.random() * 100) + 1;
    
    document.getElementById('playerName').textContent = gameState.playerName;
    document.getElementById('playerSetupModal').style.display = 'none';
    
    // Send join message to server
    sendWebSocketMessage({
        type: 'player_join',
        playerId: gameState.playerId,
        playerName: gameState.playerName,
        boardId: gameState.boardId
    });
    
    generateBingoBoard();
}

// Generate board number select options
function generateBoardSelect() {
    const select = document.getElementById('inputBoardNumber');
    for (let i = 1; i <= 100; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `ቦርድ ${i}`;
        select.appendChild(option);
    }
}

// Generate Bingo board
function generateBingoBoard() {
    const board = document.getElementById('bingoBoard');
    board.innerHTML = '';
    
    // Generate 5x5 Bingo board with numbers 1-75
    const columnRanges = [
        { letter: 'B', range: [1, 15] },
        { letter: 'I', range: [16, 30] },
        { letter: 'N', range: [31, 45] },
        { letter: 'G', range: [46, 60] },
        { letter: 'O', range: [61, 75] }
    ];
    
    gameState.bingoBoard = [];
    
    for (let col = 0; col < 5; col++) {
        const columnNumbers = [];
        const range = columnRanges[col].range;
        
        // Generate 5 unique numbers for this column
        const numbers = new Set();
        while (numbers.size < 5) {
            const num = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
            numbers.add(num);
        }
        
        const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);
        
        for (let row = 0; row < 5; row++) {
            const cellNum = sortedNumbers[row];
            columnNumbers.push(cellNum);
            
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.number = cellNum;
            cell.dataset.letter = columnRanges[col].letter;
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Center cell is free
            if (row === 2 && col === 2) {
                cell.className = 'board-cell free';
                cell.innerHTML = '<div class="cell-number">FREE</div>';
                cell.onclick = null;
            } else {
                cell.innerHTML = `
                    <div class="cell-letter">${columnRanges[col].letter}</div>
                    <div class="cell-number">${cellNum}</div>
                `;
                cell.onclick = () => toggleNumber(cellNum, cell);
            }
            
            board.appendChild(cell);
        }
        
        gameState.bingoBoard.push(columnNumbers);
    }
    
    // Auto-mark free space
    setTimeout(() => {
        const freeCell = document.querySelector('.board-cell.free');
        if (freeCell) {
            freeCell.classList.add('marked');
        }
    }, 100);
}

// Toggle number marking
function toggleNumber(number, cell) {
    if (!gameState.gameActive) {
        showToast('ጨዋታ አልጀመረም', 'warning');
        return;
    }
    
    if (cell.classList.contains('marked')) {
        cell.classList.remove('marked');
        gameState.markedNumbers.delete(number);
    } else {
        cell.classList.add('marked');
        gameState.markedNumbers.add(number);
        
        // Check for winning pattern
        checkForWin();
    }
}

// Check for winning patterns
function checkForWin() {
    const patterns = checkWinningPatterns();
    
    if (patterns.length > 0) {
        const bingoBtn = document.getElementById('bingoBtn');
        bingoBtn.disabled = false;
        bingoBtn.innerHTML = `
            <i class="fas fa-trophy"></i>
            <span class="amharic-text">ቢንጎ! (${patterns.length} ንድፍ${patterns.length > 1 ? 'ዎች' : ''})</span>
        `;
        
        showToast(`የማሸነፍ ንድፍ ተገኝቷል! (${patterns.join(', ')})`, 'success');
    } else {
        document.getElementById('bingoBtn').disabled = true;
    }
}

// Check all winning patterns
function checkWinningPatterns() {
    const patterns = [];
    
    // Check rows
    for (let row = 0; row < 5; row++) {
        let rowComplete = true;
        for (let col = 0; col < 5; col++) {
            const cellNum = gameState.bingoBoard[col][row];
            if (row === 2 && col === 2) continue; // Free space
            if (!gameState.markedNumbers.has(cellNum)) {
                rowComplete = false;
                break;
            }
        }
        if (rowComplete) patterns.push('ረድፍ ' + (row + 1));
    }
    
    // Check columns
    for (let col = 0; col < 5; col++) {
        let colComplete = true;
        for (let row = 0; row < 5; row++) {
            const cellNum = gameState.bingoBoard[col][row];
            if (row === 2 && col === 2) continue; // Free space
            if (!gameState.markedNumbers.has(cellNum)) {
                colComplete = false;
                break;
            }
        }
        if (colComplete) patterns.push('አምድ ' + String.fromCharCode(65 + col));
    }
    
    // Check diagonals
    let diag1Complete = true;
    let diag2Complete = true;
    
    for (let i = 0; i < 5; i++) {
        // Top-left to bottom-right
        const cell1 = gameState.bingoBoard[i][i];
        if (i !== 2 && !gameState.markedNumbers.has(cell1)) {
            diag1Complete = false;
        }
        
        // Top-right to bottom-left
        const cell2 = gameState.bingoBoard[4 - i][i];
        if (i !== 2 && !gameState.markedNumbers.has(cell2)) {
            diag2Complete = false;
        }
    }
    
    if (diag1Complete) patterns.push('ዲያግናል 1');
    if (diag2Complete) patterns.push('ዲያግናል 2');
    
    // Check four corners
    const corners = [
        gameState.bingoBoard[0][0], // Top-left
        gameState.bingoBoard[0][4], // Top-right
        gameState.bingoBoard[4][0], // Bottom-left
        gameState.bingoBoard[4][4]  // Bottom-right
    ];
    
    if (corners.every(corner => gameState.markedNumbers.has(corner))) {
        patterns.push('አራት ማእዘኖች');
    }
    
    // Check full house (all numbers)
    const totalCells = 25;
    const freeSpace = 1;
    const markedCount = gameState.markedNumbers.size + 1; // +1 for free space
    
    if (markedCount >= totalCells) {
        patterns.push('ሙሉ ቤት');
    }
    
    return patterns;
}

// Claim Bingo
function claimBingo() {
    if (!gameState.gameActive) {
        showToast('ጨዋታ አልጀመረም', 'warning');
        return;
    }
    
    const patterns = checkWinningPatterns();
    if (patterns.length === 0) {
        showToast('የማሸነፍ ንድፍ አልተጠናቀቀም', 'error');
        return;
    }
    
    // Send claim to server
    sendWebSocketMessage({
        type: 'bingo_claim',
        playerId: gameState.playerId,
        playerName: gameState.playerName,
        patterns: patterns,
        markedNumbers: Array.from(gameState.markedNumbers)
    });
    
    showToast('የማሸነፍ ጥያቄ ቀርቧል...', 'info');
    document.getElementById('bingoBtn').disabled = true;
}

// WebSocket Functions
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        gameState.connectionStatus = 'connected';
        updateConnectionStatus();
        reconnectAttempts = 0;
        
        showToast('ከሰርቨር ጋር ተገናኝቷል', 'success');
        
        // Generate player ID if not exists
        if (!gameState.playerId) {
            gameState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = () => {
        gameState.connectionStatus = 'disconnected';
        updateConnectionStatus();
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * reconnectAttempts, 10000);
            showToast(`የመገናኘት ሙከራ ${reconnectAttempts}/${maxReconnectAttempts}...`, 'warning');
            setTimeout(connectWebSocket, delay);
        } else {
            showToast('ከሰርቨር ጋር መገናኘት አልተቻለም', 'error');
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        gameState.connectionStatus = 'error';
        updateConnectionStatus();
    };
}

function sendWebSocketMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        showToast('ከሰርቨር ጋር ያለዎት ግንኙነት አልተመሰረተም', 'error');
    }
}

function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'game_state':
            updateGameState(data);
            break;
        case 'player_joined':
        case 'player_left':
            updatePlayersCount(data.playersCount);
            break;
        case 'number_called':
            handleNumberCalled(data);
            break;
        case 'game_started':
            handleGameStarted();
            break;
        case 'game_stopped':
            handleGameStopped();
            break;
        case 'bingo_validated':
            handleBingoValidated(data);
            break;
        case 'winner_declared':
            handleWinnerDeclared(data);
            break;
        case 'error':
            showToast(data.message, 'error');
            break;
    }
}

function updateGameState(state) {
    gameState.gameActive = state.gameActive || false;
    gameState.calledNumbers = state.calledNumbers || [];
    gameState.playersOnline = state.playersCount || 0;
    
    // Update UI
    document.getElementById('playersOnline').textContent = gameState.playersOnline;
    document.getElementById('numbersCalled').textContent = gameState.calledNumbers.length;
    document.getElementById('gameId').textContent = state.gameId || '---';
    
    // Update called numbers display
    updateCalledNumbersDisplay();
    
    // Auto-mark numbers if enabled
    if (gameState.autoMarkEnabled) {
        autoMarkNumbers();
    }
}

function handleNumberCalled(data) {
    const number = data.number;
    const letter = data.letter;
    
    // Add to called numbers
    if (!gameState.calledNumbers.includes(number)) {
        gameState.calledNumbers.push(number);
    }
    
    // Update display
    updateCalledNumbersDisplay();
    document.getElementById('numbersCalled').textContent = gameState.calledNumbers.length;
    
    // Auto-mark if enabled
    if (gameState.autoMarkEnabled) {
        autoMarkNumbers();
    }
    
    // Show notification
    showToast(`ቁጥር ተጠርቷል: ${letter}${number}`, 'info');
}

function handleGameStarted() {
    gameState.gameActive = true;
    showToast('ጨዋታ ተጀምሯል!', 'success');
    document.getElementById('bingoBtn').disabled = false;
}

function handleGameStopped() {
    gameState.gameActive = false;
    showToast('ጨዋታ ተቆምቷል', 'warning');
    document.getElementById('bingoBtn').disabled = true;
}

function handleBingoValidated(data) {
    if (data.valid) {
        showToast('የማሸነፍ ጥያቄዎ ተፀድቋል!', 'success');
    } else {
        showToast('የማሸነፍ ጥያቄዎ ተጥሏል', 'error');
        document.getElementById('bingoBtn').disabled = false;
    }
}

function handleWinnerDeclared(data) {
    if (data.winnerId === gameState.playerId) {
        // Show winner modal for this player
        document.getElementById('winnerPlayerName').textContent = gameState.playerName;
        document.getElementById('winningPatternText').textContent = data.pattern;
        document.getElementById('prizeAmount').textContent = data.prize || '0';
        document.getElementById('winnerModal').style.display = 'flex';
        
        // Play winner sound
        playWinnerSound();
    } else {
        // Show notification for other players
        showToast(`አሸናፊ: ${data.winnerName} with ${data.pattern}!`, 'info');
    }
}

// Helper Functions
function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    const serverStatusEl = document.getElementById('serverStatus');
    
    let statusText, statusColor;
    
    switch(gameState.connectionStatus) {
        case 'connected':
            statusText = 'ተገናኝቷል';
            statusColor = '#28a745';
            break;
        case 'disconnected':
            statusText = 'ግንኙነት ተቋርጧል';
            statusColor = '#dc3545';
            break;
        case 'error':
            statusText = 'ስህተት';
            statusColor = '#ffc107';
            break;
        default:
            statusText = 'በመገናኘት ላይ...';
            statusColor = '#6c757d';
    }
    
    statusEl.innerHTML = `<i class="fas fa-circle" style="color: ${statusColor}"></i> ${statusText}`;
    serverStatusEl.textContent = statusText;
    serverStatusEl.style.color = statusColor;
}

function updateCalledNumbersDisplay() {
    const container = document.getElementById('calledNumbers');
    
    if (gameState.calledNumbers.length === 0) {
        container.innerHTML = '<div class="empty-message">ቁጥሮች መጥራት አልጀመረም</div>';
        return;
    }
    
    container.innerHTML = '';
    
    // Show last 20 numbers (most recent first)
    const recentNumbers = gameState.calledNumbers.slice(-20).reverse();
    
    recentNumbers.forEach((num, index) => {
        const div = document.createElement('div');
        div.className = `called-number ${index === 0 ? 'recent' : ''}`;
        
        // Determine letter for the number
        let letter = '';
        if (num <= 15) letter = 'B';
        else if (num <= 30) letter = 'I';
        else if (num <= 45) letter = 'N';
        else if (num <= 60) letter = 'G';
        else if (num <= 75) letter = 'O';
        
        div.textContent = `${letter}${num}`;
        div.title = `ቁጥር ${num}`;
        container.appendChild(div);
    });
}

function autoMarkNumbers() {
    const cells = document.querySelectorAll('.board-cell:not(.free)');
    cells.forEach(cell => {
        const num = parseInt(cell.dataset.number);
        if (gameState.calledNumbers.includes(num) && !cell.classList.contains('marked')) {
            cell.classList.add('marked');
            gameState.markedNumbers.add(num);
        }
    });
    
    // Check for win after auto-marking
    checkForWin();
}

function checkAutoMark() {
    gameState.autoMarkEnabled = !gameState.autoMarkEnabled;
    const btn = event.currentTarget;
    
    if (gameState.autoMarkEnabled) {
        btn.innerHTML = '<i class="fas fa-check-circle"></i><span class="amharic-text">ራስሰር ምልክት ተነሳ</span>';
        btn.classList.add('btn-success');
        btn.classList.remove('btn-primary');
        
        // Auto-mark current numbers
        autoMarkNumbers();
        showToast('ራስሰር ምልክት ተጀምሯል', 'success');
    } else {
        btn.innerHTML = '<i class="fas fa-check-double"></i><span class="amharic-text">ራስሰር ምልክት</span>';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
        showToast('ራስሰር ምልክት ተወግዷል', 'info');
    }
}

function clearMarks() {
    if (!confirm('ሁሉንም ምልክቶች ማጽዳት ይፈልጋሉ?')) return;
    
    const cells = document.querySelectorAll('.board-cell.marked:not(.free)');
    cells.forEach(cell => {
        cell.classList.remove('marked');
    });
    
    gameState.markedNumbers.clear();
    document.getElementById('bingoBtn').disabled = true;
    showToast('ሁሉም ምልክቶች ተወግደዋል', 'info');
}

function buyNewCard() {
    if (confirm('አዲስ የቢንጎ ካርድ መግዛት ይፈልጋሉ?')) {
        gameState.boardId = Math.floor(Math.random() * 100) + 1;
        generateBingoBoard();
        showToast('አዲስ ካርድ ተገዝቷል!', 'success');
    }
}

function showCardInfo() {
    const markedCount = gameState.markedNumbers.size + 1; // +1 for free space
    const totalNumbers = 75;
    const calledCount = gameState.calledNumbers.length;
    
    alert(`
የካርድ መረጃ:
- ቦርድ ቁጥር: ${gameState.boardId}
- የተጠሩ ቁጥሮች: ${calledCount}/${totalNumbers}
- የተሰመሩ ቁጥሮች: ${markedCount}/25
- የተገኘው ንድፍ: ${checkWinningPatterns().join(', ') || 'የለም'}
    `);
}

function updatePlayersCount(count) {
    gameState.playersOnline = count;
    document.getElementById('playersOnline').textContent = count;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function playWinnerSound() {
    // Create audio context for winner sound
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.3); // C6
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
    } catch (error) {
        console.log('Audio not supported:', error);
    }
}

function closeWinnerModal() {
    document.getElementById('winnerModal').style.display = 'none';
}

function setupEventListeners() {
    // Enter key in name input
    document.getElementById('inputPlayerName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    
    // Prevent form submission
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => e.preventDefault());
    });
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', initGame);

// Export for module if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initGame };
}