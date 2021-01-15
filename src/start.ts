import * as dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 3001;
import app from "./app";

app.listen(port, () => console.log(`Server running on port ${port}`));
