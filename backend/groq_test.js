const Groq = require('./node_modules/groq-sdk');
require('dotenv').config({ path: '../.env' });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
    try {
        const models = await groq.models.list();
        console.log("SUCCESS! Models:");
        console.log(models.data.map(m => m.id));
    } catch (error) {
        console.error("ERROR:", error.message);
        if (error.response) {
            console.error(error.response.data);
        }
    }
}
main();
