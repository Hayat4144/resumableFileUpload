
import http from 'http';
import path from 'path';
import fs from 'fs-extra'
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const client = createClient();

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tlt = 24 * 60 * 60;

const setObjectAsString = async (key, obj) => {
    try {
        const jsonString = JSON.stringify(obj)
        await client.setEx(key, tlt, jsonString)
    } catch (error) {
        console.error('Error setting JSON string:', error);
    }
}

const getObjectFromString = async (key) => {
    try {
        const jsonString = await client.get(key);
        if (!jsonString) {
            return null;
        }
        return JSON.parse(jsonString);
    } catch (err) {
        console.error('Error getting JSON string:', err);
    }
}

const updateUploadedChunks = async (key, chunks) => {
    try {
        const metaData = await client.get(key);
        if (!metaData) {
            throw new Error(`No value found for key ${key}`);
        }
        const objectData = JSON.parse(metaData);


        if (!Array.isArray(objectData.uploadedChunks)) {
            throw new Error("uploadedChunks is not an array.")
        }

        objectData.uploadedChunks.push(chunks);
        const updatedJsonString = JSON.stringify(objectData);
        await client.setEx(key, tlt, updatedJsonString);
        return objectData;

    } catch (error) {
        console.error('Error updating uploadedChunks:', error);
    }
}

const removeMetaData = async (key) => {
    try {
        const result = await client.del(key);
        if (result === 1) {
            console.log(`Key ${key} deleted successfully`);
        } else {
            console.log(`Key ${key} not found`);
        }
    } catch (err) {
        console.error('Error deleting key:', err);
    }
}


const mergeChunks = async (chunkDir, filename) => {
    const filePath = path.resolve(__dirname, 'uploads', filename);
    const writeStream = fs.createWriteStream(filePath);

    const chunks = await fs.readdir(chunkDir);
    chunks.sort((a, b) => a - b);

    for (const chunk of chunks) {
        const chunkPath = path.join(chunkDir, chunk);
        const data = await fs.readFile(chunkPath);
        writeStream.write(data);
        await fs.remove(chunkPath);  // Remove the chunk after writing
    }

    writeStream.end();
    await fs.remove(chunkDir);  // Remove the chunk directory
};



const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Allow specific methods
    res.setHeader('Access-Control-Allow-Headers', '*'); // Allow specific headers

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (req.url === '/') {
        const name = await client.get('myname')
        res.statusCode = 200;
        res.end(`Hello World! ${name} \n`);
    }

    if (req.url === '/uploads') {
        const { filename, chunkindex, totalchunks, fileid, filesize } = req.headers;
        const uploadDir = path.join(__dirname, 'uploads', fileid)

        const isMetaDataExist = await getObjectFromString(`metaData:${fileid}`);

        let metadata = {};
        if (!isMetaDataExist) {
            metadata = {
                fileid,
                filename,
                totalchunks,
                filesize,
                uploadedChunks: []
            }
            setObjectAsString(`metaData:${fileid}`, metadata)

        }
        else {
            metadata = isMetaDataExist;
        }


        await fs.ensureDir(uploadDir)

        const chunkPath = path.join(uploadDir, chunkindex)

        const writeStream = fs.createWriteStream(chunkPath)

        req.pipe(writeStream)

        writeStream.on('finish', async () => {
            const updatedData = await updateUploadedChunks(`metaData:${fileid}`, chunkindex)
            const files = await fs.readdir(uploadDir)

            if (files.length === parseInt(totalchunks)) {
                console.log('All recieved')
                mergeChunks(uploadDir, filename)
                await removeMetaData(`metaData:${fileid}`)
            }


            res.statusCode = 200;
            const responseData = {
                uploadedChunks: updatedData.uploadedChunks,
                message: "Uploaded"
            }
            res.end(JSON.stringify(responseData))
        })

    }
})

server.listen(5000, () => {
    console.log("server is running on port 5000")
})

