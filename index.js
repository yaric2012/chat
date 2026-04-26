const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());

// ПУТИ К ФАЙЛАМ ХРАНЕНИЯ
const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');

// Функции для работы с данными
function loadData(file, defaultData) {
    try {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) { console.error('Load Error: ' + file); }
    return defaultData;
}

function saveData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) { console.error('Save Error: ' + file); }
}

let users = loadData(USERS_FILE, {});
let messages = loadData(MSGS_FILE, []);

// --- ГЛАВНАЯ СТРАНИЦА (ДИЗАЙН И КЛИЕНТ) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>CHAT 1997 v2.3</title>
    <style>
        body { background: #000; color: #fff; font-family: monospace; margin: 0; display: flex; height: 100vh; overflow: hidden; }
        #auth-screen { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; padding: 20px; text-align: center; border: 4px double #fff; box-sizing: border-box; }
        #sidebar { width: 160px; border-right: 1px solid #fff; display: flex; flex-direction: column; padding: 10px; flex-shrink: 0; background: #0a0a0a; }
        #chat-area { flex-grow: 1; display: flex; flex-direction: column; padding: 10px; min-width: 0; }
        #messages { flex-grow: 1; overflow-y: auto; border: 1px solid #fff; margin-bottom: 10px; padding: 10px; font-size: 13px; background: #050505; }
        input, button { background: #000; color: #fff; border: 1px solid #fff; padding: 10px; margin: 5px 0; outline: none; font-family: monospace; }
        button { background: #fff; color: #000; cursor: pointer; font-weight: bold; text-transform: uppercase; }
        .friend-item { cursor: pointer; padding: 8px; border: 1px solid #333; margin-bottom: 5px; font-size: 12px; }
        .active-chat { background: #fff !important; color: #000 !important; }
        .req-item { border: 1px dashed #fff; padding: 5px; margin-bottom: 8px; font-size: 10px; }
        .msg-line { margin-bottom: 6px; border-bottom: 1px solid #1a1a1a; padding-bottom: 4px; word-wrap: break-word; }
        @media (max-width: 500px) { #sidebar { width: 100px; font-size: 10px; } }
    </style>
</head>
<body>
    <div id="auth-screen">
        <h1 style="margin:0;">[ CHAT 1997 ]</h1>
        <p style="color:#555;">STORAGE: LOCAL_DISK</p>
        <input type="text" id="nick" placeholder="LOGIN" maxlength="12">
        <input type="password" id="pass" placeholder="PASSWORD">
        <button onclick="auth()" style="width: 160px;">CONNECT</button>
    </div>

    <div id="sidebar">
        <div class="friend-item active-chat" id="target-global" onclick="switchChat('global')"># GLOBAL</div>
        <p style="font-size:9px; color:#555; margin:10px 0 5px 0;">CONTACTS:</p>
        <div id="friend-list"></div>
        <hr style="width:100%; border:0; border-top:1px solid #333; margin:10px 0;">
        <input type="text" id="search-nick" placeholder="SEARCH..." style="width:calc(100% - 22px); font-size:10px;">
        <button onclick="addFriend()" style="font-size:9px; width:100%;">ADD</button>
        <div id="request-list"></div>
    </div>

    <div id="chat-area">
        <div id="chat-title" style="font-weight:bold; margin-bottom:10px; border-bottom:1px solid #fff;"># GLOBAL</div>
        <div id="messages"></div>
        <div style="display:flex; gap:5px">
            <input type="text" id="m" style="flex-grow:1" placeholder="TYPE..." autocomplete="off">
            <button onclick="send()">OK</button>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let myNick = '', currentChat = 'global';

        async function auth() {
            const username = document.getElementById('nick').value.trim();
            const password = document.getElementById('pass').value;
            if(!username || !password) return;

            const res = await fetch('/auth', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, password })
            });
            
            if (res.ok) {
                myNick = username;
                document.getElementById('auth-screen').style.display = 'none';
                socket.emit('join', myNick);
                refreshUI();
                setInterval(refreshUI, 5000);
            } else { alert('ACCESS DENIED: INCORRECT PASS'); }
        }

        async function refreshUI() {
            const res = await fetch('/user/' + myNick);
            if(!res.ok) return;
            const user = await res.json();
            
            const fl = document.getElementById('friend-list');
            fl.innerHTML = '';
            user.friends.forEach(f => {
                const div = document.createElement('div');
                div.className = 'friend-item' + (currentChat === f ? ' active-chat' : '');
                div.innerText = '@' + f;
                div.onclick = () => switchChat(f);
                fl.appendChild(div);
            });

            const rl = document.getElementById('request-list');
            rl.innerHTML = user.requests.length ? '<p style="font-size:9px;color:gray;">REQ:</p>' : '';
            user.requests.forEach(r => {
                const div = document.createElement('div');
                div.className = 'req-item';
                div.innerHTML = \`\${r} <button onclick="accept('\${r}')" style="padding:2px; font-size:9px;">OK</button>\`;
                rl.appendChild(div);
            });
        }

        function switchChat(target) {
            currentChat = target;
            document.getElementById('chat-title').innerText = target === 'global' ? '# GLOBAL' : '@ ' + target;
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active-chat'));
            if(target === 'global') document.getElementById('target-global').classList.add('active-chat');
            loadHistory();
        }

        async function addFriend() {
            const targetNick = document.getElementById('search-nick').value.trim();
            if(!targetNick || targetNick === myNick) return;
            await fetch('/add-friend', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ myNick, targetNick })
            });
            document.getElementById('search-nick').value = '';
            alert('REQUEST SENT');
        }

        async function accept(targetNick) {
            await fetch('/accept-friend', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ myNick, targetNick })
            });
            refreshUI();
        }

        async function loadHistory() {
            const res = await fetch(\`/history/\${myNick}/\${currentChat}\`);
            const msgs = await res.json();
            const box = document.getElementById('messages');
            box.innerHTML = msgs.map(m => \`<div class="msg-line"><b>\${m.from}:</b> \${m.text}</div>\`).join('');
            box.scrollTop = box.scrollHeight;
        }

        function send() {
            const i = document.getElementById('m');
            if(!i.value.trim()) return;
            socket.emit('msg', { to: currentChat, text: i.value.trim() });
            i.value = '';
        }

        socket.on('msg', (data) => {
            const isGlobal = data.to === 'global' && currentChat === 'global';
            const isPrivate = (data.to === myNick && data.from === currentChat) || (data.from === myNick && data.to === currentChat);
            if (isGlobal || isPrivate) {
                const box = document.getElementById('messages');
                box.innerHTML += \`<div class="msg-line"><b>\${data.from}:</b> \${data.text}</div>\`;
                box.scrollTop = box.scrollHeight;
            }
        });
        document.getElementById('m').onkeypress = (e) => { if(e.key === 'Enter') send() };
    </script>
</body>
</html>
    `);
});

// --- API ---
app.post('/auth', (req, res) => {
    const { username, password } = req.body;
    if (!users[username]) {
        users[username] = { password, friends: [], requests: [] };
        saveData(USERS_FILE, users);
    } else if (users[username].password !== password) {
        return res.status(401).send();
    }
    res.json(users[username]);
});

app.get('/user/:nick', (req, res) => res.json(users[req.params.nick] || {friends:[], requests:[]}));

app.post('/add-friend', (req, res) => {
    const { myNick, targetNick } = req.body;
    if (users[targetNick] && !users[targetNick].friends.includes(myNick)) {
        if (!users[targetNick].requests.includes(myNick)) {
            users[targetNick].requests.push(myNick);
            saveData(USERS_FILE, users);
        }
    }
    res.send();
});

app.post('/accept-friend', (req, res) => {
    const { myNick, targetNick } = req.body;
    if (users[myNick] && users[targetNick]) {
        users[myNick].requests = users[myNick].requests.filter(n => n !== targetNick);
        if(!users[myNick].friends.includes(targetNick)) users[myNick].friends.push(targetNick);
        if(!users[targetNick].friends.includes(myNick)) users[targetNick].friends.push(myNick);
        saveData(USERS_FILE, users);
    }
    res.send();
});

app.get('/history/:me/:target', (req, res) => {
    const { me, target } = req.params;
    let filtered = messages.filter(m => 
        target === 'global' ? m.to === 'global' : 
        (m.from === me && m.to === target) || (m.from === target && m.to === me)
    );
    res.json(filtered.slice(-50));
});

io.on('connection', (socket) => {
    socket.on('join', (nick) => { socket.join(nick); socket.nick = nick; });
    socket.on('msg', (data) => {
        if(!socket.nick || !data.text) return;
        const newMsg = { from: socket.nick, to: data.to, text: data.text.substring(0, 1000) };
        messages.push(newMsg);
        if (messages.length > 500) messages.shift();
        saveData(MSGS_FILE, messages);
        
        if (data.to === 'global') io.emit('msg', newMsg);
        else io.to(data.to).to(socket.nick).emit('msg', newMsg);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log('v2.3 FS LIVE'));
