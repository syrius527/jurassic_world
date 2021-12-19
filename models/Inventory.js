const mongoose = require("mongoose");
const { Schema } = mongoose;


const schema = new Schema({
  player:  { type: Schema.Types.ObjectId, ref: "Player" },
  type: String,
  itemId: Number,
  wear: Boolean
})

const Inventory = mongoose.model("Inventory", schema)

module.exports = Inventory

