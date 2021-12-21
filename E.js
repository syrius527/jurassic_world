
app.post("/action", authentication, async (req, res) => {
    const { action } = req.body;
    const player = req.player;
    let event = null;
    let field = null;
    let actions = [];
    let eventJson = {};
    if (action === "query") {
        field = mapManager.getField(req.player.x, req.player.y);
    } else if (action === "move") {
        const direction = parseInt(req.body.direction, 0); // 0 북. 1 동 . 2 남. 3 서.
        let x = req.player.x;
        let y = req.player.y;
        if (direction === 0) {
            y -= 1;
        } else if (direction === 1) {
            x += 1;
        } else if (direction === 2) {
            y += 1;
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

        // TODO: 만약 이미 전투중인 경우 이 함수를 실행하지 않고 전투를 진행한다!
        eventJson = eventChooser(player.x, player.y, player.randomPlayerKey);

        if (eventJson) {
            if (eventJson.event === "battle") {
                // TODO: 이벤트 별로 events.json 에서 불러와 이벤트 처리

                const monster = eventJson.monsterName;
                const monsterJson = monsterManager.getMonster(monster);

                const attackCalculator = (attackerStr, defenserDef, defenserHP) => {
                    if (attackerStr > defenserDef) {
                        defenserHP = defenserHP - (attackerStr - defenserDef);
                        return defenserHP;
                    } else {
                        defenserHP--;
                        return defenserHP;
                    }
                };

                let playerHP = player.hp;
                let monsterHP = monsterJson.hp;
                let battleCount = 0;
                let battleStatus = "fighting";

                while (playerHP > player.hp * 0.2 && battleCount <= 10) {
                    const playerStr = player.str + player.itemStr;
                    const playerDef = player.def + player.itemDef;

                    attackCalculator(playerStr, monsterJson.def, monsterHP);
                    attackCalculator(monsterJson.str, playerDef, playerHP);
                    battleCount++;

                    if (monsterHP <= 0) {
                        player.incrementExp(monsterJson.id * 3);
                        battleStatus = "won";
                        console.log("이겼습니다");
                        break;
                    }
                }
                await player.save();

                if (battleStatus === "fighting") {
                    // TODO addContinueFight 여기에서 함수 사용!

                    const addContinueFight = (actions, text, booleanValue, monsterHP) => {
                        actions.push({
                            url: "/action",
                            text: text,
                            params: {
                                action: "fighting",
                                continue: booleanValue,
                                monsterHP: monsterHP
                            }
                        });
                    };

                    const fightArray = [
                        { text: "계속 싸운다", continue: "true" },
                        { text: "도망간다", continue: "false" }
                    ];
                    fightArray.forEach((e) => {
                        const monsterRemainHP = monsterHP;
                        addContinueFight(actions, e.text, e.continue, monsterRemainHP);
                    });
                }
            } else if (eventJson.event === "heal") {
                const healAmount = eventJson.healAmount;
                player.incrementHP(healAmount);
                await player.save();
            } else if (eventJson.event === "item") {
                const item = eventJson.itemName;

                player.itemToInventory(item);
                await player.save();
                const inventoryItemStr = [];
                const inventoryItemDef = [];

                player.items.forEach((e) => {
                    const itemJson = itemManager.getItem(e);
                    inventoryItemStr.push(itemJson.str);
                    inventoryItemDef.push(itemJson.def);
                });

                inventoryItemStr.sort(function (a, b) {
                    return a - b;
                });
                const maxStr = inventoryItemStr[inventoryItemStr.length - 1];
                player.itemStr = maxStr;

                inventoryItemDef.sort(function (a, b) {
                    return a - b;
                });
                const maxDef = inventoryItemDef[inventoryItemDef.length - 1];
                player.itemDef = maxDef;

                await player.save();
            } else if (eventJson.event === "none") {
                console.log("아무 일도 일어나지 않았다.");
            }
        }
    } else if (action === "fighting") {
        const x = req.player.x;
        const y = req.player.y;
        field = mapManager.getField(x, y);

        eventJson = eventChooser(player.x, player.y, player.randomPlayerKey);
        const monster = eventJson.monsterName;
        const monsterJson = monsterManager.getMonster(monster);
        let monsterHP = req.body.monsterHP;
        let playerHP = req.player.HP;
        eventJson.event = "fighting";

        if (req.body.continue) {
            if (req.body.continue === "true") {
                while (playerHP) {
                    const playerStr = +player.str + player.itemStr;
                    const playerDef = +player.def + player.itemDef;

                    const attackCalculator = (attackerStr, defenserDef, defenserHP) => {
                        if (attackerStr > defenserDef) {
                            defenserHP = defenserHP - 0 - (attackerStr - 0 - defenserDef);
                            return defenserHP;
                        } else {
                            defenserHP = defenserHP - 0 - 1;
                            return defenserHP;
                        }
                    };

                    monsterHP = attackCalculator(playerStr, monsterJson.def, monsterHP);
                    if (monsterHP <= 0) {
                        player.incrementExp(monsterJson.id * 3);
                        eventJson.event = "win";
                        console.log("이겼습니다.");
                        await player.save();
                        break;
                    }

                    player.HP = attackCalculator(monsterJson.str, playerDef, playerHP);
                    await player.save();
                    playerHP = player.HP;

                    if (playerHP <= 0) {
                        eventJson.event = "die";
                        player.HP = player.maxHP;
                        player.x = 0;
                        player.y = 0;
                        const randomItem = Math.round(
                            Math.random() * (player.items.length - 0 - 1)
                        );
                        player.items.splice(randomItem, 1);
                        await player.save();
                        console.log("사망했습니다.");
                        actions.push({
                            url: "/action",
                            text: "부활",
                            params: { action: "query" }
                        });
                        break;
                    }
                }
            } else if (req.body.continue === false) {
                return (eventJson.event = "run");
            }
        }
    }

    if (eventJson.event !== "battle" && eventJson.event !== "die") {
        actions = [];
        const directions = ["북", "동", "남", "서"];
        field.canGo.forEach((direction, i) => {
            // TODO: 전투중이 아닐 때에만 이거 추가하기. 전투중인 경우 이동 불가.
            if (direction === 1)
                actions.push({
                    url: "/action",
                    text: directions[i],
                    params: { direction: i, action: "move" }
                });
        });
    }
    if (field === null) {
        field = mapManager.getField(player.x, player.y);
    }
    field.description = eventJson.message;
    // TODO: event.description 에 여러가지 메세지를 담기. 아니면 배열에 메세지를 여러개 담아도 좋다.
    return res.send({ player, field, event, actions });
});