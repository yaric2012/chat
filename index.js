const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- НАСТРОЙКИ SUPABASE ---
const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_KEY = 'sb_publishable_-H6KAVzkf8O0Xk9Oao2JUA_6AygHQtP';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let db = { users: {}, messages: [] };

async function loadCloudData() {
    try {
        const { data, error } = await supabase.from('Basedate').select('content').eq('id', 1).single();
        if (data && data.content) {
            db = data.content;
            if (!db.users) db.users = {};
            if (!db.messages) db.messages = [];
        }
    } catch (e) { console.error("Load error:", e); }
}

async function saveCloudData() {
    try { await supabase.from('Basedate').update({ content: db }).eq('id', 1); } catch (e) { console.error("Save error:", e); }
}

app.use(express.json());

// --- НОВЫЙ ДИЗАЙН APPLE GLASS ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Chat Apple Glass</title>
    <style>
        :root { --glass: rgba(255, 255, 255, 0.1); --border: rgba(255, 255, 255, 0.2); }
        body { 
            background: radial-gradient(circle at top left, #1a1a1a, #000); 
            color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; display: flex; height: 100vh; overflow: hidden; 
            justify-content: center; align-items: center;
        }
        
        /* Эффект капли при появлении */
        @keyframes liquidIn {
            0% { transform: scale(0.5); opacity: 0; filter: blur(20px); }
            60% { transform: scale(1.05); filter: blur(0px); }
            100% { transform: scale(1); opacity: 1; }
        }

        #auth-screen {
            position: fixed; inset: 0; background: rgba(0,0,0,0.8);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 100; backdrop-filter: blur(15px);
        }

        .glass-card {
            background: var(--glass); backdrop-filter: blur(20px);
            border: 1px solid var(--border); border-radius: 30px;
            padding: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            animation: liquidIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .main-container {
            display: none; width: 95vw; height: 92vh; gap: 15px; padding: 15px;
            box-sizing: border-box;
        }

        #sidebar {
            width: 260px; background: var(--glass); backdrop-filter: blur(25px);
            border-radius: 28px; border: 1px solid var(--border);
            display: flex; flex-direction: column; padding: 20px;
            animation: liquidIn 0.8s 0.2s both;
        }

        #chat-area {
            flex-grow: 1; display: flex; flex-direction: column; gap: 15px;
            animation: liquidIn 0.8s 0.4s both;
        }

        #messages {
            flex-grow: 1; background: var(--glass); backdrop-filter: blur(20px);
            border-radius: 28px; border: 1px solid var(--border);
            padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
        }

        .msg-bubble {
            background: rgba(255,255,255,0.05); padding: 12px 18px;
            border-radius: 18px; max-width: 80%; align-self: flex-start;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .msg-bubble.own { align-self: flex-end; background: #fff; color: #000; }

        input {
            background: rgba(255,255,255,0.08); border: 1px solid var(--border);
            border-radius: 20px; padding: 15px; color: #fff; outline: none;
            transition: 0.3s; font-size: 16px; margin-bottom: 10px;
        }
        input:focus { background: rgba(255,255,255,0.15); border-color: #fff; }

        button {
            background: #fff; color: #000; border: none; border-radius: 20px;
            padding: 15px; font-weight: 600; cursor: pointer; transition: 0.3s;
        }
        button:hover { transform: scale(1.02); background: #eee; }

        .friend-item {
            padding: 12px; margin-bottom: 8px; border-radius: 15px;
            cursor: pointer; transition: 0.2s; background: rgba(255,255,255,0.03);
        }
        .friend-item.active { background: #fff; color: #000; }
    </style>
</head>
<body>
    <div id="auth-screen">
        <div class="glass-card" style="width: 300px;">
            <h2 style="text-align: center; margin-top: 0;">Connect</h2>
            <input type="text" id="nick" placeholder="Username" style="width: 100%; box-sizing: border-box;">
            <input type="password" id="pass" placeholder="Password" style="width: 100%; box-sizing: border-box;">
            <button onclick="auth()" style="width: 100%;">Войти</button>
        </div>
    </div>

    <div class="main-container" id="main-ui">
        <div id="sidebar">
            <div class="friend-item active" id="t-global" onclick="switchChat('global')">🌏 Глобальный</div>
            <div id="friend-list"></div>
            <div style="margin-top: auto;">
                <input type="text" id="snick" placeholder="Поиск никнейма..." style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 10px;">
                <button onclick="addF()" style="width: 100%; padding: 10px; font-size: 12px;">Добавить</button>
                <div id="request-list"></div>
            </div>
        </div>

        <div id="chat-area">
            <div id="messages"></div>
            <div style="display:flex; gap:10px; background: var(--glass); padding: 10px; border-radius: 25px; border: 1px solid var(--border); backdrop-filter: blur(10px);">
                <input type="text" id="m" style="flex-grow:1; margin-bottom: 0; border: none; background: transparent;" placeholder="Написать сообщение...">
                <button onclick="send()" style="width: 60px; padding: 10px;">OK</button>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io(); let myNick = '', currentChat = 'global';

        async function auth() {
            const username = document.getElementById('nick').value.trim();
            const password = document.getElementById('pass').value;
            const res = await fetch('/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password}) });
            if (res.ok) {
                myNick = username;
                document.getElementById('auth-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('auth-screen').style.display = 'none';
                    document.getElementById('main-ui').style.display = 'flex';
                }, 500);
                socket.emit('join', myNick); refreshUI(); setInterval(refreshUI, 5000);
            } else { alert('Ошибка доступа'); }
        }

        async function refreshUI() {
            const res = await fetch('/user/' + myNick); if(!res.ok) return;
            const user = await res.json();
            const fl = document.getElementById('friend-list'); fl.innerHTML = '';
            (user.friends || []).forEach(f => {
                const div = document.createElement('div'); div.className = 'friend-item' + (currentChat === f ? ' active' : '');
                div.innerText = '👤 ' + f; div.onclick = () => switchChat(f); fl.appendChild(div);
            });
            const rl = document.getElementById('request-list'); rl.innerHTML = '';
            (user.requests || []).forEach(r => {
                rl.innerHTML += \`<div style="font-size:11px; padding:10px;">\${r} <button onclick="accept('\${r}')" style="padding:5px; border-radius:10px;">OK</button></div>\`;
            });
        }

        function switchChat(t) { 
            currentChat = t; 
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
            if(t === 'global') document.getElementById('t-global').classList.add('active');
            loadH(); 
        }

        async function loadH() {
            const res = await fetch(\`/history/\${myNick}/\${currentChat}\`); const msgs = await res.json();
            document.getElementById('messages').innerHTML = msgs.map(m => \`
                <div class="msg-bubble \${m.from === myNick ? 'own' : ''}">
                    <div style="font-size: 10px; opacity: 0.6; margin-bottom: 4px;">\${m.from}</div>
                    \${m.text}
                </div>\`).join('');
            const box = document.getElementById('messages'); box.scrollTop = box.scrollHeight;
        }

        function send() { const i = document.getElementById('m'); if(!i.value.trim()) return; socket.emit('msg', {to:currentChat, text:i.value}); i.value=''; }
        socket.on('msg', () => loadH());
        document.getElementById('m').onkeypress = (e) => { if(e.key==='Enter') send() };

        async function addF() { const t = document.getElementById('snick').value.trim(); await fetch('/add-friend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myNick, targetNick:t}) }); alert('Запрос отправлен'); }
        async function accept(t) { await fetch('/accept-friend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myNick, targetNick:t}) }); refreshUI(); }
    </script>
</body>
</html>
    `);
});

// --- API (ОСТАВЬ КАК В ПРОШЛОМ КОДЕ) ---
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

async function init() {
    await loadCloudData();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => console.log('LOG: v6.0 Apple Glass LIVE'));
}
init();
