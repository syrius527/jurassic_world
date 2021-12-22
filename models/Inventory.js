const mongoose = require("mongoose");
const { Schema } = mongoose;


const schema = new Schema({
  player : { type: Schema.Types.ObjectId, ref: 'Player' }, //플레이어의 닉네임은 고유값이므로 pk 값 처럼 사용
  itemId: Number, //json의 아이템 id를 받아와 저장
  type: String,
  name: String,
  stat: Number,
  have: Boolean, // 보유중인지
})

const Inventory = mongoose.model("Inventory", schema)

module.exports = Inventory

