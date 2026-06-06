import { loadConfig } from "../config.js";
import { createDatabase } from "./index.js";

const config = loadConfig();
const database = createDatabase(config);
database.client.close();
