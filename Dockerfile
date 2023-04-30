#Getting base amazon linux
FROM amazonlinux:2 as installer
#Installing awscli in this base
#unzip wont be in base linux image
#install command with instructing the bin dir
ARG EXE_FILENAME=awscli-exe-linux-x86_64.zip
RUN yum upgrade -y \
    && curl https://awscli.amazonaws.com/$EXE_FILENAME -o $EXE_FILENAME \
    && yum install -y unzip \
    && unzip $EXE_FILENAME \
    && ./aws/install --bin-dir /aws-cli-bin/ \
    && yum clean install

FROM amazonlinux:2
COPY --from=installer /usr/local/aws-cli/ /usr/local/aws-cli/
COPY --from=installer /aws-cli-bin/ /usr/local/bin/
#Can add org certs here and host this as base amazonlinux for your org with awscli and some essential plugins
RUN yum install -y which less wget ter zip openssl jq curl unzip \
    && yum clea install
#If you have yore certs in s3 you can sync it with imae by runnin s3 sync commands.
#<-------Base---->

#NODE_ENV = development
#PORT = 5000
#MONGO_URI = your mongodb uri
#JWT_SECRET = 'abc123'
#PAYPAL_CLIENT_ID = your paypal client id
#Here we can add these varaiables in envs easily but adding secretsa dn client ids in git and image is a security breach.
#So assuming these variables are added in jenkins credentials like per environment ("dev_JWT_SECRET") and added to SSM or secrets manager throuh a stage in jenkins CI pipeline

#setting Node and yarn version
ENV NODE_VERSION="15.8.0"
ENV YARN_VERSION="1.17.3"
#dowloading node and untarin into node dir
#yarn url needs correction maybe
RUN curl -SL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz" --output nodejs.tar.gz \
    && mkdir node \
    && tar -xzf "nodejs.tar.gz" -C node/ \
    && curl -SL "https://yarnpkg.com/${YARN_VERSION}/yarn-v${YARN_VERSION}.tar.gz" --output yarn.tar.gz \
    && mkdir yarn \
    && tar -xzf "yarn.tar.gz" -C yan /

COPY --from=istaller node/* /usr/local/
COPY --from=istaller yarn/* /opt/yarn/
#COPY everything in the folder to destination /app/
COPY . /app/

WORKDIR /app

#Here we may need to set the artifactory configs since upcoming steps will require npm installations
#sample
#Linking node dir

RUN npm config set registry https://artifactory.com/npm-folder/ \
    && npm install npm@latest -g \
    &&  ln -s /usr/local/bin/node /usr/local/bin/nodejs \
    && chmod +x /app/entrypoint.sh
#Default env path includes /usr/local/bin already
ENV PATH="${PATH}:/opt/yarn/bin"

ENTRYPOINT [ "/app/entrypoint.sh"]

#Along with entrypoint.sh at this point can be considered as a base node.js image.

<-------Actual docker specific to application ---->

RUN yum install findutils -y
#install essential security stuffs if needed for your application in ci/cd stages

ENV NODE_ENV=$ENVIRONMENT
ENV NODE_PORT=5000

RUN cd frontend \
    && npm install
    && npm run build
    && yum upgrade -y

COPY --from=installer /app/backend/ ./backend/
COPY --from=installer /app/frontend/ ./frontend/
COPY --from=installer /app/startup.sh/ .

#Addin jenkins variables in env variables
ARG SOURCE_CODE_URL
ARG SOURCE_CODE_ID
ARG BUILD_JOB_URL
ARG BUILD_JOB_ID

ENV SOURCE_CODE_URL=$SOURCE_CODE_URL SOURCE_CODE_ID=$SOURCE_CODE_ID BUILD_JOB_URL=$BUILD_JOB_URL BUILD_JOB_ID=$BUILD_JOB_ID

#Assuming we have correctly created certs for this container using openssl
ENV SSL_ENABLED true
ENV PORT 443

#Already one hour exceeded so I am not creating jenkinsfile for this.




