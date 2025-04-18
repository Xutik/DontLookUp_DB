import { MongoClient } from "mongodb";
import fs from "fs";

const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "space";

// Function to read JSON file
const readJsonFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (parseError) {
          reject(parseError);
        }
      }
    });
  });
};

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
        transformedObject["distance"] = entry[index];
      } else if (field === "v_rel") {
        transformedObject["relativeVelocity"] = entry[index];
      }
    });
    transformedObject["isEditable"] =
      new Date(transformedObject["date"]) < new Date() ? false : true;
    return transformedObject;
  });
};

const transformDataImpact = (json) => {
  const { data } = json;
  return data.map((entry) => {
    return {
      name: entry.des,
      diameter: entry.diameter,
      impact: entry.n_imp,
      range: entry.range,
    };
  });
};

async function dropDatabase() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const result = await db.dropDatabase();
    console.log("Database dropped:", result);
  } catch (error) {
    console.error("Error dropping database:", error);
  } finally {
    await client.close();
  }
}

async function insertDataToDB(objects, impacts) {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const objectsCollection = db.collection("collision");

    const impactsMap = new Map(impacts.map((impact) => [impact.name, impact]));

    // Join the two arrays
    let data = objects.map((object) => {
      const impact = impactsMap.get(object.name);
      return {
        ...object,
        ...impact, // Merge impact data if it exists
      };
    });
    
    // Sort data to have isEditable: true items first
    data = data.sort((a, b) => {
      // Sort in descending order by isEditable (true values first)
      return b.isEditable === a.isEditable ? 0 : b.isEditable ? 1 : -1;
    });

    // Insert multiple documents into "objects" collection
    const result = await objectsCollection.insertMany(data);

    console.log(
      `${result.insertedCount} documents were successfully inserted into the "collision" collection.`
    );
  } catch (error) {
    console.error("Error inserting data:", error);
  } finally {
    await client.close();
  }
}

// Main execution
async function setupDatabase() {
  try {
    console.log("Reading data files...");
    
    // Read and transform objects data
    const objectsJson = await readJsonFile("./data/objects.json");
    const mongoObjects = transformData(objectsJson);
    
    // Read and transform impacts data
    const impactsJson = await readJsonFile("./data/impact.json");
    const mongoImpacts = transformDataImpact(impactsJson);
    
    console.log("Dropping existing database...");
    await dropDatabase();
    
    console.log("Inserting transformed data into database...");
    await insertDataToDB(mongoObjects, mongoImpacts);
    
    console.log("Database setup complete!");
  } catch (error) {
    console.error("Error setting up database:", error);
    process.exit(1);
  }
}

setupDatabase();
