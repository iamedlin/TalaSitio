const mongoose = require("mongoose");

const ResidentSchema = new mongoose.Schema({

    head: {
        name: { type: String, required: true },
        age: { type: Number, required: true },
        gender: String,
        civilStatus: String,
        contact: String,
        work: String,
        socialClass: String,
        religion: String
    },

    familyMembers: [
        {
            name: String,
            age: Number,
            relation: String
        }
    ],

    sitio: {
        type: Number,
        required: true
    }

});

module.exports = mongoose.model("Resident", ResidentSchema);