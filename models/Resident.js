const mongoose = require("mongoose");

const ResidentSchema = new mongoose.Schema({

    head: {
        name: { type: String, required: true },
        age: { type: Number, required: true },
        birthdate: Date,
        gender: String,
        civilStatus: String,
        contact: String,
        email: String,
        occupation: String,
        socialClass: String,
        religion: String
    },

   familyMembers: [
    {
        name: String,
        age: Number,
        gender: String,
        relation: String,
        civilStatus: String,
        occupation: String,
        birthdate: Date
    }
],

    sitio: {
        type: Number,
        required: true
    }

});

module.exports = mongoose.model("Resident", ResidentSchema);