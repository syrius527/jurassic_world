const express = require('express')
const app = express()
const port = 3000
const path = require('path')
const crypto = require('crypto')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { encryptPassword, setAuth } = require("./utils");
const fs = require('fs')
const { User, Player } = require('./models');
dotenv.config()

//몽고 DB 연결
const mongoURL = process.env.MONGODB_URL
mongoose.connect(mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected!!!')
}).catch(err => {
    console.log(err)
})

//json처리
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());



//뷰 엔진 (api 로그인,회원가입 기능 테스트 완료후 뷰 연결)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use("/static", express.static(path.join(__dirname, 'public')));


//플레이어 선택, 생성 화면
app.get('/player', setAuth, async(req, res) => {
    if (req.cookies.email != ''){
        var email = req.cookies.email
        var players = await Player.find().where({ email })
        res.render("home", { data: { players } })
    } else {
        res.redirect(301, '/')
    }
    
})


//회원가입
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    let user = null;
    try {
        user = new User({ email: email, password: encryptedPassword });
        await user.save();
    } catch (err) {
        return res.status(400).json({ error: 'email is duplicated' });
    }
    res.status(200).json({ _id: user._id });
})

//로그인 페이지
app.get('/', (req, res) => {
    res.render('login')
})

//로그인 로직
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    const user = await User.findOne({ email, password: encryptedPassword });

    if (user === null)
        return res.status(403).json({ error: 'email or password is invaild' });

    user.key = encryptPassword(crypto.randomBytes(20));
    let header_auth = `Bearer ${user.key}`;
    res.cookie('authorization', header_auth);
    res.cookie('email', email);
    await user.save();
    res.status(200).json({ key: user.key });
})


//캐릭터 생성
app.post('/player/create', setAuth, async (req, res) => {
    try {
        var name = req.body.name
        var email = req.cookies.email
        if (await Player.exists({ name })) {
            msg = "Player is already exists"
        } else {
            const player = new Player({
                name,
                maxHP: 10,
                HP: 10,
                str: 5,
                def: 5,
                x: 0,
                y: 0,
                email
            })
            await player.save()
            msg = "Success"
        }
        res.status(200).json({ msg }) //임시 결과값
    } catch (error) {
        res.status(400).json({ error: "DB_ERROR" })
    }
})

//플레이어 상태 확인
app.get('/player/:name', setAuth, async (req, res) => {
    try {
        var name = req.params.name
        var player = await Player.findOne({ name })
        var level = player.level
        var exp = player.exp
        var maxHP = player.maxHP
        var HP = player.HP
        var str = player.str
        var def = player.def
        var x = player.x
        var y = player.y
        res.status(200).json({ level, exp, maxHP, HP, str, def, x, y })
    } catch (error) {
        res.status(400).json({ error: "DB_ERROR" })
    }
})

//맵 화면
app.get('/player/map/:name', async (req, res) => {
    if (req.cookies.auth) {
        var name = req.params.name
        var player = await Player.findOne({ name })
        res.render("map", { data: { player } })
    } else {
        res.redirect(301, '/')
    }
})


//맵이동 (아이템획득시 스탯 업데이트, 도망가기)


//전투 or 도망


//레벨업 (1업 마다 능력치 모두 1상승)


//사망 (게임 처음부터 시작)
app.get('/player/death/:name', setAuth, async (req, res) => {
    try {
        var name = req.params.name
        var player = await Player.findOne({ name })
        player.level = 1
        player.exp = 0
        player.maxHP = 10
        player.HP = 10
        player.str = 5
        player.def = 5
        player.x = 0
        player.y = 0
        await player.save()
        res.status(200).json({ msg: "death" })
    } catch (error) {
        res.status(400).json({ error: "DB_ERROR" })
    }
})


//서버 포트 연결
app.listen(port, () => {
    console.log(`listening at port: ${port}...`);
})