const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Ссылка на твою базу в Firebase
const DB_URL = "https://firebaseio.com";

let db = { users: {}, messages: [] };

// Загрузка данных из облака при старте сервера
async function loadData() {
    try {
        const res = await axios.get(DB_URL);
        if (res.data) {
            db = res.data;
            if (!db.users) db.users = {};
            if (!db.messages) db.messages = [];
            console.log("Данные успешно загружены из Firebase");
        }
    } catch (e) {
        console.log("База пуста или ошибка подключения, начинаем с чистого листа");
    }
}
loadData();

// Функция сохранения в облако
async function saveData() {
    try {
        await axios.put(DB_URL, db);
    } catch (e) {
        console.log("Ошибка сохранения в Firebase:", e.message);
    }
}

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CHAT 1997 v3.0 CLOUD</title>
    <style>
        body { background: #000; color: #fff; font-family: monospace; margin: 0; display: flex; height: 100vh; overflow: hidden; }
        #auth-screen { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; padding: 20px; text-align: center; border: 4px double #fff; }
        #sidebar { width: 160px; border-right: 1px solid #fff; display: flex; flex-direction: column; padding: 10px; flex-shrink: 0; background: #0a0a0a; }
        #chat-area { flex-grow: 1; display: flex; flex-direction: column; padding: 10px; min-width: 0; }
        #messages { flex-grow: 1; overflow-y: auto; border: 1px solid #fff; margin-bottom: 10px; padding: 10px; font-size: 13px; background: #050505; }
        input, button { background: #000; color: #fff; border: 1px solid #fff; padding: 10px; margin: 5px 0; outline: none; }
        button { background: #fff; color: #000; cursor: pointer; font-weight: bold; }
        .friend-item { cursor: pointer; padding: 8px; border: 1px solid #333; margin-bottom: 5px; font-size: 11px; }
        .active-chat { background: #fff !important; color: #000 !important; }
        .req-item { font-size: 10px; border: 1px dashed #fff; padding: 5px; margin-bottom: 8px; }
        .msg-line { margin-bottom: 6px; border-bottom: 1px solid #1a1a1a; padding-bottom: 4px; word-wrap: break-word; }
        @media (max-width: 500px) { #sidebar { width: 100px; } }
    </style>
</head>
<body>
    <div id="auth-screen">
        <h1>[ SYSTEM LOGIN ]</h1>
        <p style="color: #0f0;">CLOUD STORAGE: ACTIVE</p>
        <input type="text" id="nick" placeholder="LOGIN" maxlength="12">
        <input type="password" id="pass" placeholder="PASSWORD">
        <button onclick="auth()" style="width: 150px;">CONNECT</button>
    </div>

    <div id="sidebar">
        <div class="friend-item active-chat" id="t-global" onclick="switchChat('global')"># GLOBAL</div>
        <p style="font-size:9px; color:#555; margin:15px 0 5px 0;">FRIENDS:</p>
        <div id="friend-list"></div>
        <hr style="width:100%; border:1px solid #333; margin:10px 0;">
        <input type="text" id="snick" placeholder="NICK..." style="width:80%; font-size:10px;">
        <button onclick="addF()" style="font-size:9px;">ADD</button>
        <div id="request-list"></div>
    </div>

    <div id="chat-area">
        <div id="chat-title" style="font-weight:bold; border-bottom: 1px solid #fff; margin-bottom:10px;"># GLOBAL</div>
        <div id="messages"></div>
        <div style="display:flex; gap:5px">
            <input type="text" id="m" style="flex-grow:1" placeholder="MESSAGE..." autocomplete="off">
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
            if(!username) return;

            const res = await fetch('/auth', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, password })
            });
            
            if (res.ok) {
                myNick = username;
                document.getElementById('auth-screen').style.display = 'none';
                socket.emit('join', myNick);
                refresh();
                setInterval(refresh, 5000);
            } else { alert('ACCESS DENIED'); }
        }

        async function refresh() {
            const res = await fetch('/user/' + myNick);
            if(!res.ok) return;
            const user = await res.json();
            
            const fl = document.getElementById('flist');
            const friendBox = document.getElementById('friend-list');
            friendBox.innerHTML = '';
            (user.friends || []).forEach(f => {
                const div = document.createElement('div');
                div.className = 'friend-item' + (currentChat === f ? ' active-chat' : '');
                div.innerText = '@' + f;
                div.onclick = () => switchChat(f);
                friendBox.appendChild(div);
            });

            const rl = document.getElementById('request-list');
            rl.innerHTML = (user.requests || []).length ? '<p style="font-size:9px">REQS:</p>' : '';
            (user.requests || []).forEach(r => {
                const div = document.createElement('div');
                div.className = 'req-item';
                div.innerHTML = \`\${r} <button onclick="accept('\${r}')" style="font-size:9px; padding:2px;">OK</button>\`;
                rl.appendChild(div);
            });
        }

        function switchChat(target) {
            currentChat = target;
            document.getElementById('chat-title').innerText = target === 'global' ? '# GLOBAL' : '@ ' + target;
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active-chat'));
            if(target === 'global') document.getElementById('t-global').classList.add('active-chat');
            loadH();
        }

        async function addF() {
            const targetNick = document.getElementById('snick').value.trim();
            if(!targetNick || targetNick === myNick) return;
            await fetch('/add-friend', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ myNick, targetNick })
            });
            alert('REQUEST SENT');
        }

        async function accept(targetNick) {
            await fetch('/accept-friend', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ myNick, targetNick })
            });
            refresh();
        }

        async function loadH() {
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
            if (data.to === 'global' || data.to === myNick || data.from === myNick) loadH();
        });
        document.getElementById('m').onkeypress = (e) => { if(e.key === 'Enter') send() };
    </script>
</body>
</html>
    `);
});

// API ЭНДПОИНТЫ
app.post('/auth', async (req, res) => {
    const { username, password } = req.body;
    if (!db.users) db.users = {};
    if (!db.users[username]) {
        db.users[username] = { password, friends: [], requests: [] };
        await saveData();
    } else if (db.users[username].password !== password) {
        return res.status(401).send();
    }
    res.json(db.users[username]);
});

app.get('/user/:nick', (req, res) => res.json(db.users ? db.users[req.params.nick] : {friends:[], requests:[]}));

app.post('/add-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    if (db.users && db.users[targetNick]) {
        if (!db.users[targetNick].requests) db.users[targetNick].requests = [];
        if (!db.users[targetNick].requests.includes(myNick)) {
            db.users[targetNick].requests.push(myNick);
            await saveData();
        }
    }
    res.send();
});

app.post('/accept-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    if (!db.users[myNick].friends) db.users[myNick].friends = [];
    if (!db.users[targetNick].friends) db.users[targetNick].friends = [];
    db.users[myNick].requests = (db.users[myNick].requests || []).filter(n => n !== targetNick);
    db.users[myNick].friends.push(targetNick);
    db.users[targetNick].friends.push(myNick);
    await saveData();
    res.send();
});

app.get('/history/:me/:target', (req, res) => {
    const { me, target } = req.params;
    let f = (db.messages || []).filter(m => target === 'global' ? m.to === 'global' : (m.from === me && m.to === target) || (m.from === target && m.to === me));
    res.json(f.slice(-50));
});

io.on('connection', (socket) => {
    socket.on('join', (n) => { socket.join(n); socket.nick = n; });
    socket.on('msg', async (d) => {
        if(!socket.nick) return;
        if (!db.messages) db.messages = [];
        const m = { from: socket.nick, to: d.to, text: d.text };
        db.messages.push(m);
        if (db.messages.length > 300) db.messages.shift();
        await saveData();
        if (d.to === 'global') io.emit('msg', m);
        else io.to(d.to).to(socket.nick).emit('msg', m);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log('v3.0 LIVE'));
