const express = require('express');
const mysql = require('mysql2');
const app = express();
const { OpenAI } = require('openai');
const fs = require('fs');
const { Pinecone } = require("@pinecone-database/pinecone");
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

async function main() {

    // MySQL database configuration
    const db = mysql.createConnection({
        host: process.env.MY_SQL_HOST,
        user: process.env.MY_SQL_USERNAME,
        password: process.env.MY_SQL_PASSWORD,
        database: process.env.MY_SQL_DATABASE,
    });

    // Connect to MySQL
    db.connect((err) => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
        } else {
            console.log('Connected to MySQL');
        }
    });

    // Connect to Pinecone
    const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENV
    });
    const index = pinecone.Index(process.env.PINECONE_INDEX);

    // Create OpenAI Instance
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })
    const assistant = await openai.beta.assistants.create({
        name: 'mercor chatbot',
        model: 'gpt-3.5-turbo-1106',
        instructions: 'Your name is Marcus and you are a hiring assistant, mention this in your greeting. You are helping find candidates from the database that match the requirements specified by the user. You primarily want to know whether they are looking to hire full-time or part-time, what their budget is and what skills they want their candidate to have.',
    });
    const thread = await openai.beta.threads.create();
    console.log("thread", thread, thread.id)
    const thread_id = thread.id

    // Start the server
    const PORT = process.env.MY_SQL_PORT | 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    app.use(express.json());
    app.use(cors());

    app.post('/getChatbotResponse', async (req, res) => {
        const { message } = req.body;
        console.log("request", message);
        const sendMessage = await openai.beta.threads.messages.create(
            thread_id,
            {
                role: "user",
                content: message
            }
        );
        const messages = await openai.beta.threads.messages.list(
            thread_id
        );
        console.log("messages", messages);

        var run = await openai.beta.threads.runs.create(
            thread_id,
            {
                assistant_id: assistant.id,
            }
        );
        console.log("run",run);

        while (run.status !== "completed") {
            run = await openai.beta.threads.runs.retrieve(thread_id, run.id);
            console.log("run", run.status);
        }
         
        const chatbotResponse = await openai.beta.threads.messages.list(
            thread_id
        );

        latestMessage = chatbotResponse.data[0].content[0].text.value;
        console.log("response", latestMessage);

        // Send the response back to the client
        try {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'POST');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            res.json({ response: latestMessage });
        } catch (error) {
            console.error('Error handling request:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
main();