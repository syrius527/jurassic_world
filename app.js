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
const eventsJson = require('./data/events.json')
const itemsJson = require('./data/items.json')
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


app.get('/game/:name', async (req, res) => {
    const name = req.params.name;
    const player = await Player.findOne({name});
    const inventory = await Inventory.find().where({player: player, have: true})
    const data = {name : name, inventory: inventory }
    res.render("game", {data})
})


app.post('/action/:name', setAuth, async (req, res) => {
    const { action } = req.body;
    const name = req.params.name;
    const user = req.user;
    const email = user.email
    const player = await Player.findOne({ name });
    let eventJson = {};
    let event = null;
    let field = null;
    let actions = [];

    const makeEvent = ()=>{

        if (player.x + player.y === 17) {
            return "nearEnd"
        }

        let typeNum = randomNum(1, 100);
        if (typeNum > 0 && typeNum <= 60) {
            return "battle";
        } else if (typeNum > 60 && typeNum <= 75) {
            return  "item";
        } else if (typeNum > 75 && typeNum <= 85) {
            return  "heal";
        } else {
            return  "none";
        }}

    let _eventType = makeEvent();

    if (action === "query") {
        field = mapManager.getField(player.x, player.y);
    }
    else if (action === "move") {
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

        if (_eventType) {
            if (_eventType === "battle") {
                eventJson.event = "battle";
                event = {type: "battle", description: "(゜▼゜＊） 공룡과 마주쳤다"}
                let _dino = null;

                field = mapManager.getField(player.x, player.y);
                if (field.fieldType === 'green') {
                    const monsterNum = randomNum(1, 2)
                    _dino = dinos.find(e => e.id === monsterNum)
                    event.description1 = '초식공룡이다! 야생의 ' + _dino.name + '이(가) 나타났다!! '
                } else if (field.fieldType === 'white') {
                    const monsterNum = randomNum(3, 5)
                    _dino = dinos.find(e => e.id === monsterNum)
                    event.description1 = '육식공룡이다! 야생의 ' + _dino.name + '이(가) 나타났다!! '
                } else if (field.fieldType === 'blue') {
                    const monsterNum = randomNum(6, 7)
                    _dino = dinos.find(e => e.id === monsterNum)
                    event.description1 = '수룡이다! 야생의 ' + _dino.name + '이(가) 나타났다!! '
                } else if (field.fieldType === 'yellow') {
                    const monsterNum = randomNum(8, 9)
                    _dino = dinos.find(e => e.id === monsterNum)
                    event.description1 = '익룡이다! 야생의 ' + _dino.name + '이(가) 나타났다!! '
                }

                let dinoHP = _dino.hp;
                const playerStr = player.str + player.itemStr;
                const playerDef = player.def + player.itemDef;
                let playerDamage = Math.max(_dino.str - playerDef, 1);
                let dinoDamage = Math.max(playerStr - _dino.def, 1);

                let turn = 1;

                let battleStatus = "ing";
                while (true) {
                    if (turn <= 10 && player.HP / player.maxHP > 0.2) {
                        event.description1 += `${turn}턴, `;
                        player.incrementHP(-playerDamage);
                        dinoHP -= dinoDamage;
                        turn += 1;
                        if (dinoHP <= 0) {
                            eventJson.event = "win"

                            //경험치 획득 및 레벨업
                            event.description1 += `${_dino.name}을 쓰러뜨렸다! 경험치를 ${_dino.exp} 획득하였다! `;
                            player.exp += _dino.exp;

                            if (player.level >= 5) {
                                event.description1 += "최대 레벨! "
                            } else if (player.exp > 10) {
                                let lvUp = parseInt(player.exp / 10);
                                for (let i = lvUp; i > 0; i--) {
                                    player.exp -= 10;
                                    player.level += 1;
                                    let strUp = Math.floor(Math.random() * (3)) + 2;
                                    let defUp = Math.floor(Math.random() * (4)) + 2;
                                    player.str += strUp;
                                    player.def += defUp;
                                    event.description1 += `레벨업! str이 ${strUp}, def가 ${defUp} 올랐다. `;
                                    battleStatus = "win";
                                }
                            }
                            // 공룡 이빨 획득
                            event.description1 += `${_dino.teeth}개의 이빨을 획득하였다! `;
                            player.teeth += _dino.teeth;
                            break;

                        } else if (player.HP <= 0) {
                            eventJson.event = "die";
                            event.description1 += `${_dino.name}에게 당했다... 정신을 차려보니 시작점이다! `
                            player.x = 0;
                            player.y = 0;
                            player.HP = player.maxHP;

                            //아이템 잃어버리기
                            let itemName = null
                            while (true) {
                                const possibility = randomNum(0,2);
                                const item = await Inventory.find({player: player, have : true});
                                if (possibility === 0) {
                                    event.description1 += "운좋게 아무 것도 잃지 않았다. "
                                    break;
                                } else { // possibility = 1, 2
                                    if (item.length === 0) { // has no item
                                        break;
                                    } else { // has at least 1 item
                                        const lostNum = randomNum(0,item.length-1);
                                        itemName = item[lostNum].name;
                                        await Inventory.findOneAndUpdate({player: player, name : itemName}, {have: false});
                                        event.description1 += `${itemName}을(를) 잃어버렸다. `

                                        await player.save();
                                        break;
                                    }
                                }
                            }
                            // 가지고 있는 아이템 중 type별 능력치가 제일 높은 것만 자동 장착
                            const attack = "attack";
                            const armor = "armor";
                            const attItem = await Inventory.find({player: player, have : true, type: attack});
                            const armorItem = await Inventory.find({player: player, have : true, type: armor});
                            let attStr = 0;
                            let armorDef = 0;
                            attItem.forEach(function (e) {
                                attStr = Math.max(e.stat, attStr);
                            }) // 제일 높은 str 찾기
                            armorItem.forEach(function (e) {
                                armorDef = Math.max(e.stat, armorDef);
                            }) // 제일 높은 def 찾기
                            player.itemStr = attStr;
                            player.itemDef = armorDef;
                            await player.save();
                        }
                    } else {
                        if (battleStatus === "ing") {
                            actions.push({
                                url: `/action/${name}`,
                                text: "계속 싸운다.",
                                params: {
                                    action: "ing",
                                    continue: 1,
                                    dinoHP: dinoHP,
                                    dino: _dino.name
                                }
                            });
                            actions.push({
                                url: `/action/${name}`,
                                text: "도망친다.",
                                params: {
                                    action: "ing",
                                    continue: 0,
                                    dinoHP: dinoHP,
                                    dino: _dino.name
                                }
                            });
                            break
                        }
                    }
                }
                await player.save();
            } else if (_eventType === "item") {
                event = {type: "item", description: "아이템을 획득했다."};

                let _itemNum = 1;
                if (field.x + field.y < 6) {
                    _itemNum = 3 * randomNum(0, 2) + 1; // 1단계 1 4 7
                } else if (field.x + field.y >= 6 && field.x + field.y < 11) {
                    _itemNum = 3 * randomNum(0, 2) + 2; // 2단계 2 5 8
                } else if (field.x + field.y >= 11 && field.x + field.y <16) {
                    _itemNum = 3 * randomNum(0, 2) + 3; // 3단계 3 6 9
                } else if (field.x + field.y === 16) {
                    _itemNum = 10;
                }
                const _item = itemsJson.find(e => e.id === _itemNum);

                let haveItem = await Inventory.findOne({player: player, itemId: _itemNum});
                if (!haveItem) {
                    try {
                        const inventory = new Inventory({
                            player: player,
                            itemId: _item.id,
                            type: _item.type,
                            name: _item.name,
                            stat: _item.type === "attack" ? _item.str : _item.def,
                            have: true,
                            wear: false
                        });
                        event.description1 = _item.description;
                        await inventory.save();
                    } catch (err) {
                        return res.status(400).json({error: 'cannot add inventory'});}
                } else if (!haveItem.have) {
                    try {
                        haveItem.have = true;
                        event.description1 = _item.description;
                        await haveItem.save();
                    } catch (err) {
                        return res.status(400).json({error: 'cannot add inventory'});}
                } else if (haveItem.have) {
                    event.description1 = `${_item.name}은(는) 이미 갖고 있는 아이템이다.`;
                }
                // 가지고 있는 아이템 중 type별 능력치가 제일 높은 것만 자동 장착
                const attack = "attack";
                const armor = "armor";
                const attItem = await Inventory.find({player: player, have : true, type: attack});
                const armorItem = await Inventory.find({player: player, have : true, type: armor});
                let attStr = 0;
                let armorDef = 0;
                attItem.forEach(function (e) {
                    attStr = Math.max(e.stat, attStr);
                }) // 제일 높은 str 찾기
                armorItem.forEach(function (e) {
                    armorDef = Math.max(e.stat, armorDef);
                }) // 제일 높은 def 찾기
                player.itemStr = attStr;
                player.itemDef = armorDef;
                await player.save();

            } else if (_eventType === "heal") {
                event = {type: "heal", description: "운좋게 체력을 회복했다."}
                event.description1 = "힘을 내서 다시 가보자!"
                player.incrementHP(15);
                await player.save();
            } else if (_eventType === "none") {
                event = {type: "none", description: "아무 일도 없었다."};
                event.description1 = "다시 길을 가자";
            } else if (_eventType === "nearEnd") {
                event = {type: "nearEnd", description1 : ""};
            }
        }
        // 싸움 계속 선택시 (전투마저하기)
    } else if (action === "ing") {
        x = player.x;
        y = player.y;
        const dino = req.body.dino;
        const _dino = dinos.find(e => e.name === dino);
        let dinoHP = req.body.dinoHP;
        let playerHP = player.HP;
        eventJson.event = "ing";

        field = mapManager.getField(x, y);
        if (req.body.continue === '1'){
            let turn = 1;
            const playerStr = player.str + player.itemStr;
            const playerDef = player.def + player.itemDef;
            let playerDamage = Math.max(_dino.str - playerDef, 1);
            let dinoDamage = Math.max(playerStr - _dino.def, 1);
            event={description1 :''}
            while (true) {
                event.description1 += `${turn}턴, `;
                player.HP -= playerDamage;
                dinoHP -= dinoDamage;
                turn += 1;

                if (player.HP <= 0) {
                    eventJson.event = "die";
                    event.description1 += `${_dino.name}에게 당했다... 정신을 차려보니 시작점이다! `
                    player.x = 0;
                    player.y = 0;
                    player.HP = player.maxHP;


                    //아이템 잃어버리기
                    let itemName = null
                    while (true) {
                        const possibility = randomNum(0, 2);
                        const item = await Inventory.find({player: player, having: true});
                        if (possibility === 0) {
                            event.description1 += "운좋게 아무 것도 잃지 않았다. "
                            break;
                        } else { // possibility = 1, 2
                            if (item.length === 0) { // has no item
                                break;
                            } else { // has at least 1 item
                                const lostNum = randomNum(0, item.length - 1);
                                itemName = item[lostNum].name;
                                await Inventory.findOne({player: player, name: itemName}).deleteOne();
                                await player.save();
                                event.description1 += `${itemName}을(를) 잃어버렸다. `
                                break;
                            }
                        }
                    }
                    const attack = "attack";
                    const armor = "armor";
                    const attItem = await Inventory.find({player: player, have : true, type: attack});
                    const armorItem = await Inventory.find({player: player, have : true, type: armor});
                    let attStr = 0;
                    let armorDef = 0;
                    attItem.forEach(function (e) {
                        attStr = Math.max(e.stat, attStr);
                    }) // 제일 높은 str 찾기
                    armorItem.forEach(function (e) {
                        armorDef = Math.max(e.stat, armorDef);
                    }) // 제일 높은 def 찾기
                    player.itemStr = attStr;
                    player.itemDef = armorDef;
                    await player.save();
                    break
                } else if (dinoHP <= 0) {

                    //경험치 획득 및 레벨업
                    event.description1 += `${_dino.name}을 쓰러뜨렸다! 경험치를 ${_dino.exp} 획득하였다! `;
                    player.exp += _dino.exp;
                    if (player.level >= 5) {
                        event.description1 += "최대 레벨! "
                    } else if (player.exp > 10) {
                        let lvUp = parseInt(player.exp / 10);
                        for (let i = lvUp; i > 0; i--) {
                            if (player.level >= 5) {
                                break;
                            }
                            player.exp -= 10;
                            player.level += 1;
                            let strUp = Math.floor(Math.random() * (3)) + 2;
                            let defUp = Math.floor(Math.random() * (4)) + 2;
                            player.str += strUp;
                            player.def += defUp;
                            event.description1 += `레벨업! str이 ${strUp}, def가 ${defUp} 올랐다. `;
                        }
                    }

                    // 공룡 이빨 획득
                    event.description1 += `${_dino.teeth}개의 이빨을 획득하였다! `;
                    player.teeth += _dino.teeth;
                    break;
                }
            }
        }
        // 도망치기 선택
        else if (req.body.continue === '0'){
            event = { type: "run", description : "지금이다!", description1 : "어느 방향으로 도망갈까?" };
        }
    }

    if (eventJson.event !== "battle") {
        actions =[];

        const directions = ["북", "동", "남", "서"];
        if (eventJson.event === 'die') {
            const canGo = [1,1,0,0]
            canGo.forEach((direction, i) => {
                if (direction === 1) {
                    actions.push({
                        url: `/action/${name}`,
                        text: directions[i],
                        params: {direction: i, action: "move"}
                    });
                }
            })
        } else {
            field.canGo.forEach((direction, i) => {
                if (direction === 1) {
                    actions.push({
                        url: `/action/${name}`,
                        text: directions[i],
                        params: {direction: i, action: "move"}
                    });
                }
            });
        }
    }

    field = mapManager.getField(player.x,player.y);
    eventJson.message = field.description ;

    const item = await Inventory.find({player: player, have: true});
    const itemArr = []
    item.forEach(e => itemArr .push(e.name))
    player.itemNameArr = itemArr
    player.save();

    return res.send({ player, field, event, actions })
});


//맵 화면 (임시)
app.get('/player/map/:name', setAuth, async (req, res) => {
    res.render("map")
})

//서버 포트 연결
app.listen(port, () => {
    console.log(`listening at port: ${port}...`);
})