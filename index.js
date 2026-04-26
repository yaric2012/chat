const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- ДАННЫЕ SUPABASE ---
const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_KEY = 'sb_publishable_-H6KAVzkf8O0Xk9Oao2JUA_6AygHQtP';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let db = { users: {}, messages: [] };

// Функция загрузки: ждем её завершения перед стартом сервера
async function loadCloudData() {
    console.log("LOG: Попытка загрузки данных из Supabase...");
    try {
        const { data, error } = await supabase
            .from('storage')
            .select('content')
            .eq('id', 1)
            .single();

        if (error) {
            console.error("LOG: Ошибка при чтении из Supabase:", error.message);
            return;
        }

        if (data && data.content) {
            db = data.content;
            if (!db.users) db.users = {};
            if (!db.messages) db.messages = [];
            console.log("LOG: Данные успешно загружены из облака!");
        }
    } catch (e) {
        console.error("LOG: Критическая ошибка загрузки:", e);
    }
}

// Функция сохранения: отправляем текущий слепок db в облако
async function saveCloudData() {
    try {
        const { error } = await supabase
            .from('storage')
            .update({ content: db })
            .eq('id', 1);
        
        if (error) console.error("LOG: Ошибка сохранения:", error.message);
    } catch (e) {
        console.error("LOG: Не удалось сохранить данные:", e);
    }
}

app.use(express.json());

// --- ФРОНТЕНД ЧАТА ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Chat 1997 v5.1 Cloud</title>
    <style>
        body { background: #000; color: #fff; font-family: monospace; margin: 0; display: flex; height: 100vh; overflow: hidden; }
        #auth-screen { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; border: 4px double #fff; padding: 20px; box-sizing: border-box; }
        #sidebar { width: 160px; border-right: 1px solid #fff; display: flex; flex-direction: column; padding: 10px; flex-shrink: 0; background: #0a0a0a; }
        #chat-area { flex-grow: 1; display: flex; flex-direction: column; padding: 10px; min-width: 0; }
        #messages { flex-grow: 1; overflow-y: auto; border: 1px solid #fff; margin-bottom: 10px; padding: 10px; font-size: 13px; background: #050505; }
        input, button { background: #000; color: #fff; border: 1px solid #fff; padding: 10px; margin: 5px 0; outline: none; font-family: monospace; }
        button { background: #fff; color: #000; cursor: pointer; font-weight: bold; text-transform: uppercase; }
        .friend-item { cursor: pointer; padding: 8px; border: 1px solid #333; margin-bottom: 5px; font-size: 11px; }
        .active-chat { background: #fff !important; color: #000 !important; }
        .req-item { border: 1px dashed #fff; padding: 5px; margin-bottom: 8px; font-size: 10px; }
        .msg-line { margin-bottom: 6px; border-bottom: 1px solid #1a1a1a; padding-bottom: 4px; word-wrap: break-word; }
        @media (max-width: 500px) { #sidebar { width: 100px; font-size: 10px; } }
    </style>
</head>
<body>
    <div id="auth-screen">
        <h2 style="letter-spacing: 3px;">CHAT 1997 v5.1</h2>
        <p style="color: #0f0; font-size: 10px;">-- CLOUD SYNC: ENABLED --</p>
        <input type="text" id="nick" placeholder="NICKNAME" maxlength="12">
        <input type="password" id="pass" placeholder="PASSWORD">
        <button onclick="auth()" style="width: 150px;">LOGIN</button>
    </div>

    <div id="sidebar">
        <div class="friend-item active-chat" id="t-global" onclick="switchChat('global')"># GLOBAL</div>
        <div id="friend-list"></div>
        <hr style="width:100%; border:0; border-top:1px solid #333; margin:10px 0;">
        <input type="text" id="snick" placeholder="FIND..." style="width:calc(100% - 22px); font-size:10px;">
        <button onclick="addF()" style="font-size:9px; width:100%;">ADD</button>
        <div id="request-list"></div>
    </div>

    <div id="chat-area">
        <div id="chat-title" style="font-weight:bold; margin-bottom:10px; border-bottom:1px solid #fff;"># GLOBAL</div>
        <div id="messages"></div>
        <div style="display:flex; gap:5px"><input type="text" id="m" style="flex-grow:1" placeholder="TYPE..." autocomplete="off"><button onclick="send()">OK</button></div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io(); let myNick = '', currentChat = 'global';

        async function auth() {
            const username = document.getElementById('nick').value.trim();
            const password = document.getElementById('pass').value;
            if(!username || !password) return;
            const res = await fetch('/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password}) });
            if (res.ok) {
                myNick = username; document.getElementById('auth-screen').style.display = 'none';
                socket.emit('join', myNick); refreshUI(); setInterval(refreshUI, 5000);
            } else { alert('WRONG PASSWORD OR ACCESS DENIED'); }
        }

        async function refreshUI() {
            const res = await fetch('/user/' + myNick); if(!res.ok) return;
            const user = await res.json();
            const fl = document.getElementById('friend-list'); fl.innerHTML = '';
            (user.friends || []).forEach(f => {
                const div = document.createElement('div'); div.className = 'friend-item' + (currentChat === f ? ' active-chat' : '');
                div.innerText = '@' + f; div.onclick = () => switchChat(f); fl.appendChild(div);
            });
            const rl = document.getElementById('request-list'); rl.innerHTML = (user.requests || []).length ? '<p style="font-size:9px">REQ:</p>' : '';
            (user.requests || []).forEach(r => {
                const div = document.createElement('div'); div.className = 'req-item';
                div.innerHTML = \`\${r} <button onclick="accept('\${r}')" style="font-size:9px; padding:2px;">OK</button>\`;
                rl.appendChild(div);
            });
        }

        function switchChat(t) { currentChat = t; document.getElementById('chat-title').innerText = t==='global'?'# GLOBAL':'@ '+t; loadH(); }
        async function addF() { const targetNick = document.getElementById('snick').value.trim(); await fetch('/add-friend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myNick, targetNick}) }); alert('SENT'); }
        async function accept(t) { await fetch('/accept-friend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myNick, targetNick:t}) }); refreshUI(); }
        
        async function loadH() {
            const res = await fetch(\`/history/\${myNick}/\${currentChat}\`); const msgs = await res.json();
            const box = document.getElementById('messages');
            box.innerHTML = msgs.map(m => \`<div class="msg-line"><b>\${m.from}:</b> \${m.text}</div>\`).join('');
            box.scrollTop = box.scrollHeight;
        }

        function send() { const i = document.getElementById('m'); if(!i.value.trim()) return; socket.emit('msg', {to:currentChat, text:i.value}); i.value=''; }
        socket.on('msg', (data) => { if (data.to === 'global' || data.to === myNick || data.from === myNick) loadH(); });
        document.getElementById('m').onkeypress = (e) => { if(e.key==='Enter') send() };
    </script>
</body>
</html>
    `);
});

// --- API ---
app.post('/auth', async (req, res) => {
    const { username, password } = req.body;
    if (!db.users[username]) {
        db.users[username] = { password, friends: [], requests: [] };
        await saveCloudData();
    } else if (db.users[username].password !== password) return res.status(401).send();
    res.json(db.users[username]);
});

app.get('/user/:nick', (req, res) => res.json(db.users[req.params.nick] || {friends:[], requests:[]}));

app.post('/add-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    if (db.users[targetNick]) {
        if (!db.users[targetNick].requests) db.users[targetNick].requests = [];
        if (!db.users[targetNick].requests.includes(myNick)) {
            db.users[targetNick].requests.push(myNick);
            await saveCloudData();
        }
    }
    res.send();
});

app.post('/accept-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    db.users[myNick].requests = (db.users[myNick].requests || []).filter(n => n !== targetNick);
    if(!db.users[myNick].friends) db.users[myNick].friends = [];
    if(!db.users[targetNick].friends) db.users[targetNick].friends = [];
    db.users[myNick].friends.push(targetNick);
    db.users[targetNick].friends.push(myNick);
    await saveCloudData();
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
        if(!socket.nick || !d.text) return;
        const m = { from: socket.nick, to: d.to, text: d.text };
        db.messages.push(m);
        if (db.messages.length > 500) db.messages.shift();
        await saveCloudData();
        if (d.to === 'global') io.emit('msg', m);
        else io.to(d.to).to(socket.nick).emit('msg', m);
    });
});

// Запуск после загрузки
async function init() {
    await loadCloudData();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => console.log('LOG: v5.1 CLOUD SERVER STARTED ON ' + PORT));
}
init();
