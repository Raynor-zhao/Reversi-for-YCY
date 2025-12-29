// 游戏常量
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;

// DOM元素
let lobbyElement;
let gameElement;
let playerNameInput;
let createRoomBtn;
let roomIdInput;
let joinRoomBtn;
let roomListElement;
let roomIdDisplay;
let boardElement;
let currentPlayerIndicator;
let blackScoreElement;
let whiteScoreElement;
let statusTextElement;
let restartBtn;
let pauseBtn;
let resignBtn;
let timerDisplay;
let backBtn;
let startGameBtn;
let confirmDialog;
let confirmMessage;
let confirmBtn;
let cancelBtn;

// 确认对话框回调函数
let confirmCallback = null;

// 游戏状态
let socket;
let playerName;
let roomId;
let playerColor;
let currentPlayer;
let board;
let gameOver;
let paused = false;
let hasPendingRequest = false;

// IM相关状态
let chat;
let imInitialized = false;
let imLoggedIn = false;
let appid;
let sign;

// IM初始化优化配置
let imInitializing = false;
let imInitPromise = null;
let imDestroyed = false;

// 消息发送队列，避免并发发送问题
let sendQueue = Promise.resolve();

// API-bridge配置
const API_BRIDGE_CONFIG = {
    BASE_URL: 'http://localhost:3001',
    TIMEOUT: 15000,
    RECONNECT_DELAY: 5000
};

// IM初始化配置（保留，用于兼容旧代码）
const IM_CONFIG = {
    API_BASE: 'https://suo.jiushu1234.com/api.php',
    TIMEOUT: 15000,
    RECONNECT_DELAY: 5000
};

// 初始化游戏
function initGame() {
    // 获取DOM元素
    lobbyElement = document.getElementById('lobby');
    gameElement = document.getElementById('game');
    playerNameInput = document.getElementById('playerName');
    createRoomBtn = document.getElementById('createRoomBtn');
    roomIdInput = document.getElementById('roomIdInput');
    joinRoomBtn = document.getElementById('joinRoomBtn');
    roomListElement = document.getElementById('roomList');
    roomIdDisplay = document.getElementById('roomIdDisplay');
    boardElement = document.getElementById('board');
    currentPlayerIndicator = document.getElementById('currentPlayerIndicator');
    blackScoreElement = document.getElementById('blackScore');
    whiteScoreElement = document.getElementById('whiteScore');
    statusTextElement = document.getElementById('statusText');
    restartBtn = document.getElementById('restartBtn');
    pauseBtn = document.getElementById('pauseBtn');
    resignBtn = document.getElementById('resignBtn');
    timerDisplay = document.getElementById('timerDisplay');
    backBtn = document.getElementById('backBtn');
    startGameBtn = document.getElementById('startGameBtn');
    
    // 确认对话框元素
    confirmDialog = document.getElementById('confirmDialog');
    confirmMessage = document.getElementById('confirmMessage');
    confirmBtn = document.getElementById('confirmBtn');
    cancelBtn = document.getElementById('cancelBtn');
    
    // 绑定事件
    bindEventListeners();
    
    // 初始化Socket.IO连接
    initSocket();
    
    // 从URL参数获取uid和token
    parseUrlParams();
    
    // 获取房间列表
    socket.emit('getRoomList');
    
    // 定时获取房间列表（调整为10秒间隔，减少服务器负载）
    setInterval(() => {
        socket.emit('getRoomList');
    }, 10000);
}

// 处理IM登录成功
function handleIMLoginSuccess() {
    imLoggedIn = true;
    console.log('IM login successful');
    
    // 登录成功后自动测试连通性
    testIMConnectivity();
}

// API-bridge HTTP请求函数
async function apiBridgeRequest(endpoint, method = 'GET', data = null) {
    const url = `${API_BRIDGE_CONFIG.BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: API_BRIDGE_CONFIG.TIMEOUT
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API-bridge请求失败:', error);
        throw error;
    }
}

// API-bridge登录函数
async function apiBridgeLogin() {
    if (!window.uid || !window.token) {
        console.error('Invalid uid or token for API-bridge login');
        return false;
    }
    
    try {
        // 提取原始uid（去除game_前缀）
        const rawUid = window.uid.startsWith('game_') ? window.uid.slice(5) : window.uid;
        
        const response = await apiBridgeRequest('/api/login', 'POST', {
            uid: rawUid,
            token: window.token
        });
        
        console.log('API-bridge登录成功:', response);
        return response.success;
    } catch (error) {
        console.error('API-bridge登录失败:', error);
        return false;
    }
}

// API-bridge发送命令函数
async function apiBridgeSendCommand(actionId, data = 0) {
    try {
        const response = await apiBridgeRequest('/api/send-command', 'POST', {
            commandId: actionId,
            data: data
        });
        
        console.log('API-bridge发送命令成功:', response);
        return response.success;
    } catch (error) {
        console.error('API-bridge发送命令失败:', error);
        return false;
    }
}

// API-bridge获取状态函数
async function apiBridgeGetStatus() {
    try {
        const response = await apiBridgeRequest('/api/status');
        return response;
    } catch (error) {
        console.error('API-bridge获取状态失败:', error);
        return null;
    }
}

// 解析URL参数
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    window.uid = urlParams.get('uid');
    window.token = urlParams.get('token');
    
    if (window.uid && window.token) {
        // 如果URL中有uid和token，通过API-bridge初始化IM
        apiBridgeLogin();
    }
}

// 初始化IM（优化：参考ycy_im_demo.ts实现，增加队列机制和更好的错误处理）
function initIM() {
    // 检查是否已经初始化或正在初始化
    if (imInitialized && !imDestroyed) {
        console.log('IM already initialized, skipping');
        return Promise.resolve();
    }
    
    if (imInitializing) {
        console.log('IM initialization already in progress, waiting...');
        return imInitPromise;
    }
    
    if (!window.timSdkLoaded) {
        console.error('TIM SDK not loaded yet, cannot initialize IM');
        updateStatusText('TIM SDK未加载，无法初始化IM');
        return Promise.reject(new Error('TIM SDK not loaded'));
    }
    
    // 确保uid和token有效
    if (!window.uid || !window.token) {
        console.error('Invalid uid or token, cannot initialize IM');
        updateStatusText('无效的用户信息，无法初始化IM');
        return Promise.reject(new Error('Invalid uid or token'));
    }
    
    console.log('Initializing IM with uid:', window.uid);
    
    // 标记为正在初始化
    imInitializing = true;
    imDestroyed = false;
    
    // 创建初始化Promise
    imInitPromise = fetchGameSign()
        .then(() => {
            console.log('Game sign obtained successfully, initializing SDK');
            
            // 如果已经有chat实例，先销毁
            if (chat) {
                console.log('Destroying existing chat instance');
                destroyIM();
            }
            
            // 初始化IM SDK，兼容不同版本的SDK
            let sdkInstance = null;
            let sdkReadyEvent = null;
            let messageReceivedEvent = null;
            let kickedOutEvent = null;
            let errorEvent = null;
            let convType = null;
            let sdkType = null;
            
            if (typeof TIM !== 'undefined') {
                // 旧版TIM SDK
                sdkType = 'TIM';
                sdkInstance = TIM.create({
                    SDKAppID: parseInt(appid)
                });
                sdkReadyEvent = TIM.EVENT.SDK_READY;
                messageReceivedEvent = TIM.EVENT.MESSAGE_RECEIVED;
                kickedOutEvent = TIM.EVENT.KICKED_OUT;
                errorEvent = TIM.EVENT.ERROR;
                convType = TIM.TYPES.CONV_C2C;
            } else if (typeof TencentCloudChat !== 'undefined') {
                // 新版@tencentcloud/chat SDK
                sdkType = 'TencentCloudChat';
                sdkInstance = TencentCloudChat.create({
                    SDKAppID: parseInt(appid)
                });
                sdkReadyEvent = TencentCloudChat.EVENT.SDK_READY;
                messageReceivedEvent = TencentCloudChat.EVENT.MESSAGE_RECEIVED;
                kickedOutEvent = TencentCloudChat.EVENT.KICKED_OUT;
                errorEvent = TencentCloudChat.EVENT.ERROR;
                convType = TencentCloudChat.TYPES.CONV_C2C;
            }
            
            if (sdkInstance) {
                console.log(`Using ${sdkType} SDK, SDKAppID: ${appid}`);
                chat = sdkInstance;
                window.imConvType = convType; // 保存会话类型，供消息发送使用
                
                // 监听IM事件
                chat.on(sdkReadyEvent, handleIMReady);
                chat.on(messageReceivedEvent, handleIMMessageReceived);
                chat.on(kickedOutEvent, handleIMKickedOut);
                chat.on(errorEvent, handleIMError);
                
                // 登录IM
                return loginIM();
            } else {
                console.error('TIM SDK not available, neither TIM nor TencentCloudChat is defined');
                updateStatusText('TIM SDK不可用，无法初始化IM');
                throw new Error('TIM SDK not available');
            }
        })
        .catch(error => {
            console.error('Failed to initialize IM:', error);
            updateStatusText(`初始化IM失败: ${error.message}`);
            // 失败后标记为已销毁，允许重新初始化
            imDestroyed = true;
            throw error;
        })
        .finally(() => {
            // 重置初始化状态
            imInitializing = false;
        });
    
    return imInitPromise;
}

// 销毁IM实例，清理资源
function destroyIM() {
    if (!chat) {
        return;
    }
    
    try {
        console.log('Destroying IM instance...');
        // 移除所有事件监听
        chat.off();
        // 尝试登出
        chat.logout().catch(error => {
            console.warn('IM logout failed during destroy:', error);
        });
        // 尝试销毁实例
        if (typeof chat.destroy === 'function') {
            chat.destroy();
        }
    } catch (error) {
        console.error('Error destroying IM instance:', error);
    } finally {
        chat = null;
        imInitialized = false;
        imLoggedIn = false;
        imDestroyed = true;
    }
}

// 获取游戏签名
async function fetchGameSign() {
    try {
        const response = await fetch('https://suo.jiushu1234.com/api.php/user/game_sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: window.uid,
                token: window.token
            })
        });
        
        const data = await response.json();
        if (data.code === 1) {
            appid = data.data.appid;
            sign = data.data.sign;
            return true;
        } else {
            throw new Error('Failed to get game sign: ' + data.msg);
        }
    } catch (error) {
        console.error('Error fetching game sign:', error);
        throw error;
    }
}

// 登录IM
function loginIM() {
    if (!imInitialized) {
        console.error('IM not initialized');
        return;
    }
    
    console.log('Login IM with userID:', window.uid, 'and sign:', sign.substring(0, 20) + '...');
    
    chat.login({
        userID: window.uid, // 登录使用完整的uid，如game_5
        userSig: sign
    }).then(() => {
        // 处理登录成功
        handleIMLoginSuccess();
        // 登录成功后发送游戏信息
        sendGameInfo();
    }).catch(error => {
        console.error('IM login failed:', error);
        updateStatusText(`IM登录失败: ${error.message}`);
    });
}

// 处理IM SDK准备就绪
function handleIMReady() {
    console.log('IM SDK ready');
}

// 处理IM消息接收
function handleIMMessageReceived(event) {
    const messageList = event.data;
    messageList.forEach(message => {
        if (message.type === 'TIMTextElem') {
            try {
                const messageData = JSON.parse(message.payload.text);
                if (messageData.code === 'game_info') {
                    // 处理游戏控制消息
                    handleGameControlMessage(messageData);
                }
            } catch (error) {
                console.error('Error parsing IM message:', error);
            }
        }
    });
}

// 处理游戏控制消息
function handleGameControlMessage(messageData) {
    // 根据messageData.data的值执行不同的游戏操作
    // 这里可以根据需要扩展，比如控制游戏速度、特效等
    console.log('Game control message received:', messageData);
    
    // 示例：根据data值更新游戏状态
    switch (messageData.data) {
        case 0: // miss
            console.log('Game control: miss');
            break;
        case 1: // hit
            console.log('Game control: hit');
            break;
        case 2: // bomb
            console.log('Game control: bomb');
            break;
        default:
            console.log('Game control: unknown action', messageData.data);
    }
}

// 处理IM被踢事件
function handleIMKickedOut(event) {
    console.error('IM kicked out:', event.data);
    imLoggedIn = false;
}

// 处理IM错误
function handleIMError(event) {
    console.error('IM error:', event.data);
}

// 发送游戏信息（通过API-bridge）
function sendGameInfo() {
    console.log('Sending game info via API-bridge');
    
    // 使用API-bridge发送游戏信息，actionId为'game_info'
    apiBridgeSendCommand('game_info', 1);
}

// 发送IM命令（通过API-bridge）
function sendIMCommand(actionId, data) {
    console.log(`Sending IM command ${actionId} via API-bridge with data: ${data}`);
    
    // 使用API-bridge发送命令
    apiBridgeSendCommand(actionId, data || 0);
}

// 绑定事件监听器
function bindEventListeners() {
    // 游戏控制按钮事件
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
    restartBtn.addEventListener('click', requestRestart);
    pauseBtn.addEventListener('click', togglePause);
    resignBtn.addEventListener('click', resignGame);
    backBtn.addEventListener('click', goBackToLobby);
    startGameBtn.addEventListener('click', requestStartGame);
    
    // 确认对话框事件
    confirmBtn.addEventListener('click', () => {
        if (confirmCallback) {
            const callback = confirmCallback;
            confirmCallback = null;
            callback(true);
        }
        hideConfirmDialog();
    });
    
    cancelBtn.addEventListener('click', () => {
        if (confirmCallback) {
            const callback = confirmCallback;
            confirmCallback = null;
            callback(false);
        }
        hideConfirmDialog();
    });
}

// 测试IM连通性（通过API-bridge）
let imTestInProgress = false;

async function testIMConnectivity() {
    // 避免重复测试
    if (imTestInProgress) {
        console.log('IM connectivity test already in progress, skipping');
        return false;
    }
    
    imTestInProgress = true;
    
    try {
        // 使用API-bridge获取IM状态
        const status = await apiBridgeGetStatus();
        
        if (status) {
            console.log('API-bridge状态:', status);
            
            if (status.isReady) {
                console.log('IM connectivity test via API-bridge successful');
                return true;
            } else {
                console.log('IM not ready according to API-bridge');
                return false;
            }
        } else {
            console.log('Failed to get API-bridge status');
            return false;
        }
    } catch (error) {
        console.error('IM connectivity test via API-bridge failed:', error);
        // 不显示错误信息，避免影响用户体验
        return false;
    } finally {
        imTestInProgress = false;
    }
}

// 显示自定义确认对话框
function showConfirmDialog(message, callback) {
    confirmMessage.textContent = message;
    confirmDialog.style.display = 'flex';
    confirmCallback = callback;
}

// 隐藏自定义确认对话框
function hideConfirmDialog() {
    confirmDialog.style.display = 'none';
    // 不再在这里重置confirmCallback，而是在事件监听器中调用回调函数后，由回调函数自行处理
}

// 初始化Socket.IO连接
function initSocket() {
    // 连接到服务器
    socket = io();
    
    // 连接成功
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    // 连接失败
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateStatusText('无法连接到服务器，请稍后重试');
    });
    
    // 房间创建成功
    socket.on('roomCreated', (data) => {
        roomId = data.roomId;
        playerColor = data.color;
        roomIdDisplay.textContent = roomId;
        
        // 隐藏大厅，显示游戏界面
        lobbyElement.style.display = 'none';
        gameElement.style.display = 'block';
        
        updateStatusText(`房间创建成功！房间ID：${roomId}，你是${playerColor === BLACK ? '黑色' : '白色'}玩家，等待对手加入...`);
    });
    
    // 加入房间失败
    socket.on('joinFailed', (message) => {
        alert(message);
    });
    
    // 玩家加入
    socket.on('playerJoined', (data) => {
        // 显示开始游戏按钮
        startGameBtn.style.display = 'inline-block';
        updateStatusText(`玩家已加入，点击开始游戏按钮开始游戏...`);
    });
    
    // 游戏开始
    socket.on('gameStart', (data) => {
        console.log('gameStart event received:', data);
        board = data.board;
        currentPlayer = data.currentPlayer;
        gameOver = false;
        paused = false;
        hasPendingRequest = false; // 重置待处理请求标志
        
        // 隐藏开始游戏按钮
        startGameBtn.style.display = 'none';
        
        // 显示暂停、认输、重新开始按钮
        pauseBtn.style.display = 'inline-block';
        resignBtn.style.display = 'inline-block';
        restartBtn.style.display = 'inline-block';
        
        // 禁用返回大厅按钮
        backBtn.disabled = true;
        
        // 设置暂停按钮文本
        pauseBtn.textContent = '暂停';
        
        // 启用认输按钮
        resignBtn.disabled = false;
        
        // 设置当前玩家的颜色
        if (!playerColor) {
            // 对于加入房间的玩家，根据players数组找到自己的颜色
            const currentSocketId = socket.id;
            const playerInfo = data.players.find(p => p.socketId === currentSocketId);
            if (playerInfo) {
                playerColor = playerInfo.color;
                console.log(`当前玩家颜色：${playerColor === BLACK ? '黑色' : '白色'}`);
            }
        }
        
        // 设置初始剩余时间
        if (data.remainingTime !== undefined) {
            timerDisplay.textContent = data.remainingTime;
        }
        
        // 渲染棋盘
        renderBoard();
        
        // 更新UI
        updateUI();
        
        // 使用"您"和"对手"代替"黑色"和"白色"
        const currentPlayerText = currentPlayer === playerColor ? '您' : '对手';
        console.log('Updating status text to:', `游戏开始！当前玩家：${currentPlayerText}`);
        updateStatusText(`游戏开始！当前玩家：${currentPlayerText}`);
        console.log('gameStart event processing completed');
    });
    
    // 接收开始游戏请求
    socket.on('startGameRequest', () => {
        console.log('startGameRequest received, showing confirm dialog');
        showConfirmDialog('对手请求开始游戏，是否同意？', (result) => {
            console.log('Confirm dialog result:', result, 'roomId:', roomId);
            if (result) {
                console.log('Emitting confirmStartGame with roomId:', roomId);
                socket.emit('confirmStartGame', roomId);
            } else {
                console.log('Emitting rejectStartGame with roomId:', roomId);
                socket.emit('rejectStartGame', roomId);
            }
        });
    });
    
    // 开始游戏请求被拒绝
    socket.on('startGameRejected', () => {
        updateStatusText('对手拒绝了开始游戏的请求');
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 等待对手确认开始游戏
    socket.on('waitingForOpponentConfirmation', () => {
        updateStatusText('等待对手确认开始游戏...');
    });
    
    // 移动成功
    socket.on('moveMade', (data) => {
        board = data.board;
        currentPlayer = data.currentPlayer;
        
        // 更新分数
        blackScoreElement.textContent = data.blackScore;
        whiteScoreElement.textContent = data.whiteScore;
        
        // 更新计时器显示
        if (data.remainingTime !== undefined) {
            timerDisplay.textContent = data.remainingTime;
        }
        
        // 渲染棋盘
        renderBoard();
        
        // 更新UI
        updateUI();
        
        // 使用"您"和"对手"代替"黑色"和"白色"
        const currentPlayerText = currentPlayer === playerColor ? '您' : '对手';
        updateStatusText(`当前玩家：${currentPlayerText}`);
    });
    
    // 游戏结束
    socket.on('gameEnd', (data) => {
        board = data.board;
        gameOver = true;
        hasPendingRequest = false; // 重置待处理请求标志
        
        // 禁用认输按钮
        resignBtn.disabled = true;
        
        // 启用返回大厅按钮
        backBtn.disabled = false;
        
        // 更新分数
        blackScoreElement.textContent = data.blackScore;
        whiteScoreElement.textContent = data.whiteScore;
        
        // 渲染棋盘
        renderBoard();
        
        // 更新UI
        updateUI();
        
        // 显示获胜者，使用"您"和"对手"代替"黑色"和"白色"
        let winnerText;
        if (data.winner === playerColor) {
            winnerText = '您';
        } else if (data.winner) {
            winnerText = '对手';
        } else {
            updateStatusText(`游戏结束！平局，比分：${data.blackScore} : ${data.whiteScore}`);
            return;
        }
        
        updateStatusText(`游戏结束！${winnerText}获胜，比分：${data.winner === BLACK ? data.blackScore : data.whiteScore} : ${data.winner === BLACK ? data.whiteScore : data.blackScore}`);
    });
    
    // 对手离开
    socket.on('opponentLeft', () => {
        resetRoomState();
    });

// 重置房间状态为初始创建时的状态
function resetRoomState() {
    // 更新状态文本
    updateStatusText(`玩家已加入，点击开始游戏按钮开始游戏...`);
    
    // 重置游戏状态
    gameOver = false;
    paused = false;
    hasPendingRequest = false;
    
    // 启用返回大厅按钮
    backBtn.disabled = false;
    
    // 重置按钮状态，恢复到刚创建房间时的样式
    pauseBtn.textContent = '暂停';
    pauseBtn.style.display = 'none';
    resignBtn.disabled = false;
    resignBtn.style.display = 'none';
    restartBtn.style.display = 'none';
    startGameBtn.style.display = 'inline-block'; // 显示开始游戏按钮
    
    // 重置分数为初始值
    blackScoreElement.textContent = '2';
    whiteScoreElement.textContent = '2';
    
    // 重置计时器显示
    timerDisplay.textContent = '30';
    
    // 清空棋盘
    boardElement.innerHTML = '';
    
    // 重置当前玩家指示器
    currentPlayerIndicator.style.backgroundColor = '#000';
    currentPlayerIndicator.style.border = 'none';
}
    
    // 计时器更新
    socket.on('timerUpdate', (data) => {
        // 更新剩余时间显示
        timerDisplay.textContent = data.remainingTime;
    });
    
    // 时间用完
    socket.on('timeUp', (data) => {
        // 更新状态文本，显示时间用完
        updateStatusText(`时间用完！自动切换到下一个玩家`);
    });
    
    // 玩家切换
    socket.on('playerSwitched', (data) => {
        // 更新当前玩家
        currentPlayer = data.currentPlayer;
        
        // 更新UI
        updateUI();
        
        // 使用"您"和"对手"代替"黑色"和"白色"
        const currentPlayerText = currentPlayer === playerColor ? '您' : '对手';
        updateStatusText(`当前玩家：${currentPlayerText}`);
        
        // 重新渲染棋盘
        renderBoard();
    });
    
    // 房间列表更新
    socket.on('roomList', (rooms) => {
        updateRoomList(rooms);
    });
    
    // 接收重新开始请求
    socket.on('restartRequest', () => {
        showConfirmDialog('对手请求重新开始游戏，是否同意？', (result) => {
            if (result) {
                socket.emit('confirmRestart', roomId);
            } else {
                socket.emit('rejectRestart', roomId);
            }
        });
    });
    
    // 接收暂停请求
    socket.on('pauseRequest', () => {
        showConfirmDialog('对手请求暂停游戏，是否同意？', (result) => {
            if (result) {
                socket.emit('confirmPause', roomId);
            } else {
                socket.emit('rejectPause', roomId);
            }
        });
    });
    
    // 重新开始请求被拒绝
    socket.on('restartRejected', () => {
        updateStatusText('对手拒绝了重新开始游戏的请求');
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 暂停请求被拒绝
    socket.on('pauseRejected', () => {
        updateStatusText('对手拒绝了暂停游戏的请求');
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 游戏暂停
    socket.on('gamePaused', () => {
        paused = true;
        pauseBtn.textContent = '恢复';
        updateStatusText('游戏已暂停，等待恢复');
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 游戏恢复
    socket.on('gameResumed', () => {
        paused = false;
        pauseBtn.textContent = '暂停';
        updateStatusText('游戏已恢复');
        // 使用"您"和"对手"代替"黑色"和"白色"
        const currentPlayerText = currentPlayer === playerColor ? '您' : '对手';
        updateStatusText(`游戏已恢复！当前玩家：${currentPlayerText}`);
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 接收恢复游戏请求
    socket.on('resumeRequest', () => {
        showConfirmDialog('对手请求恢复游戏，是否同意？', (result) => {
            if (result) {
                socket.emit('confirmResume', roomId);
            } else {
                socket.emit('rejectResume', roomId);
            }
        });
    });
    
    // 恢复请求被拒绝
    socket.on('resumeRejected', () => {
        updateStatusText('对手拒绝了恢复游戏的请求');
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 接收认输请求
    socket.on('resignRequest', () => {
        showConfirmDialog('对手请求认输，是否同意？', (result) => {
            if (result) {
                socket.emit('confirmResign', roomId);
            } else {
                socket.emit('rejectResign', roomId);
            }
        });
    });
    
    // 认输请求被拒绝
    socket.on('resignRejected', () => {
        updateStatusText('对手拒绝了认输请求');
        hasPendingRequest = false; // 重置待处理请求标志
    });
    
    // 认输成功
    socket.on('resignConfirmed', () => {
        updateStatusText('认输成功，游戏结束');
        // 禁用认输按钮
        resignBtn.disabled = true;
        gameOver = true;
        hasPendingRequest = false; // 重置待处理请求标志
    });
}

// 创建房间
function createRoom() {
    playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        alert('请输入你的名字');
        return;
    }
    
    socket.emit('createRoom', playerName);
    
    // 延迟测试IM连通性，确保IM已经初始化
    setTimeout(() => {
        testIMConnectivity();
    }, 1000);
}

// 加入房间
function joinRoom() {
    playerName = playerNameInput.value.trim();
    const roomIdToJoin = roomIdInput.value.trim().toUpperCase();
    
    if (!playerName) {
        alert('请输入你的名字');
        return;
    }
    
    if (!roomIdToJoin) {
        alert('请输入房间ID');
        return;
    }
    
    socket.emit('joinRoom', { roomId: roomIdToJoin, playerName });
    roomId = roomIdToJoin;
    roomIdDisplay.textContent = roomId;
    
    // 隐藏大厅，显示游戏界面
    lobbyElement.style.display = 'none';
    gameElement.style.display = 'block';
    
    updateStatusText(`加入房间${roomId}成功，等待游戏开始...`);
    
    // 延迟测试IM连通性，确保IM已经初始化
    setTimeout(() => {
        testIMConnectivity();
    }, 1000);
}

// 更新房间列表
function updateRoomList(rooms) {
    roomListElement.innerHTML = '';
    
    if (rooms.length === 0) {
        const li = document.createElement('li');
        li.textContent = '暂无可用房间';
        li.style.textAlign = 'center';
        li.style.cursor = 'default';
        li.style.backgroundColor = '#f8f9fa';
        li.style.color = '#6c757d';
        li.onmouseenter = () => {
            li.style.transform = 'none';
            li.style.backgroundColor = '#f8f9fa';
        };
        roomListElement.appendChild(li);
        return;
    }
    
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="room-id">${room.roomId}</span>
            <span class="room-players">${room.players}/2 玩家</span>
        `;
        
        li.addEventListener('click', () => {
            roomIdInput.value = room.roomId;
        });
        
        roomListElement.appendChild(li);
    });
}

// 渲染棋盘
function renderBoard() {
    // 清空棋盘
    boardElement.innerHTML = '';
    
    // 创建棋子
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // 添加棋子
            if (board[row][col] !== EMPTY) {
                const disc = document.createElement('div');
                disc.className = `disc ${board[row][col] === BLACK ? 'black' : 'white'}`;
                cell.appendChild(disc);
            } else {
                // 检查是否为当前玩家的回合
                if (currentPlayer === playerColor && !gameOver) {
                    cell.addEventListener('click', handleCellClick);
                }
            }
            
            boardElement.appendChild(cell);
        }
    }
}

// 处理单元格点击
function handleCellClick(e) {
    if (gameOver) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    // 检查是否为当前玩家的回合
    if (currentPlayer !== playerColor) {
        updateStatusText('不是你的回合');
        return;
    }
    
    // 发送移动请求到服务器
    socket.emit('makeMove', { roomId, row, col });
}

// 请求重新开始游戏
function requestRestart() {
    if (hasPendingRequest) return;
    hasPendingRequest = true;
    socket.emit('requestRestart', roomId);
    updateStatusText('请求重新开始游戏，等待对手确认...');
}

// 切换暂停/恢复状态
function togglePause() {
    if (hasPendingRequest) return;
    hasPendingRequest = true;
    if (paused) {
        socket.emit('requestResume', roomId);
        updateStatusText('请求恢复游戏，等待对手确认...');
    } else {
        socket.emit('requestPause', roomId);
        updateStatusText('请求暂停游戏，等待对手确认...');
    }
}

// 请求暂停游戏（保留原函数，用于兼容性）
function requestPause() {
    if (hasPendingRequest) return;
    hasPendingRequest = true;
    socket.emit('requestPause', roomId);
    updateStatusText('请求暂停游戏，等待对手确认...');
}

// 请求认输
function resignGame() {
    if (hasPendingRequest) return;
    hasPendingRequest = true;
    socket.emit('requestResign', roomId);
    updateStatusText('请求认输，等待对手确认...');
}

// 返回大厅
function goBackToLobby() {
    // 隐藏游戏界面，显示大厅界面，使用flex布局确保居中
    gameElement.style.display = 'none';
    lobbyElement.style.display = 'flex';
    
    // 重置游戏状态
    playerColor = undefined;
    currentPlayer = undefined;
    board = undefined;
    gameOver = false;
    paused = false;
    hasPendingRequest = false;
    
    // 离开当前房间
    socket.emit('leaveRoom', roomId);
    roomId = undefined;
    
    // 重置按钮状态
    pauseBtn.textContent = '暂停';
    pauseBtn.style.display = 'none';
    resignBtn.disabled = false;
    resignBtn.style.display = 'none';
    restartBtn.style.display = 'none';
    startGameBtn.style.display = 'none';
    
    // 启用返回大厅按钮
    backBtn.disabled = false;
    
    // 重置大厅相关元素，保留玩家名字
    // playerNameInput.value = ''; // 保留玩家名字
    roomIdInput.value = ''; // 重置房间ID输入框
    roomListElement.innerHTML = ''; // 清空房间列表
    
    // 更新状态文本
    updateStatusText('');
    
    // 重新获取房间列表
    socket.emit('getRoomList');
}

// 请求开始游戏
function requestStartGame() {
    console.log('requestStartGame called, hasPendingRequest:', hasPendingRequest, 'roomId:', roomId);
    if (hasPendingRequest) return;
    hasPendingRequest = true;
    console.log('Emitting requestStartGame with roomId:', roomId);
    socket.emit('requestStartGame', roomId);
    updateStatusText('请求开始游戏，等待对手确认...');
    console.log('Status text updated, waiting for opponent confirmation');
}

// 更新UI
function updateUI() {
    // 更新当前玩家指示器
    currentPlayerIndicator.style.backgroundColor = currentPlayer === BLACK ? '#000' : '#fff';
    currentPlayerIndicator.style.border = currentPlayer === WHITE ? '1px solid #ccc' : 'none';
}

// 更新状态文本
function updateStatusText(text) {
    statusTextElement.textContent = text;
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', initGame);