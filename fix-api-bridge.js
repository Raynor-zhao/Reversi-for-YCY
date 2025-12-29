const fs = require('fs');
const path = require('path');

// 指向API-bridge的server.js文件
const file = path.join('D:\GIT\API-bridge', 'server.js');
const content = fs.readFileSync(file, 'utf8');

// 修复STATE_FILE路径
const newContent = content.replace(/const STATE_FILE = path\.resolve\(__dirname, '\.\.', 'state\.json'\)/g, "const STATE_FILE = path.resolve(__dirname, 'state.json')");

fs.writeFileSync(file, newContent, 'utf8');
console.log('Fixed STATE_FILE path successfully!');