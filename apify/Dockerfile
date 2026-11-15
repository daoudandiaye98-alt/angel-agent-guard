FROM apify/actor-node:22
COPY package*.json ./
RUN npm --quiet set progress=false && npm install --omit=dev --no-optional && echo "Installed NPM packages:" && (npm list --omit=dev --all || true)
COPY . ./
CMD npm start --silent
