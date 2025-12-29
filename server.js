// 引入依赖
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 游戏常量
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;

// 创建Express应用
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 配置静态文件服务
app.use(express.static(__dirname));

// 游戏状态管理
const rooms = new Map(); // 房间ID -> 房间信息
const players = new Map(); // socketID -> 玩家信息

// 生成唯一房间ID（使用时间戳+随机数，减少冲突风险）
function generateRoomId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return (timestamp + random).toUpperCase().slice(-8);
}

// 初始化棋盘
function initBoard() {
    const board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
    const center = BOARD_SIZE / 2 - 1;
    board[center][center] = WHITE;
    board[center][center + 1] = BLACK;
    board[center + 1][center] = BLACK;
    board[center + 1][center + 1] = WHITE;
    return board;
}

// 检查是否为合法移动
function isValidMove(board, row, col, player) {
    if (board[row][col] !== EMPTY) {
        return false;
    }

    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],          [0, 1],
        [1, -1],  [1, 0], [1, 1]
    ];

    for (const [dx, dy] of directions) {
        let x = row + dx;
        let y = col + dy;
        let hasOpponentDisc = false;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (board[x][y] === EMPTY) {
                break;
            }

            if (board[x][y] === player) {
                if (hasOpponentDisc) {
                    return true;
                }
                break;
            }

            hasOpponentDisc = true;
            x += dx;
            y += dy;
        }
    }

    return false;
}

// 放置棋子
function placeDisc(board, row, col, player) {
    board[row][col] = player;

    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],          [0, 1],
        [1, -1],  [1, 0], [1, 1]
    ];

    for (const [dx, dy] of directions) {
        const discsToFlip = [];
        let x = row + dx;
        let y = col + dy;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (board[x][y] === EMPTY) {
                break;
            }

            if (board[x][y] === player) {
                for (const [fx, fy] of discsToFlip) {
                    board[fx][fy] = player;
                }
                break;
            }

            discsToFlip.push([x, y]);
            x += dx;
            y += dy;
        }
    }
}

// 检查玩家是否有合法移动
function checkValidMoves(board, player) {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isValidMove(board, row, col, player)) {
                return true;
            }
        }
    }
    return false;
}

// 计算分数（优化：减少循环次数，使用更高效的计分方式）
function calculateScore(board) {
    let blackScore = 0;
    let whiteScore = 0;

    // 扁平化数组遍历，减少循环嵌套
    const flatBoard = board.flat();
    for (let i = 0; i < flatBoard.length; i++) {
        const disc = flatBoard[i];
        if (disc === BLACK) {
            blackScore++;
        } else if (disc === WHITE) {
            whiteScore++;
        }
    }

    return { blackScore, whiteScore };
}

// Socket.IO事件处理
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // 玩家断开连接事件
    socket.on('disconnect', handleDisconnect);

    // 房间管理事件
    socket.on('getRoomList', handleGetRoomList);
    socket.on('createRoom', handleCreateRoom);
    socket.on('joinRoom', handleJoinRoom);
    socket.on('leaveRoom', handleLeaveRoom);

    // 游戏控制事件
    socket.on('makeMove', handleMakeMove);
    socket.on('requestStartGame', handleRequestStartGame);
    socket.on('confirmStartGame', handleConfirmStartGame);
    socket.on('rejectStartGame', handleRejectStartGame);
    socket.on('requestRestart', handleRequestRestart);
    socket.on('confirmRestart', handleConfirmRestart);
    socket.on('rejectRestart', handleRejectRestart);
    socket.on('requestPause', handleRequestPause);
    socket.on('confirmPause', handleConfirmPause);
    socket.on('rejectPause', handleRejectPause);
    socket.on('requestResume', handleRequestResume);
    socket.on('confirmResume', handleConfirmResume);
    socket.on('rejectResume', handleRejectResume);
    socket.on('requestResign', handleRequestResign);
    socket.on('confirmResign', handleConfirmResign);
    socket.on('rejectResign', handleRejectResign);
    socket.on('resign', handleResign); // 兼容旧版接口

    // 玩家断开连接处理
    function handleDisconnect() {
        console.log(`Player disconnected: ${socket.id}`);
        
        const player = players.get(socket.id);
        if (player) {
            const { roomId } = player;
            handlePlayerLeaveRoom(socket, roomId);
        }
    }

    // 获取房间列表处理
    function handleGetRoomList() {
        const roomList = Array.from(rooms.values()).map(room => ({
            roomId: room.roomId,
            players: room.players.length
        }));
        socket.emit('roomList', roomList);
    }

    // 创建房间处理
    function handleCreateRoom(playerName) {
        if (!playerName || typeof playerName !== 'string') {
            socket.emit('error', { message: 'Invalid player name' });
            return;
        }

        const roomId = generateRoomId();
        const room = {
            roomId,
            players: [{
                socketId: socket.id,
                name: playerName,
                color: BLACK
            }],
            board: initBoard(),
            currentPlayer: BLACK,
            gameOver: false,
            paused: false,
            pendingRequest: null,
            createdAt: Date.now(),
            thinkingTime: 30,
            remainingTime: 30,
            timerId: null
        };
        
        rooms.set(roomId, room);
        players.set(socket.id, { roomId, color: BLACK, name: playerName });
        
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, color: BLACK });
        broadcastRoomListUpdate();
        
        console.log(`Room created: ${roomId} by ${playerName}`);
    }

    // 加入房间处理
    function handleJoinRoom(data) {
        const { roomId, playerName } = data;
        
        if (!roomId || !playerName) {
            socket.emit('joinFailed', 'Invalid room ID or player name');
            return;
        }

        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('joinFailed', '房间不存在');
            return;
        }
        
        if (room.players.length >= 2) {
            socket.emit('joinFailed', '房间已满');
            return;
        }
        
        // 分配颜色（剩下的颜色）
        const color = room.players[0].color === BLACK ? WHITE : BLACK;
        
        // 更新房间信息
        room.players.push({
            socketId: socket.id,
            name: playerName,
            color
        });
        
        // 初始化待处理请求状态
        room.pendingRequest = null;
        
        rooms.set(roomId, room);
        players.set(socket.id, { roomId, color, name: playerName });
        
        socket.join(roomId);
        
        // 通知房间内所有玩家
        io.to(roomId).emit('playerJoined', {
            players: room.players,
            color
        });
        
        // 通知所有客户端房间列表更新
        broadcastRoomListUpdate();
        
        console.log(`${playerName} joined room ${roomId} as ${color === BLACK ? 'BLACK' : 'WHITE'}`);
    }

    // 离开房间处理
    function handleLeaveRoom(roomId) {
        handlePlayerLeaveRoom(socket, roomId);
    }

    // 通用玩家离开房间处理
    function handlePlayerLeaveRoom(socket, roomId) {
        const player = players.get(socket.id);
        if (!player) return;
        
        const room = rooms.get(roomId);
        if (!room) return;
        
        // 从房间中移除玩家
        room.players = room.players.filter(p => p.socketId !== socket.id);
        
        // 更新房间状态
        if (room.players.length === 0) {
            // 房间为空，删除房间
            rooms.delete(roomId);
            broadcastRoomListUpdate();
        } else if (room.players.length === 1) {
            // 房间只剩一个玩家，通知该玩家
            io.to(room.players[0].socketId).emit('opponentLeft');
            room.gameOver = true;
            rooms.set(roomId, room);
        }
        
        // 离开socket房间
        socket.leave(roomId);
        
        // 移除玩家记录
        players.delete(socket.id);
    }

    // 广播房间列表更新
    function broadcastRoomListUpdate() {
        const roomList = Array.from(rooms.values()).map(room => ({
            roomId: room.roomId,
            players: room.players.length
        }));
        io.emit('roomList', roomList);
    }

    // 落子处理
    function handleMakeMove(data) {
        const { roomId, row, col } = data;
        const room = rooms.get(roomId);
        const player = players.get(socket.id);
        
        if (!room || !player || room.gameOver || room.paused) {
            return;
        }
        
        // 检查是否是当前玩家的回合
        if (player.color !== room.currentPlayer) {
            socket.emit('moveFailed', '不是你的回合');
            return;
        }
        
        // 检查是否为合法移动
        if (!isValidMove(room.board, row, col, player.color)) {
            socket.emit('moveFailed', '非法移动');
            return;
        }
        
        // 放置棋子
        placeDisc(room.board, row, col, player.color);
        
        // 计算分数
        const { blackScore, whiteScore } = calculateScore(room.board);
        
        // 检查下一个玩家是否有合法移动
        let nextPlayer = room.currentPlayer === BLACK ? WHITE : BLACK;
        let hasValidMoves = checkValidMoves(room.board, nextPlayer);
        
        if (!hasValidMoves) {
            // 下一个玩家没有合法移动，检查对手是否有合法移动
            const opponent = nextPlayer === BLACK ? WHITE : BLACK;
            const opponentHasValidMoves = checkValidMoves(room.board, opponent);
            
            if (!opponentHasValidMoves) {
                // 游戏结束
                room.gameOver = true;
                rooms.set(roomId, room);
                
                io.to(roomId).emit('gameEnd', {
                    board: room.board,
                    blackScore,
                    whiteScore,
                    winner: blackScore > whiteScore ? BLACK : whiteScore > blackScore ? WHITE : null
                });
                
                console.log(`Game ended in room ${roomId}: BLACK ${blackScore} - WHITE ${whiteScore}`);
                return;
            } else {
                // 跳过当前玩家，使用对手的颜色
                nextPlayer = opponent;
            }
        }
        
        // 更新当前玩家
        room.currentPlayer = nextPlayer;
        rooms.set(roomId, room);
        
        // 通知房间内所有玩家
        io.to(roomId).emit('moveMade', {
            board: room.board,
            currentPlayer: room.currentPlayer,
            lastMove: { row, col, color: player.color },
            blackScore,
            whiteScore,
            remainingTime: room.thinkingTime // 重置后的剩余时间
        });
        
        console.log(`${player.name} made move at (${row}, ${col}) in room ${roomId}`);
        
        // 重置计时器
        resetTimer(roomId);
    }

    // 请求重新开始游戏处理
    function handleRequestRestart(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && !room.pendingRequest) {
            // 保存待处理请求
            room.pendingRequest = {
                type: 'restart',
                requesterSocketId: socket.id,
                timestamp: Date.now()
            };
            rooms.set(roomId, room);
            
            // 获取对手的socket ID
            const opponentSocketId = room.players.find(p => p.socketId !== socket.id)?.socketId;
            if (opponentSocketId) {
                // 向对手发送重新开始请求
                io.to(opponentSocketId).emit('restartRequest');
            }
        }
    }

    // 确认重新开始游戏处理
    function handleConfirmRestart(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'restart') {
            // 重新初始化棋盘
            room.board = initBoard();
            room.currentPlayer = BLACK;
            room.gameOver = false;
            room.paused = false;
            room.pendingRequest = null; // 清除待处理请求
            rooms.set(roomId, room);
            
            // 重置计时器
            resetTimer(roomId);
            
            // 通知房间内所有玩家
            io.to(roomId).emit('gameStart', {
                board: room.board,
                currentPlayer: room.currentPlayer,
                players: room.players,
                thinkingTime: room.thinkingTime,
                remainingTime: room.remainingTime
            });
            
            console.log(`Game restarted in room ${roomId}`);
        }
    }

    // 拒绝重新开始游戏处理
    function handleRejectRestart(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'restart') {
            // 获取请求方的socket ID
            const requestorSocketId = room.pendingRequest.requesterSocketId;
            if (requestorSocketId) {
                // 向请求方发送拒绝消息
                io.to(requestorSocketId).emit('restartRejected');
            }
            // 清除待处理请求
            room.pendingRequest = null;
            rooms.set(roomId, room);
        }
    }

    // 请求暂停游戏处理
    function handleRequestPause(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && !room.paused && !room.pendingRequest) {
            // 保存待处理请求
            room.pendingRequest = {
                type: 'pause',
                requesterSocketId: socket.id,
                timestamp: Date.now()
            };
            rooms.set(roomId, room);
            
            // 获取对手的socket ID
            const opponentSocketId = room.players.find(p => p.socketId !== socket.id)?.socketId;
            if (opponentSocketId) {
                // 向对手发送暂停请求
                io.to(opponentSocketId).emit('pauseRequest');
            }
        }
    }

    // 确认暂停游戏处理
    function handleConfirmPause(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && !room.paused && room.pendingRequest && room.pendingRequest.type === 'pause') {
            // 暂停游戏
            room.paused = true;
            room.pendingRequest = null; // 清除待处理请求
            rooms.set(roomId, room);
            
            // 停止计时器
            stopTimer(roomId);
            
            // 通知房间内所有玩家
            io.to(roomId).emit('gamePaused');
            
            console.log(`Game paused in room ${roomId}`);
        }
    }

    // 拒绝暂停游戏处理
    function handleRejectPause(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'pause') {
            // 获取请求方的socket ID
            const requestorSocketId = room.pendingRequest.requesterSocketId;
            if (requestorSocketId) {
                // 向请求方发送拒绝消息
                io.to(requestorSocketId).emit('pauseRejected');
            }
            // 清除待处理请求
            room.pendingRequest = null;
            rooms.set(roomId, room);
        }
    }

    // 请求恢复游戏处理
    function handleRequestResume(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.paused && !room.pendingRequest) {
            // 保存待处理请求
            room.pendingRequest = {
                type: 'resume',
                requesterSocketId: socket.id,
                timestamp: Date.now()
            };
            rooms.set(roomId, room);
            
            // 获取对手的socket ID
            const opponentSocketId = room.players.find(p => p.socketId !== socket.id)?.socketId;
            if (opponentSocketId) {
                // 向对手发送恢复请求
                io.to(opponentSocketId).emit('resumeRequest');
            }
        }
    }

    // 确认恢复游戏处理
    function handleConfirmResume(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.paused && room.pendingRequest && room.pendingRequest.type === 'resume') {
            // 恢复游戏
            room.paused = false;
            room.pendingRequest = null; // 清除待处理请求
            rooms.set(roomId, room);
            
            // 重新启动计时器
            startTimer(roomId);
            
            // 通知房间内所有玩家
            io.to(roomId).emit('gameResumed', {
                currentPlayer: room.currentPlayer
            });
            
            console.log(`Game resumed in room ${roomId}`);
        }
    }

    // 拒绝恢复游戏处理
    function handleRejectResume(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'resume') {
            // 获取请求方的socket ID
            const requestorSocketId = room.pendingRequest.requesterSocketId;
            if (requestorSocketId) {
                // 向请求方发送拒绝消息
                io.to(requestorSocketId).emit('resumeRejected');
            }
            // 清除待处理请求
            room.pendingRequest = null;
            rooms.set(roomId, room);
        }
    }

    // 请求认输处理
    function handleRequestResign(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && !room.pendingRequest) {
            // 保存待处理请求
            room.pendingRequest = {
                type: 'resign',
                requesterSocketId: socket.id,
                timestamp: Date.now()
            };
            rooms.set(roomId, room);
            
            // 获取对手的socket ID
            const opponentSocketId = room.players.find(p => p.socketId !== socket.id)?.socketId;
            if (opponentSocketId) {
                // 向对手发送认输请求
                io.to(opponentSocketId).emit('resignRequest');
            }
        }
    }

    // 确认认输处理
    function handleConfirmResign(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'resign') {
            // 获取认输方的socket ID（请求者）
            const resigningPlayerSocketId = room.pendingRequest.requesterSocketId;
            const resigningPlayer = players.get(resigningPlayerSocketId);
            
            if (resigningPlayer) {
                // 计算分数
                const { blackScore, whiteScore } = calculateScore(room.board);
                
                // 设置游戏结束
                room.gameOver = true;
                room.pendingRequest = null; // 清除待处理请求
                rooms.set(roomId, room);
                
                // 停止计时器
                stopTimer(roomId);
                
                // 确定胜利者（认输玩家的对手）
                const winner = resigningPlayer.color === BLACK ? WHITE : BLACK;
                
                // 通知房间内所有玩家游戏结束
                io.to(roomId).emit('gameEnd', {
                    board: room.board,
                    blackScore,
                    whiteScore,
                    winner
                });
                
                // 通知认输方认输成功
                io.to(resigningPlayerSocketId).emit('resignConfirmed');
                
                console.log(`${resigningPlayer.name} resigned in room ${roomId}. Winner: ${winner === BLACK ? 'BLACK' : 'WHITE'}`);
            }
        }
    }

    // 拒绝认输处理
    function handleRejectResign(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'resign') {
            // 获取请求方的socket ID
            const requestorSocketId = room.pendingRequest.requesterSocketId;
            if (requestorSocketId) {
                // 向请求方发送拒绝消息
                io.to(requestorSocketId).emit('resignRejected');
            }
            // 清除待处理请求
            room.pendingRequest = null;
            rooms.set(roomId, room);
        }
    }

    // 直接认输处理（保留原函数，用于兼容性）
    function handleResign(roomId) {
        const room = rooms.get(roomId);
        const player = players.get(socket.id);
        if (room && player && room.players.length === 2) {
            // 计算分数
            const { blackScore, whiteScore } = calculateScore(room.board);
            
            // 设置游戏结束
            room.gameOver = true;
            rooms.set(roomId, room);
            
            // 停止计时器
            stopTimer(roomId);
            
            // 确定胜利者（认输玩家的对手）
            const winner = player.color === BLACK ? WHITE : BLACK;
            
            // 通知房间内所有玩家游戏结束
            io.to(roomId).emit('gameEnd', {
                board: room.board,
                blackScore,
                whiteScore,
                winner
            });
            
            // 通知认输方认输成功
            socket.emit('resignConfirmed');
            
            console.log(`${player.name} resigned in room ${roomId}. Winner: ${winner === BLACK ? 'BLACK' : 'WHITE'}`);
        }
    }

    // 请求开始游戏处理
    function handleRequestStartGame(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && !room.pendingRequest) {
            // 保存待处理请求
            room.pendingRequest = {
                type: 'start',
                requesterSocketId: socket.id,
                timestamp: Date.now()
            };
            rooms.set(roomId, room);
            
            // 向请求方发送等待确认事件
            io.to(socket.id).emit('waitingForOpponentConfirmation');
            
            // 获取对手的socket ID
            const opponentSocketId = room.players.find(p => p.socketId !== socket.id)?.socketId;
            if (opponentSocketId) {
                // 向对手发送开始游戏请求
                io.to(opponentSocketId).emit('startGameRequest');
            }
        }
    }

    // 确认开始游戏处理
    function handleConfirmStartGame(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'start') {
            // 重置游戏状态
            room.board = initBoard();
            room.currentPlayer = BLACK;
            room.gameOver = false;
            room.paused = false;
            room.pendingRequest = null; // 清除待处理请求
            rooms.set(roomId, room);
            
            // 通知房间内所有玩家游戏开始
            io.to(roomId).emit('gameStart', {
                board: room.board,
                currentPlayer: room.currentPlayer,
                players: room.players,
                thinkingTime: room.thinkingTime,
                remainingTime: room.remainingTime
            });
            
            // 启动计时器
            startTimer(roomId);
            
            console.log(`Game started in room ${roomId} by player confirmation`);
        }
    }

    // 拒绝开始游戏处理
    function handleRejectStartGame(roomId) {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2 && room.pendingRequest && room.pendingRequest.type === 'start') {
            // 获取请求方的socket ID
            const requestorSocketId = room.pendingRequest.requesterSocketId;
            if (requestorSocketId) {
                // 向请求方发送拒绝消息
                io.to(requestorSocketId).emit('startGameRejected');
            }
            // 清除待处理请求
            room.pendingRequest = null;
            rooms.set(roomId, room);
        }
    }
});

// 启动计时器
function startTimer(roomId) {
    let room = rooms.get(roomId);
    if (!room || room.gameOver || room.paused) return;
    
    // 重置剩余时间
    room.remainingTime = room.thinkingTime;
    
    // 停止之前的计时器
    if (room.timerId) {
        clearInterval(room.timerId);
        room.timerId = null;
    }
    
    // 发送初始时间
    io.to(roomId).emit('timerUpdate', {
        remainingTime: room.remainingTime,
        currentPlayer: room.currentPlayer
    });
    
    // 更新房间状态
    rooms.set(roomId, room);
    
    // 启动新的计时器
    room.timerId = setInterval(() => {
        // 每次循环重新获取房间引用，避免闭包引用旧数据
        const currentRoom = rooms.get(roomId);
        if (!currentRoom) {
            // 房间已不存在，清理计时器
            clearInterval(room.timerId);
            return;
        }
        
        // 检查游戏是否暂停或结束
        if (currentRoom.paused || currentRoom.gameOver) {
            clearInterval(room.timerId);
            currentRoom.timerId = null;
            rooms.set(roomId, currentRoom);
            return;
        }
        
        // 减少剩余时间
        currentRoom.remainingTime--;
        
        // 发送时间更新
        io.to(roomId).emit('timerUpdate', {
            remainingTime: currentRoom.remainingTime,
            currentPlayer: currentRoom.currentPlayer
        });
        
        // 检查时间是否用完
        if (currentRoom.remainingTime <= 0) {
            // 停止计时器
            clearInterval(room.timerId);
            currentRoom.timerId = null;
            
            // 发送超时通知
            io.to(roomId).emit('timeUp', {
                currentPlayer: currentRoom.currentPlayer
            });
            
            // 处理超时：跳过当前玩家，切换到下一个玩家
            const nextPlayer = currentRoom.currentPlayer === BLACK ? WHITE : BLACK;
            currentRoom.currentPlayer = nextPlayer;
            rooms.set(roomId, currentRoom);
            
            // 发送玩家切换通知
            io.to(roomId).emit('playerSwitched', {
                currentPlayer: currentRoom.currentPlayer
            });
            
            // 重新启动计时器
            startTimer(roomId);
        } else {
            // 更新房间状态
            rooms.set(roomId, currentRoom);
        }
    }, 1000);
}

// 停止计时器
function stopTimer(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    if (room.timerId) {
        clearInterval(room.timerId);
        room.timerId = null;
        rooms.set(roomId, room);
    }
}

// 重置计时器
function resetTimer(roomId) {
    stopTimer(roomId);
    startTimer(roomId);
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});