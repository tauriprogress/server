import { Db, MongoClient } from "mongodb";
import environment from "../environment";
import { ERR_DB_CONNECTION } from "../helpers/errors";

class DBConnection {
    private connection: Db | undefined;
    private client: MongoClient | undefined;

    public async connect() {
        try {
            console.log("Connecting to database");
            const client = new MongoClient(
                `mongodb+srv://${environment.MONGODB_USER}:${environment.MONGODB_PASSWORD}@${environment.MONGODB_ADDRESS}`
            );
            await client.connect();

            this.client = client;
            this.connection = this.client.db("tauriprogress");
        } catch (err) {
            throw err;
        }
    }

    public getConnection() {
        if (this.connection) {
            return this.connection;
        }

        throw ERR_DB_CONNECTION;
    }

    public getClient() {
        if (this.client) {
            return this.client;
        }

        throw ERR_DB_CONNECTION;
    }

    public async disconnect() {
        await this.client?.close();
        this.connection = undefined;
        this.client = undefined;
    }
}

const dbConnection = new DBConnection();

export default dbConnection;
