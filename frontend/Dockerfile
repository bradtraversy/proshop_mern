FROM node:16-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); pkg.proxy = "http://backend:5000"; pkg.scripts.start = "react-scripts start"; pkg.scripts.build = "react-scripts build"; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'

ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["npm", "start"]