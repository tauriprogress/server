import environment from "./environment";

import app from "./app";

app.listen(environment.PORT, () =>
    console.log(`Server running on port:${environment.PORT}`)
);
