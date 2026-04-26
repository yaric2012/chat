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

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Chat Apple Glass</title>
    <style>
        :root { --glass: rgba(255, 255, 255, 0.1); --border: rgba(255, 255, 255, 0.15); }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        
        body { 
            background: radial-gradient(circle at top left, #2a2a2a, #000); 
            color: #fff; font-family: -apple-system, system-ui, sans-serif; 
            margin: 0; display: flex; height: 100dvh; overflow: hidden; 
            justify-content: center; align-items: center;
        }

        @keyframes liquidIn {
            0% { transform: scale(0.85); opacity: 0; filter: blur(10px); }
            100% { transform: scale(1); opacity: 1; filter: blur(0px); }
        }

        #auth-screen {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 1000; backdrop-filter: blur(20px); transition: 0.5s;
        }

        .glass-card {
            background: var(--glass); backdrop-filter: blur(25px);
            border: 1px solid var(--border); border-radius: 32px;
            padding: 24px; width: 90%; max-width: 320px;
            animation: liquidIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .main-container {
            display: none; width: 100%; height: 100%; gap: 12px; padding: 12px;
            position: relative;
        }

        #sidebar {
            width: 300px; background: var(--glass); backdrop-filter: blur(30px);
            border-radius: 28px; border: 1px solid var(--border);
            display: flex; flex-direction: column; padding: 16px;
            transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #chat-area {
            flex-grow: 1; display: flex; flex-direction: column; gap: 12px;
            transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #messages {
            flex-grow: 1; background: var(--glass); backdrop-filter: blur(25px);
            border-radius: 28px; border: 1px solid var(--border);
            padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
        }

        .msg-bubble {
            background: rgba(255,255,255,0.08); padding: 10px 14px;
            border-radius: 18px; max-width: 85%; align-self: flex-start;
            font-size: 15px; line-height: 1.4; border: 1px solid var(--border);
        }
        .msg-bubble.own { align-self: flex-end; background: #fff; color: #000; border: none; }

        input {
            background: rgba(255,255,255,0.1); border: 1px solid var(--border);
            border-radius: 18px; padding: 14px; color: #fff; outline: none;
            font-size: 16px; width: 100%;
        }
        
        button {
            background: #fff; color: #000; border: none; border-radius: 18px;
            padding: 14px; font-weight: 600; cursor: pointer; font-size: 15px;
        }

        .friend-item {
            padding: 14px; margin-bottom: 8px; border-radius: 16px;
            cursor: pointer; background: rgba(255,255,255,0.05);
            display: flex; align-items: center; gap: 10px;
        }
        .friend-item.active { background: #fff; color: #000; }

        /* МОБИЛЬНАЯ АДАПТАЦИЯ */
        @media (max-width: 768px) {
            .main-container { padding: 8px; gap: 0; }
            #sidebar { 
                position: absolute; width: calc(100% - 16px); height: calc(100% - 16px); 
                z-index: 10; left: 8px; 
            }
            #chat-area { position: absolute; width: calc(100% - 16px); height: calc(100% - 16px); left: 8px; transform: translateX(110%); }
            
            /* Классы для переключения экранов */
            body.chat-open #sidebar { transform: translateX(-110%); }
            body.chat-open #chat-area { transform: translateX(0); }
        }

        .back-btn { display: none; margin-bottom: 10px; background: transparent; color: #fff; border: 1px solid var(--border); width: fit-content; padding: 8px 15px; }
        @media (max-width: 768px) { .back-btn { display: block; } }
    </style>
</head>
<body id="body-tag">
    <div id="auth-screen">
        <div class="glass-card">
            <h2 style="text-align: center; margin: 0 0 20px 0;">Chat 1997</h2>
            <input type="text" id="nick" placeholder="Логин" autocomplete="off">
            <div style="height:10px"></div>
            <input type="password" id="pass" placeholder="Пароль">
            <div style="height:20px"></div>
            <button onclick="auth()" style="width: 100%;">Войти</button>
        </div>
    </div>

    <div class="main-container" id="main-ui">
        <div id="sidebar">
            <h3 style="margin: 0 0 15px 10px;">Чаты</h3>
            <div class="friend-item active" id="t-global" onclick="switchChat('global')">🌏 Глобальный</div>
            <div id="friend-list" style="overflow-y:auto; flex-grow:1;"></div>
            <div style="padding-top: 15px; border-top: 1px solid var(--border);">
                <input type="text" id="snick" placeholder="Поиск ника..." style="margin-bottom:8px; font-size:14px; padding:10px;">
                <button onclick="addF()" style="width: 100%; padding: 10px; font-size: 14px;">Добавить друга</button>
                <div id="request-list"></div>
            </div>
        </div>

        <div id="chat-area">
            <button class="back-btn" onclick="closeChat()">← Назад</button>
            <div id="messages"></div>
            <div style="display:flex; gap:8px; background: var(--glass); padding: 8px; border-radius: 24px; border: 1px solid var(--border); backdrop-filter: blur(15px);">
                <input type="text" id="m" style="flex-grow:1; border: none; background: transparent;" placeholder="Сообщение..." autocomplete="off">
                <button onclick="send()" style="width: 50px; border-radius: 18px;">OK</button>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io(); let myNick = '', currentChat = 'global';
        const body = document.getElementById('body-tag');

        async function auth() {
            const username = document.getElementById('nick').value.trim();
            const password = document.getElementById('pass').value;
            if(!username) return;
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
                rl.innerHTML += \`<div style="font-size:12px; padding:10px; background:rgba(255,255,0,0.1); border-radius:15px; margin-top:10px; border:1px solid rgba(255,255,0,0.2)">Запрос: \${r} <button onclick="accept('\${r}')" style="padding:4px 8px; border-radius:8px; font-size:10px;">OK</button></div>\`;
            });
        }

        function switchChat(t) { 
            currentChat = t; 
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
            if(t === 'global') document.getElementById('t-global').classList.add('active');
            if(window.innerWidth <= 768) body.classList.add('chat-open');
            loadH(); 
        }

        function closeChat() { body.classList.remove('chat-open'); }

        async function loadH() {
            const res = await fetch(\`/history/\${myNick}/\${currentChat}\`); const msgs = await res.json();
            document.getElementById('messages').innerHTML = msgs.map(m => \`
                <div class="msg-bubble \${m.from === myNick ? 'own' : ''}">
                    <div style="font-size: 11px; opacity: 0.6; margin-bottom: 2px;">\${m.from}</div>
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

// --- API (ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ) ---
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
        if (!db.users[targetNick].requests.includes(myNick)) { db.users[targetNick].requests.push(myNick); await saveCloudData(); }
    }
    res.send();
});
app.post('/accept-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    db.users[myNick].requests = (db.users[myNick].requests || []).filter(n => n !== targetNick);
    if(!db.users[myNick].friends) db.users[myNick].friends = [];
    if(!db.users[targetNick].friends) db.users[targetNick].friends = [];
    db.users[myNick].friends.push(targetNick); db.users[targetNick].friends.push(myNick);
    await saveCloudData(); res.send();
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
        db.messages.push(m); if (db.messages.length > 500) db.messages.shift();
        await saveCloudData();
        if (d.to === 'global') io.emit('msg', m); else io.to(d.to).to(socket.nick).emit('msg', m);
    });
});
async function init() {
    await loadCloudData();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => console.log('LOG: v6.1 Mobile Glass LIVE'));
}
init();
