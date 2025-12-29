const fs = require('fs');
const path = require('path');

// 修复server.js文件中所有包含乱码的行
const serverFilePath = path.join('D:\\GIT\\API-bridge', 'server.js');

fs.readFile(serverFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('读取文件失败:', err);
    return;
  }

  // 修复特定的乱码模式，避免影响正常代码
  let fixedData = data;
  
  // 修复已知的乱码模式，只替换特定的乱码字符串
  fixedData = fixedData.replace(/锟?IM SDK 灏辩华/g, 'IM SDK 就绪');
  fixedData = fixedData.replace(/锟?IM SDK 鏈氨锟?/g, 'IM SDK 未就绪');
  fixedData = fixedData.replace(/锟?IM 琚涪涓嬬嚎锟?绉掑悗閲嶈繛/g, 'IM 被踢下线，稍后重连');
  fixedData = fixedData.replace(/锟?IM 瀹㈡埛绔垵濮嬪寲鎴愬姛/g, 'IM 客户端初始化成功');
  fixedData = fixedData.replace(/锟?IM 鍒濆鍖栧け锟?/g, 'IM 初始化失败');
  fixedData = fixedData.replace(/锟?IM 鐧诲綍鎴愬姛/g, 'IM 登录成功');
  fixedData = fixedData.replace(/锟?IM 鐧诲綍澶辫触/g, 'IM 登录失败');
  fixedData = fixedData.replace(/锟?鑾峰彇 IM 绛惧悕鎴愬姛/g, '获取 IM 签名成功');
  fixedData = fixedData.replace(/锟?鑾峰彇 IM 绛惧悕澶辫触/g, '获取 IM 签名失败');
  fixedData = fixedData.replace(/锟?鎸囦护鍙戦€佹垚锟?/g, '命令发送成功');
  fixedData = fixedData.replace(/锟?鎸囦护鍙戦€佸け锟?/g, '命令发送失败');
  fixedData = fixedData.replace(/鐧诲綍鐢ㄦ埛/g, '登录用户');
  fixedData = fixedData.replace(/骞挎挱鐘舵€佸彉锟?/g, '广播状态变化');
  fixedData = fixedData.replace(/骞挎挱琚涪涓嬬嚎浜嬩欢/g, '广播被踢下线事件');
  fixedData = fixedData.replace(/缃戠粶鐘舵€佸彉锟?/g, '网络状态变化');
  fixedData = fixedData.replace(/骞挎挱缃戠粶鐘舵€佸彉锟?/g, '广播网络状态变化');
  fixedData = fixedData.replace(/鏀跺埌娑堟伅/g, '收到消息');
  fixedData = fixedData.replace(/骞挎挱鏀跺埌鐨勬秷锟?/g, '广播收到的消息');
  fixedData = fixedData.replace(/IM 閿欒/g, 'IM 错误');
  fixedData = fixedData.replace(/姝ｅ湪鐧诲綍 IM/g, '正在登录 IM');
  fixedData = fixedData.replace(/閲嶅鐧诲綍/g, '重复登录');
  fixedData = fixedData.replace(/绛夊緟 SDK 灏辩华/g, '等待 SDK 就绪');
  fixedData = fixedData.replace(/绛夊緟 SDK_READY 瓒呮椂/g, '等待 SDK_READY 超时');
  fixedData = fixedData.replace(/鍙戦€佹秷锟?/g, '发送消息');
  fixedData = fixedData.replace(/鍒涘缓鏂囨湰娑堟伅/g, '创建文本消息');
  fixedData = fixedData.replace(/鍙戦€佸け锟?/g, '发送失败');
  fixedData = fixedData.replace(/鍋ュ悍妫€锟?/g, '健康检查');
  fixedData = fixedData.replace(/鑾峰彇鐘讹拷?/g, '获取状态');
  fixedData = fixedData.replace(/鍙戦€佹寚锟?/g, '发送命令');
  fixedData = fixedData.replace(/缂哄皯 commandId 鍙傛暟/g, '缺少 commandId 参数');
  fixedData = fixedData.replace(/IM 鏈氨锟?/g, 'IM 未就绪');
  fixedData = fixedData.replace(/閲嶆柊鍒濆锟?/g, '重新初始化');
  fixedData = fixedData.replace(/鏀跺埌閲嶆柊鍒濆鍖栬锟?/g, '收到重新初始化请求');
  fixedData = fixedData.replace(/IM 閲嶆柊鍒濆鍖栨垚锟?/g, 'IM 重新初始化成功');
  fixedData = fixedData.replace(/IM 閲嶆柊鍒濆鍖栧け锟?/g, 'IM 重新初始化失败');
  fixedData = fixedData.replace(/浣跨敤鑷畾涔夊嚟璇佺櫥锟?/g, '使用自定义凭证登录');
  fixedData = fixedData.replace(/鏀跺埌鐧诲綍璇锋眰/g, '收到登录请求');
  fixedData = fixedData.replace(/浣跨敤鑷畾涔夊嚟锟?/g, '使用自定义凭证');
  fixedData = fixedData.replace(/鑾峰彇 IM 绛惧悕澶辫触/g, '获取 IM 签名失败');
  fixedData = fixedData.replace(/閿€姣佹棫瀹炰緥/g, '销毁旧实例');
  fixedData = fixedData.replace(/鍒涘缓 IM 瀹炰緥/g, '创建 IM 实例');
  fixedData = fixedData.replace(/璁剧疆鏃ュ織绾у埆/g, '设置日志级别');
  fixedData = fixedData.replace(/娉ㄥ唽浜嬩欢鐩戝惉/g, '注册事件监听');
  fixedData = fixedData.replace(/閿€姣佹棫瀹炰緥澶辫触/g, '销毁旧实例失败');
  fixedData = fixedData.replace(/WebSocket 鏀跺埌娑堟伅/g, 'WebSocket 收到消息');
  fixedData = fixedData.replace(/蹇冭烦鍝嶅簲/g, '心跳响应');
  fixedData = fixedData.replace(/鏈煡鐨勬秷鎭被锟?/g, '未知的消息类型');
  fixedData = fixedData.replace(/娑堟伅鏍煎紡閿欒/g, '消息格式错误');
  fixedData = fixedData.replace(/WebSocket 瀹㈡埛绔繛锟?/g, 'WebSocket 客户端连接');
  fixedData = fixedData.replace(/娣诲姞鍒板鎴风闆嗗悎/g, '添加到客户端集合');
  fixedData = fixedData.replace(/鍙戦€佹杩庢秷锟?/g, '发送欢迎消息');
  fixedData = fixedData.replace(/WebSocket 閿欒/g, 'WebSocket 错误');
  fixedData = fixedData.replace(/WebSocket 瀹㈡埛绔柇寮€/g, 'WebSocket 客户端断开');
  fixedData = fixedData.replace(/鍚姩鏈嶅姟锟?/g, '启动服务器');
  fixedData = fixedData.replace(/CS2 IM 鏈嶅姟宸插惎锟?/g, 'CS2 IM 服务已启动');
  fixedData = fixedData.replace(/HTTP 鏈嶅姟/g, 'HTTP 服务');
  fixedData = fixedData.replace(/WebSocket 鏈嶅姟/g, 'WebSocket 服务');
  fixedData = fixedData.replace(/蹇冭烦/g, '心跳');
  fixedData = fixedData.replace(/杩炴帴姝ｅ父/g, '连接正常');
  fixedData = fixedData.replace(/鍚戞墍锟?WebSocket 瀹㈡埛绔彂閫佸績锟?/g, '向所有 WebSocket 客户端发送心跳');
  fixedData = fixedData.replace(/姝ｅ湪鍏抽棴鏈嶅姟/g, '正在关闭服务');
  fixedData = fixedData.replace(/IM 瀹㈡埛绔凡鍏抽棴/g, 'IM 客户端已关闭');
  fixedData = fixedData.replace(/鍏抽棴 IM 瀹㈡埛绔け锟?/g, '关闭 IM 客户端失败');
  fixedData = fixedData.replace(/鍔犺浇閰嶇疆/g, '加载配置');
  fixedData = fixedData.replace(/state.json 缂哄皯 uid 锟?token/g, 'state.json 缺少 uid 或 token');
  fixedData = fixedData.replace(/宸插姞杞介厤锟?/g, '已加载配置');
  fixedData = fixedData.replace(/澶勭悊 UID 鏍煎紡/g, '处理 UID 格式');
  fixedData = fixedData.replace(/鍔犺浇閰嶇疆澶辫触/g, '加载配置失败');
  fixedData = fixedData.replace(/鑾峰彇绛惧悕澶辫触锛屾棤娉曞垵濮嬪寲 IM/g, '获取签名失败，无法初始化 IM');
  fixedData = fixedData.replace(/閰嶇疆鍔犺浇澶辫触锛屾棤娉曞垵濮嬪寲 IM/g, '配置加载失败，无法初始化 IM');
  fixedData = fixedData.replace(/鑾峰彇绛惧悕/g, '获取签名');
  fixedData = fixedData.replace(/姝ｅ湪鍒濆锟?IM 瀹㈡埛锟?/g, '正在初始化 IM 客户端');
  
  // 修复特定行的编码问题
  fixedData = fixedData.replace(/\?IM SDK 未就\?/g, 'IM SDK 未就绪');
  fixedData = fixedData.replace(/📩 收到消息:.+?\?/g, '📩 收到消息:');
  
  // 写回修复后的文件
  fs.writeFile(serverFilePath, fixedData, 'utf8', (err) => {
    if (err) {
      console.error('写入文件失败:', err);
      return;
    }
    console.log('修复了文件的编码问题');
  });
});
