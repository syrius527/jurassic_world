const mongoose = require("mongoose");
const { Schema } = mongoose;

const schema = new Schema({
    name: String, //캐릭터 네임
    level: { type: Number, default: 1 }, //레벨
    exp: { type: Number, default: 0 },
    maxHP: { type: Number, default: 10 }, //최대 HP
    HP: { type: Number, default: 10 }, //현재 HP
    str: { type: Number, default: 5 }, //공격력
    def: { type: Number, default: 5 }, //방어력
    x: { type: Number, default: 0 }, //맵의 x좌표
    y: { type: Number, default: 0 }, //맵의 y좌표,
    email: String
});

schema.methods.incrementHP = function (val) {
    const hp = this.HP + val;
    this.HP = Math.min(Math.max(0, hp), this.maxHP);
};

const Player = mongoose.model("Player", schema);

module.exports = Player

