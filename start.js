require("dotenv").config();
const port = process.env.PORT || 3001;
const app = require("./src/server");

app.listen(port, () => console.log(`Server running on port ${port}`));
