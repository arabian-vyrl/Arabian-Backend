const mongoose = require("mongoose");

let wellingtonConnection = null;

const getWellingtonConnection = async () => {
    if (
        wellingtonConnection &&
        wellingtonConnection.readyState === 1
    ) {
        return wellingtonConnection;
    }

    if (!process.env.WELLINGTON_DB_URL) {
        throw new Error("WELLINGTON_DB_URL is not defined");
    }

    wellingtonConnection = await mongoose
        .createConnection(process.env.WELLINGTON_DB_URL)
        .asPromise();

    console.log("Wellington database connected");

    return wellingtonConnection;
};

module.exports = getWellingtonConnection;