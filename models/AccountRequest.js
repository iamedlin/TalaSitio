const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({

name:String,
age:Number,
phone:String,
email:String,
password:String,
status:{
type:String,
default:"pending"
}

});

module.exports = mongoose.model("AccountRequest", requestSchema);