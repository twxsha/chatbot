import express from 'express';
import mysql from 'mysql2';
import { OpenAI } from 'openai';
import fs from 'fs';
import { Pinecone } from "@pinecone-database/pinecone";
import cors from 'cors';
import {pipeline} from '@xenova/transformers';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function main() {
    const app = express();

    // Create OpenAI Instance
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    // Connect to Pinecone
    const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENV
    });
    const index = pinecone.Index(process.env.PINECONE_INDEX);

    // MySQL database configuration
    const db = mysql.createConnection({
        host: process.env.MY_SQL_HOST,
        user: process.env.MY_SQL_USERNAME,
        password: process.env.MY_SQL_PASSWORD,
        database: process.env.MY_SQL_DATABASE,
    });

    var userMessages = "";

    // Connect to MySQL
    db.connect((err) => {
        if (err) {
            console.error('Error connecting to MySQL:', err);
            db.end();
        } else {
            console.log('Connected to MySQL');
            const query = "SELECT IFNULL(MercorUsers.userId, 0) AS userId, IFNULL(MercorUsers.email, 0) AS email, IFNULL(MercorUsers.name, 0) AS name, IFNULL(MercorUsers.phone, 0) AS phone, IFNULL(MercorUsers.preferredRole, 0) AS preferredRole,      IFNULL(MercorUsers.fullTimeStatus , 0) AS fullTimeStatus,      IFNULL(MercorUsers.residence, 0) AS residence,      IFNULL(MercorUsers.workAvailability , 0) AS workAvailability,      IFNULL(MercorUsers.fullTimeSalaryCurrency , 0) AS fullTimeSalaryCurrency,      IFNULL(MercorUsers.fullTimeSalary , 0) AS fullTimeSalary,       IFNULL(MercorUsers.partTimeSalaryCurrency , 0) AS partTimeSalaryCurrency,     IFNULL(MercorUsers.partTimeSalary , 0) AS partTimeSalary,     IFNULL(MercorUsers.fullTime , 0) AS fullTime,     IFNULL(MercorUsers.fullTimeAvailability , 0) AS fullTimeAvailability,     IFNULL(MercorUsers.partTime , 0) AS partTime,     IFNULL(MercorUsers.partTimeAvailability , 0) AS partTimeAvailability,     GROUP_CONCAT(DISTINCT Skills.skillName) AS skills,     GROUP_CONCAT(DISTINCT WorkExperience.company) AS companies,     GROUP_CONCAT(DISTINCT WorkExperience.role) AS roles,     GROUP_CONCAT(DISTINCT WorkExperience.description) AS descriptions,     GROUP_CONCAT(DISTINCT Education.degree) AS degrees,     GROUP_CONCAT(DISTINCT Education.major) AS majors,     GROUP_CONCAT(DISTINCT Education.school) AS schools,     GROUP_CONCAT(DISTINCT Education.grade) AS grades FROM MercorUsers  LEFT JOIN MercorUserSkills ON MercorUsers.userId = MercorUserSkills.userId  LEFT JOIN Skills ON MercorUserSkills.skillId = Skills.skillId  LEFT JOIN UserResume ON MercorUsers.userId = UserResume.userId  LEFT JOIN Education ON UserResume.resumeId = Education.resumeId  LEFT JOIN WorkExperience ON UserResume.resumeId = WorkExperience.resumeId  LEFT JOIN PersonalInformation ON UserResume.resumeId = PersonalInformation.resumeId  GROUP BY MercorUsers.userId"
            db.query(query, async (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                } else {
                    console.log('DB successfully queried:', results.length, "rows");
                    for (const row of results) {
                        const inputText = `preferredRole:${row.preferredRole}, full time status:${row.fullTimeStatus}, residence:${row.residence}, work availability:${row.workAvailability}, full time salary currency:${row.fullTimeSalaryCurrency}, full time salary ${row.fullTimeSalary}, part time salary currency:${row.partTimeSalaryCurrency}, part time salary:${row.partTimeSalary}, full time:${row.fullTime}, full time availability:${row.fullTimeAvailability}, part time:${row.partTime}, part time availability:${row.partTimeAvailability}, skills:${row.skills}, companies:${row.companies}, roles:${row.roles}, degrees:${row.degrees}, majors:${row.majors}, schools:${row.schools}, grades:${row.grades}`;
                        
                        // text to vector using sentence-transformers
                        const extractor = await pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5');
                        const output = await extractor(inputText, { pooling: 'mean', normalize: true });
                        await index.upsert([{ id: row.userId.toString(),  values: Array.from(output.data) }]);
                    }
                }
                console.log("db size",index._describeIndexStats.length);
            });
        }
    });

    const assistant = await openai.beta.assistants.create({
        name: 'mercor chatbot',
        model: 'gpt-3.5-turbo-1106',
        instructions: 'Your name is Marcus and you are my AI hiring assistant, mention this in your greeting. You are helping find candidates from the database that match the requirements specified by the user. You primarily want to know whether they are looking to hire full-time or part-time, what their budget is and what skills they want their candidate to have. Limit your messages to 2 sentences.',
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
        if (message !== "hi") {
            console.log("msg not hi");
            userMessages += message;
            const extractor = await pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5');
            const output = await extractor(userMessages, { pooling: 'mean', normalize: true });
            console.log("message embedding");
            // use embedding to query pinecone (get userid)
            const queryResponse = await index.query({
                vector: Array.from(output.data),
                topK: 3,
                includeValues: false,
            });
            console.log("embed message");
            // have assistant display results (query sql to find name, education, skills, email, and phone)
            var candidates = [];
            db.connect((err) => {
                if (err) {
                    console.error('Error connecting to MySQL:', err);
                    db.end();
                } else {
                    console.log('Connected to MySQL');
                    queryResponse.matches.forEach(match => {
                        console.log(match.id);
                        const query = `SELECT   IFNULL(MercorUsers.userId, 0) AS userId,   IFNULL(MercorUsers.email, "n/a") AS email,   IFNULL(MercorUsers.name, "Anonymous") AS name,   IFNULL(MercorUsers.phone, "n/a") AS phone,   IFNULL(GROUP_CONCAT(DISTINCT Skills.skillName), "n/a") AS skills,   IFNULL(GROUP_CONCAT(DISTINCT WorkExperience.company), "n/a") AS companies,   IFNULL(GROUP_CONCAT(DISTINCT Education.school), "n/a") AS schools FROM MercorUsers LEFT JOIN MercorUserSkills ON MercorUsers.userId = MercorUserSkills.userId LEFT JOIN Skills ON MercorUserSkills.skillId = Skills.skillId LEFT JOIN UserResume ON MercorUsers.userId = UserResume.userId LEFT JOIN Education ON UserResume.resumeId = Education.resumeId LEFT JOIN WorkExperience ON UserResume.resumeId = WorkExperience.resumeId LEFT JOIN PersonalInformation ON UserResume.resumeId = PersonalInformation.resumeId WHERE MercorUsers.userId = "${match.id}" GROUP BY MercorUsers.userId`;
                        db.query(query, async (err, results) => {
                            if (err) {
                                console.error('Error executing query:', err);
                            } else {
                                console.log('DB successfully queried:', results.length, "rows");
                                for (const row of results) {
                                    candidates.push({name: row.name, schools: row.schools, skills: row.skills, companies: row.companies, email: row.email, phone: row.phone })
                                }
                                console.log(candidates);
                            }
                        });
                    });
                }
            });
        }
        const messages = await openai.beta.threads.messages.list(
            thread_id
        );
        var run = await openai.beta.threads.runs.create( thread_id, { assistant_id: assistant.id, } );
        console.log("run",run);

        while (run.status !== "completed") {
            run = await openai.beta.threads.runs.retrieve(thread_id, run.id);
            console.log("run", run.status);
        }
         
        const chatbotResponse = await openai.beta.threads.messages.list(thread_id);
        const latestMessage = chatbotResponse.data[0].content[0].text.value;
        console.log("response", latestMessage);

        // Send the response back to the client
        try {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'POST');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            res.json({ response: {candidates: candidates, message: latestMessage} });
        } catch (error) {
            console.error('Error handling request:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
main();
