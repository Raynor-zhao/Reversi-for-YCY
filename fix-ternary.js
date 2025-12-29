const fs = require('fs');
const path = require('path');

// 修复server.js文件中的三元运算符语法错误
const serverFilePath = path.join('D:\\GIT\\API-bridge', 'server.js');

fs.readFile(serverFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('读取文件失败:', err);
    return;
  }

  // 将所有"条"替换回问号，修复三元运算符语法
  let fixedData = data.replace(/鏉?/g, '?');
  
  // 写回修复后的文件
  fs.writeFile(serverFilePath, fixedData, 'utf8', (err) => {
    if (err) {
      console.error('写入文件失败:', err);
      return;
    }
    console.log('修复了三元运算符的语法错误');
  });
});
