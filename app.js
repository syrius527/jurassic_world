const express = require('express');
const app = express();
const mongoose = require('mongoose');
const port = 3000;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const { constantManager, mapManager } = require('./data/Manager');
const dinos = require('./data/monster.json');
const { User, Player, Inventory } = require('./models');
const { encryptPassword, setAuth } = require('./utils');


//json처리
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());


//몽고 DB 연결
const mongoURL = 'mongodb+srv://test0:test0@testmongo.xir8z.mongodb.net/gameServer?retryWrites=true&w=majority';
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

const authentication = async (req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization) return res.sendStatus(401);
    const [bearer, key] = authorization.split(" ");
    if (bearer !== "Bearer") return res.sendStatus(401);
    const player = await Player.findOne({ key });
    if (!player) return res.sendStatus(401);

    req.player = player;
    next();
};


//뷰 엔진 (api 로그인,회원가입 기능 테스트 완료후 뷰 연결)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, 'public')));
app.engine('html', require('ejs').renderFile);


//처음화면
app.get('/', (req, res) => {
    res.render('login')
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

//로그인
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

//플레이어 선택 화면
app.get('/player', setAuth, async(req,res) => {
    if (req.cookies.email !== '') {
        const email = req.cookies.email
        const players = await Player.find().where({email})
        res.render("home", {data: {players}})
    } else {
        res.redirect(301, '/')
    }
})

//캐릭터 생성
app.post('/player/create', setAuth, async (req, res) => {
    try {
        const name = req.body.name;
        const email = req.cookies.email;
        let msg = "";
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
            const key = crypto.randomBytes(24).toString("hex");
            player.key = key;

            await player.save()
            msg = "Success"
        }
        res.status(200).json({ msg }) //임시 결과값
    } catch (error) {
        res.status(400).json({ error: "DB_ERROR" })
    }
})


app.get('/game/:name', (req, res) => {
    const name = req.params.name;
    res.render("game", {data: name})
})


//플레이어 상태 확인(신동환)
//########################################################
app.get('/player/:name', setAuth, async (req, res) => {
    try {
        const name = req.params.name
        const  player = await Player.findOne({ name })
        const  level = player.level
        const  exp = player.exp
        const  maxHP = player.maxHP
        const  HP = player.HP
        const  str = player.str
        const  def = player.def
        const  data = { level, exp, maxHP, HP, str, def }
        res.status(200).json(data)
    } catch (error) {
        res.status(400).json({ error: "DB_ERROR" })
    }
})
//########################################################

//장비 착용 해제, 소비템 사용
app.post('/player/item', setAuth, async (req, res) => {
    try {
        var name = req.body.name
        var item = req.body.item
        var wear = req.body.wear

        var player = await Player.findOne({ name })
        console.log(player)
        var inventory = await Inventory.findOne({ itemId: item.id })
        if (item.type === 'attack') {
            var str = item.str
            //장착
            if (wear === true) player.str += str
            //해제
            else player.str -= str

            inventory.wear = wear
            await player.save()
            await inventory.save()

            console.log(player)
            console.log(inventory)
            console.log('공격 장비 장착/해제')
        } else if (item.type === 'armor') {
            var def = item.def
            //장착
            if (wear === false) player.def += def
            //해제
            else player.def -= def

            inventory.wear = wear
            await player.save()
            await inventory.save()

            console.log(player)
            console.log(inventory)
            console.log('방어 장비 장착/해제')
        } else if (item.type === 'consumption') {
            if (item.hp === item.maxHP) {
                console.log('max 체력, 회복 불가')
            } else {
                var hp = item.hp
                player.hp += hp
                if (player.hp > player.maxHP) player.hp = player.maxHP
                inventory.cnt--
                if (inventory.cnt === 0) delete inventory
                await player.save()
                await inventory.save()
            }

            console.log(player)
            console.log(inventory)
            console.log('소비 아이템 사용')
        }
        res.status(200).json({ msg: 'success' })
    } catch (error) {
        console.log(error)
        res.status(400).json({ error: "DB_ERROR" })
    }
})



//맵 화면 (임시)
app.get('/player/map/:name', setAuth, async (req, res) => {
    res.render("map")
})


//아마 map기능
app.post('/action/:name', setAuth, async (req, res) => {
    const { action } = req.body;
    const name = req.params.name;
    const user = req.user;
    const email = user.email
    const player = await Player.findOne({ name })

    let event = null;
    let field = null;
    let actions = [];
    if (action === "query") {
        field = mapManager.getField(player.x, player.y);
    } else if (action === "move") {
        const direction = parseInt(req.body.direction, 0); // 0 북. 1 동 . 2 남. 3 서.
        let x = player.x;
        let y = player.y;
        if (direction === 0) {
            y += 1;
        } else if (direction === 1) {
            x += 1;
        } else if (direction === 2) {
            y -= 1;
        } else if (direction === 3) {
            x -= 1;
        } else {
            res.sendStatus(400);
        }

        field = mapManager.getField(x, y);
        if (!field) res.sendStatus(400);

        player.x = x;
        player.y = y;
        await player.save();

        const events = field.events;
        const actions = [];
        if (events.length > 0) {
            // TODO : 확률별로 이벤트 발생하도록 변경
            const _event = events[0];
            if (_event.type === "battle") {
                // TODO: 이벤트 별로 events.json 에서 불러와 이벤트 처리
                const _dino = dinos.filter(function(e) {
                    return e.id === _event.monster;
                })[0];
                //event = { description: `${_dino.name}와(과) 마주쳐 싸움을 벌였다.`};

                let dinoHP = _dino.hp;
                const playerStr = player.str + player.itemStr;
                const playerDef = player.def + player.itemDef;
                let playerDamage = Math.max(_dino.str - playerDef, 1);
                let dinoDamage = Math.max(playerStr - _dino.def, 1);
                event = {
                    description: '야생의 ' + _dino.name + '이(가) 나타났다!!\n'
                }
                //let turn = 1;
                //while (turn < 10 && player.HP > 20)
                for (let turn = 1; turn > 0 ; turn++) {
                    if (turn>=10 || player.HP <= 0.2*player.maxHP) {
                        console.log(events.field);
                        // event.field[3][5] = 1;
                        // event.field[3][6] = 1;
                    }
                    event.description += `${turn}턴, `;
                    player.incrementHP(-playerDamage);
                    dinoHP -= dinoDamage;
                    console.log(dinoHP);
                    await player.save();

                    if (player.HP <= 0) {
                        event.description += `${_dino.name}에게 당했습니다..\n 정신을 차려보니 시작점입니다!`
                        player.x = 0;
                        player.y = 0;
                        player.HP = player.maxHP;
                        //아이템 잃어버리기
                        await player.save();
                        break;
                    } else if (dinoHP <= 0) {
                        event.description += `${_dino.name}을 쓰러뜨렸습니다!\n 경험치를 ${_dino.exp} 획득하였습니다!`;
                        //경험치 획득 및 레벨업
                        player.exp += _dino.exp;
                        if (player.level >= 5) {
                            event.description += "최대 레벨입니다."
                        } else if(player.exp > 10) {
                            let lvUp = parseInt(player.exp/10);
                            for (let i=lvUp; i>0; i--) {
                                player.exp -= 10;
                                player.level += 1;
                                let strUp = Math.floor(Math.random()*(3)) + 2;
                                let defUp = Math.floor(Math.random()*(4)) + 2;
                                player.str += strUp;
                                player.def += defUp;
                                event.description += `레벨업! str이 ${strUp}, def가 ${defUp} 올랐습니다.`;
                            }
                        }
                        player.teeth += _dino.teeth;
                        await player.save();
                        break;
                    }
                }
            } else if (_event.type === "item") {
                const _item = items.filter(function(e) {
                    return e.id === _event.item;
                })[0];
                if(_item.type === "attack") {
                    event = { description: _item.description };
                    //add to inventory
                } else if(_item.type === "armor") {
                    event = { description: _item.description };
                    //add to inventory
                } else {
                    event = { description: '아무 일도 일어나지 않았다.' };
                }
            } else if (_event.type === "heal") {
                player.incrementHP(30);
            }
        }

        await player.save();
    }

    field = mapManager.getField(player.x, player.y);
    field.canGo.forEach((direction, i) => {
        if (direction === 1) {
            actions.push({
                url: `/action/${name}`,
                text: i,
                params: { direction: i, action: "move" }
            });
        }
    });

    return res.send({ player, field, event, actions })

});


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


// //맵 화면
// app.get('/player/map/:name', setAuth, async (req, res) => {
//     if (req.cookies.authorization) {
//         var name = req.params.name;
//         var player = await Player.findOne({ name });
//         console.log('player',player,name);
//         const mapTile=mapManager.getField(0,0);
//         //const mapTile=mapManager.getField(player.x,player.y);
//         const monsterId=getRandomMonsterId(mapTile.monster);
//         //console.log(monsterId);
//         const monster=monsterManager.getMonster(monsterId);
//         res.render("map", { data: { player, monster, mapTile } });
//     } else {
//         res.redirect(301, '/')
//     }
// })

//맵 화면
app.get('/player/map/:name', setAuth, async (req, res) => {
    if (req.cookies.authorization) {
        var name = req.params.name;
        var player = await Player.findOne({ name });
        console.log('player', player, name);
        const mapTile = mapManager.getField(0, 0);
        //const mapTile=mapManager.getField(player.x,player.y);
        const monsterId = getRandomMonsterId(mapTile.monster);
        //console.log(monsterId);
        const monster = monsterManager.getMonster(monsterId);
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
