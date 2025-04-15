import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const transformData = (json) => {
    // Extract the fields array and data array
    const { fields, data } = json;

    // Map over the data array to transform each entry
    return data.map((entry) => {
        const transformedObject = {};
        // Map the required fields to new keys
        fields.forEach((field, index) => {
            if (field === "des") {
                transformedObject["name"] = entry[index];
            } else if (field === "cd") {
                transformedObject["date"] = new Date(entry[index]);
            } else if (field === "dist") {
                transformedObject["dist"] = entry[index];
            } else if (field === "v_rel") {
                transformedObject["relativeVelocity"] = entry[index];
            }
        });
        transformedObject['isEditable'] = new Date(transformedObject["date"]) < new Date() ? false : true
        return transformedObject;
    });
};

const transformDataImpact = (json) => {
    // Extract the fields array and data array
    const { data } = json;
// des, diameter, n_imp, range,  
    // Map over the data array to transform each entry
    return data.map((entry) => {
        return {des: entry.des, diameter: entry.diameter, n_impact: entry.n_imp, range: entry.range}
    });
};

// Function to read JSON file
const readJsonFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err); // Handle error
            } else {
                try {
                    const jsonData = JSON.parse(data); // Parse JSON string into an object
                    resolve(jsonData);
                } catch (parseError) {
                    reject(parseError); // Handle JSON parse error
                }
            }
        });
    });
};

let json = {};
await readJsonFile('./objects_copy.json')
    .then((jsonData) => json = jsonData)
    .catch((error) => console.error('Error reading JSON file:', error));

let mongoObjects = transformData(json)

let jsonImpact = {};
await readJsonFile('./impact_copy.json')
    .then((jsonData) => jsonImpact = jsonData)
    .catch((error) => console.error('Error reading JSON file:', error));

let mongoImpacts = transformDataImpact(jsonImpact)


const mongoDBClient = new MongoClient("mongodb://localhost:27017");

// const connectDb = async () => {
//     await mongoDBClient.connect();
//     const db = mongoDBClient.db("space");
//     const objectsCollection = db.collection("objects");
//     const impactCollection = db.collection("impacts"); // Add the second collection
//     return { objectsCollection, impactCollection };
// };

await dropDatabase();

insertDataToObjects(mongoObjects);
insertDataToImpacts(mongoImpacts);

app.get('/', (req, res) => {
    res.send("Hello friend!");
});

app.get('/objects', async (req, res) => {
    await mongoDBClient.connect();
    const db = mongoDBClient.db("space");

    // Get the "objects" collection
    const objectsCollection = db.collection("objects");

    const allObjects = await objectsCollection.find({}).toArray();
    res.json(allObjects);
});


app.get('/count', async (req, res) => {
    await mongoDBClient.connect();

    const db = mongoDBClient.db("space");
    const objectsCollection = db.collection("objects");

    // Perform the aggregation query
    const duplicatesCursor = objectsCollection.aggregate([
      {
        $group: {
          _id: "$name", // Group by the "name" field
          count: { $sum: 1 } // Count occurrences of each "name"
        }
      },
      {
        $match: {
          count: { $gt: 1 } // Filter groups where count is greater than 1 (duplicates)
        }
      },
      {
        $project: {
          name: "$_id", // Rename "_id" to "name"
          count: 1, // Include the count
          _id: 0 // Exclude the default "_id" field
        }
      }
    ]);

    // Convert the cursor to an array to retrieve results
    const duplicates = await duplicatesCursor.toArray();

    console.log("Duplicate objects:", duplicates);
      
});

// Json web token or key API. Or certificates. To handle roles: admin, scientist, observer
// https://www.youtube.com/watch?v=uSh5YRpqHog




// Filtering instead of finding and then filtering

app.get('/objects/:name', async (req, res) => {
    await mongoDBClient.connect();
    const db = mongoDBClient.db("space");

    // Get the "objects" collection
    const objectsCollection = db.collection("objects");

    let name = req.params.name;
    // const allObjects = await objectsCollection.findOne({ name });

    const matchingObjects = await objectsCollection
       .find({ name: { $regex: name, $options: 'i' } })
       .toArray();

    res.json(matchingObjects);
});


app.delete('/delete/:name', async (req, res) => {
    const db = mongoDBClient.db("space");
    const objectsCollection = db.collection("objects");
    
    // Proper deletion using MongoDB's delete operation
    const deleteResult = await objectsCollection.deleteOne({ 
        name: req.params.name 
    });

    if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ error: "Object not found" });
    }

    res.json({
        message: "Successfully deleted",
        deletedCount: deleteResult.deletedCount
    });
});

app.put('/update/:name', async (req, res) => {
    try {
        await mongoDBClient.connect();
        const db = mongoDBClient.db("space");
        const objectsCollection = db.collection("objects");

        const { name } = req.params;
        console.log(req);
        const { date, dist, relativeVelocity } = req.body;

        const today = new Date();
        const providedDate = new Date(date); //UTC

        if (providedDate <= today) {
            return res.status(400).json({
                message: "Date must be greater than today's date to update properties."
            });
        }

        const updateResult = await objectsCollection.updateOne(
            { name }, 
            {
                $set: {
                    date,
                    dist,
                    relativeVelocity
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                message: `Object with name '${name}' not found.`
            });
        }

        res.json({
            message: "Successfully updated",
            modifiedCount: updateResult.modifiedCount
        });
    } catch (error) {
        console.error('Error updating object:', error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    } finally {
        await mongoDBClient.close();
    }
});


app.put('/update/:name', async (req, res) => {
    try {
        await mongoDBClient.connect();
        const db = mongoDBClient.db("space");
        const objectsCollection = db.collection("objects");

        const { name } = req.params;
        console.log(req);
        const { date, dist, relativeVelocity } = req.body;

        const today = new Date();
        const providedDate = new Date(date); //UTC

        if (providedDate <= today) {
            return res.status(400).json({
                message: "Date must be greater than today's date to update properties."
            });
        }

        const updateResult = await objectsCollection.updateOne(
            { name }, 
            {
                $set: {
                    date,
                    dist,
                    relativeVelocity
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                message: `Object with name '${name}' not found.`
            });
        }

        res.json({
            message: "Successfully updated",
            modifiedCount: updateResult.modifiedCount
        });
    } catch (error) {
        console.error('Error updating object:', error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    } finally {
        await mongoDBClient.close();
    }
});

app.post('/create', async (req, res) => {
    try {
        await mongoDBClient.connect();
        const db = mongoDBClient.db("space");
        const objectsCollection = db.collection("objects");

        // Destructure required fields from request body
        const { name, date, dist, relativeVelocity } = req.body;

        // Validate required fields
        if (!name || !date || !dist || !relativeVelocity) {
            return res.status(400).json({
                message: "All fields (name, date, dist, relativeVelocity) are required."
            });
        }

        // Check if date is in the future
        const today = new Date();
        const providedDate = new Date(date);
        if (providedDate <= today) {
            return res.status(400).json({
                message: "Date must be greater than today's date to create new object."
            });
        }

        // Check for existing object with same name
        const existingObject = await objectsCollection.findOne({ name });
        if (existingObject) {
            return res.status(409).json({
                message: `Object with name '${name}' already exists. Use PUT to update.`
            });
        }

        // Insert new document
        const insertResult = await objectsCollection.insertOne({
            name,
            date,
            dist,
            relativeVelocity,
            isEditable: true
        });

        res.status(201).json({
            message: "Successfully created",
            insertedId: insertResult.insertedId
        });
    } catch (error) {
        console.error('Error creating object:', error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    } finally {
        await mongoDBClient.close();
    }
});

app.get('/impact', async(req, res)=>{
        await mongoDBClient.connect();
        const db= mongoDBClient.db('space');
        const objectsCollection = db.collection('impacts');
        const allObjects = await objectsCollection.find({}).toArray();
        res.json(allObjects);
});




app.listen(4000, () => {
    console.log("Space is on air");
});

async function insertDataToObjects(data) {
    try {
        // Connect to MongoDB
        await mongoDBClient.connect();
        const db = mongoDBClient.db("space");

        // Get the "objects" collection
        const objectsCollection = db.collection("objects");

        // Insert multiple documents into "objects" collection
        const result = await objectsCollection.insertMany(data);

        console.log(`${result.insertedCount} documents were successfully inserted into the "objects" collection.`);
    } catch (error) {
        console.error('Error inserting data:', error);
    } finally {
        await mongoDBClient.close();
    }
};

async function insertDataToImpacts(data) {
    try {
        // Connect to MongoDB
        await mongoDBClient.connect();
        const db = mongoDBClient.db("space");

        // Get the "impacts" collection
        const impactCollection = db.collection("impacts");

        // Insert multiple documents into "impacts" collection
        const result = await impactCollection.insertMany(data);

        console.log(`${result.insertedCount} documents were successfully inserted into the "impacts" collection.`);
    } catch (error) {
        console.error('Error inserting data:', error);
    } finally {
        await mongoDBClient.close();
    }
};

async function dropDatabase() {
    const client = new MongoClient("mongodb://localhost:27017");
    try {
        await client.connect();
        const db = client.db("space"); // Replace "space" with your database name
        const result = await db.dropDatabase(); // Drop the database
        console.log("Database dropped:", result);
    } catch (error) {
        console.error("Error dropping database:", error);
    } finally {
        await client.close();
    }
}