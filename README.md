# server

Server of https://github.com/tauriprogress/tauriprogress.github.io

To run locally:
  1. install [node](https://nodejs.org/)
  2. install [git](https://git-scm.com/downloads)
  3. run: git clone https://github.com/tauriprogress/server.git
  6. run: npm install
  7. this server uses mongodb as database, change to url of the mongodb to reference your own in [database.js](https://github.com/tauriprogress/server/blob/master/database.js), variable called: mongoUrl
  8. you need to enable cors to allow requests from your local server of client, to do this: go to [index.js](https://github.com/tauriprogress/server/blob/master/index.js) and change cors origin to http://localhost:3000 (line 31)
  9. setup .env
  10. run: npm start
