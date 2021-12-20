const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { encryptPassword, setAuth } = require("./utils");
const fs = require('fs');
const { constantManager, mapManager } = require("./data/Manager");
const { User, Player, Inventory } = require('./models');
const dinos = require('./data/monster.json');
dotenv.config();

//몽고 DB 연결
const mongoURL = "mongodb+srv://seoji:1111@getcoin.tfry7.mongodb.net/coinServer?retryWrites=true&w=majority";
// const mongoURL = process.env.MONGODB_URL
mongoose.connect(mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected!!!')
}).catch(err => {
    console.log(err)
})

// function which returns random number btw min max
function randomNum(min, max) {
    const randNum = Math.floor(Math.random() * (max - min + 1)) + min;
    return randNum;
}

//json처리
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());



//뷰 엔진 (api 로그인,회원가입 기능 테스트 완료후 뷰 연결)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use("/static", express.static(path.join(__dirname, 'public')));

app.engine("html", require("ejs").renderFile);

//플레이어 선택, 생성 화면
app.get('/', setAuth, async (req, res) => {
    var email = req.cookies.email
    var players = await Player.find().where({ email })
    res.render("home", { data: { players } })
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
app.get('/login', (req, res) => {
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
                maxHP: 100,
                HP: 100,
                str: randomNum(4, 6),
                def: randomNum(2, 5),
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

//플레이어 상태 확인(신동환)
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
        var data = { level, exp, maxHP, HP, str, def }
        res.status(200).json(data)
    } catch (error) {
        res.status(400).json({ error: "DB_ERROR" })
    }
})

//인벤토리 보여주기(신동환)
app.get('/player/inventory/:name', setAuth, async (req, res) => {
    try {
        var name = req.params.name
        var inventory = await Inventory.find().where({ name })
        var items = []
        var cnt = 0
        var item = {}
        var wear = false
        var item_list = fs.readFileSync('./data/items.json', 'utf8')
        item_list = JSON.parse(item_list)
        for (var i = 0; i < inventory.length; i++) {
            var cnt = inventory[i].cnt
            var wear = inventory[i].wear
            var itemId = inventory[i].itemId
            item_list.forEach( o => {
                if(o.id === itemId) {
                    item = o
                }
            })
            items[i] = {item, cnt, wear}
        }
        res.status(200).json(items)
    } catch (error) {
        console.log(error)
        res.status(400).json({ error: "DB_ERROR" })
    }
})

//장비 착용,해제, 소비템 사용(신동환)
app.post('/player/item', setAuth, async (req, res) => {
    try {
        var name = req.body.name
        var item = req.body.item
        var wear = req.body.wear
        var item_list = fs.readFileSync('./data/items.json', 'utf8')
    } catch (error) {

    }
})


//아이템 획득 (임시)
// app.post('/player/item/gain', async (req, res) => {
//     try {
//         var name = req.body.name
//         var itemId = req.body.itemId
//         var cnt = req.body.cnt
//         var wear = false
//         item = new Inventory({ name: name, itemId: itemId, cnt: cnt, wear: wear });
//         await item.save()
//         res.status(200).json({ msg: 'success' })
//     } catch (error) {
//         console.log(error)
//         res.status(400).json({ error: "DB_ERROR" })
//     }
// })


//맵 화면 (임시)
app.get('/player/map/:name', setAuth, async (req, res) => {
    res.render("map")
})

// //아마 map기능
// app.post("/player/map/:name", setAuth, async (req, res) => {
//     if (req.cookies.authorization) {
//         var name = req.params.name
//         var player = await Player.findOne({ name })
//         res.render("map", { data: { player } })
//     } else {
//         res.redirect(301, '/')
//     }
//     let event = null;
//     let field = null;
//     let actions = [];
//     if (action === "query") {
//         field = mapManager.getField(req.player.x, req.player.y);
//     } else if (action === "move") {
//         const direction = parseInt(req.body.direction, 0); // 0 북. 1 동 . 2 남. 3 서.
//         let x = req.player.x;
//         let y = req.player.y;
//         if (direction === 0) {
//             y -= 1;
//         } else if (direction === 1) {
//             x += 1;
//         } else if (direction === 2) {
//             y += 1;
//         } else if (direction === 3) {
//             x -= 1;
//         } else {
//             res.sendStatus(400);
//         }
//         field = mapManager.getField(x, y);
//         if (!field) res.sendStatus(400);
//         player.x = x;
//         player.y = y;
//
//         const events = field.events;
//         const actions = [];
//         if (events.length > 0) {
//             // TODO : 확률별로 이벤트 발생하도록 변경
//             const _event = events[0];
//             if (_event.type === "battle") {
//                 // TODO: 이벤트 별로 events.json 에서 불러와 이벤트 처리
//
//                 event = { description: "늑대와 마주쳐 싸움을 벌였다." };
//                 player.incrementHP(-1);
//             } else if (_event.type === "item") {
//                 event = { description: "포션을 획득해 체력을 회복했다." };
//                 player.incrementHP(1);
//                 player.HP = Math.min(player.maxHP, player.HP + 1);
//             }
//         }
//
//         await player.save();
//     }
//
//     field.canGo.forEach((direction, i) => {
//         if (direction === 1) {
//             actions.push({
//                 url: "/action",
//                 text: i,
//                 params: { direction: i, action: "move" }
//             });
//         }
//     });
//
//     return res.send({ player, field, event, actions });
// });


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


/* dinosaur 랜덤 배치 (박신영)
아래 랜덤 배치 관련 코드가 이미 짜여져 있어 일단 이렇게 해뒀습니다 

const HERBIVORE_IDS = [1,2];
const CARNIVORE_IDS = [3,4,5];
const SEA_MONSTER_IDS = [6, 7];
const FLYING_IDS = [8,9];

function pickRandom(array) {
    return Math.floor(Math.random() * (array.length));
};
const TERRAIN = {
    GRASS: 0,
    MEAT: 1,
    WATER: 2,
    FLYING: 3,
}


function getRandomMonsterId(terrainType) {
    let monsterIds;
    switch (terrainType) {
        case TERRAIN.GRASS:
            monsterIds = HERBIVORE_IDS;
            break;
        case TERRAIN.MEAT:
            monsterIds = CARNIVORE_IDS;
            break;
        case TERRAIN.WATER:
            monsterIds = SEA_MONSTER_IDS;
            break;
        case TERRAIN.FLYING:
            monsterIds = FLYING_IDS;
            break;
        default:
            throw new Error('Unknown terrain type')
    }
    return pickRandom(monsterIds);
}

*/ 

//맵 화면
app.get('/player/map/:name', setAuth, async (req, res) => {
    if (req.cookies.authorization) {
        var name = req.params.name;
        var player = await Player.findOne({ name });
        console.log('player',player,name);
        const mapTile=mapManager.getField(0,0);
        //const mapTile=mapManager.getField(player.x,player.y);
        const monsterId=getRandomMonsterId(mapTile.monster);
        //console.log(monsterId);
        const monster=monsterManager.getMonster(monsterId);
        res.render("map", { data: { player, monster, mapTile } });
    } else {
        res.redirect(301, '/')
    }
})
// battle
app.post('/player/battle/:name', setAuth, async (req, res) => {
    //req에 fieldType받아와야됨
    const name = req.params.name;
    const player = await Player.findOne({ name });
    const fieldType = req.fieldtype;
    let dinoId = 0;
    if (fieldType === 'green') {
        dinoId = randomNum(1, 2); // 초식공룡
    } else if (fieldType === 'white') {
        dinoId = randomNum(3, 5);  // 육식공룡
    } else if (fieldType === 'blue') {
        dinoId = randomNum(6, 7); // 어룡
    } else if (fieldType === 'yellow') {
        dinoId = randomNum(8, 9); // 익룡
    }
    const dino = dinos.filter(e => e.id === dinoId);
    console.log(dino);
    let dinoHP = dino.hp;
    let playerDamage = await Math.min(dino.str - player.def, 1);
    let dinoDamage = await Math.min(player.str - dino.def, 1);
    let result = {
        description: '야생의' + dino.name + '이(가) 나타났다!!\n'
    }
    let turn = 1;
    while (turn > 0) {
        result.description += `턴: ${turn}`;
        if (turn >= 10 || player.HP <= 20) {
            //도망치기 버튼 활성화
        }
        player.incrementHP(-playerDamage);
        dinoHP -= dinoDamage;
        await player.save();

        if (player.HP <= 0) {
            result.description += `${dino.name}에게 당했습니다..\n 정신을 차려보니 시작점입니다!`
            player.x = 0;
            player.y = 0;
            player.HP = player.maxHP;
            //아이템 잃어버리기
            await player.save();
            break;
        } else if (dinoHP <= 0) {
            player.incrementExp(dino[exp]);
            player.item[11] += dino[teeth];
            await player.save;
            break;
        }

        turn++;

    }
})


//서버 포트 연결
app.listen(port, () => {
    console.log(`listening at port: ${port}...`);
})
