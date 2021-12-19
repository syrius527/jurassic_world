const mongoose = require("mongoose");
const { Schema } = mongoose;


const schema = new Schema({
  user:  { type: Schema.Types.ObjectId, ref: "User" },
  item: [],
})

const Inventory = mongoose.model("Inventory", schema)

module.exports = Inventory

