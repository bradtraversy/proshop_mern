#!/usr/bin/env bash

set -o errexit

ENV_FILE="/app/.envfile"

#we need to definiteluy add some cert creations here throuhh openssl commands and export it

#openssl req -x509 ###############
# openssl pksc12 -export -out /app/cert.pfx -inkey /app/cert.key ####

#We already assumed your secrets are in ssm or secrets manager
#Assuming the below variables are from jenkins build
if [ $ENVIRONMENT == "dev"]; then
  aws smm get-parameters-by-path --path "/$ENVIRONMENT/$APP_NAME" --with-description --region $REGION > output.json

  #using jq retrieving datas from json file and adding it to env_file
  #To get and add parameters one by one use while loop
  #Always remenber some special characters in values may cause trouble while starting containers
  jq -c '.Parameters[]' output.json | while read param; do
    #Needs soe work here to collect the name from ssm output response
    key=$(name)
    value=$(echo $i | jq -r "value")
    echo "export $key=$value" >> $ENV_FILE
  done

  if [ -f $ENV_FILE ]; then
    chmod +x $ENV_FILE
    source $ENV_FILE
  else
    echo "No env variables to configure"
  fi
  #deleting used thongs in image
  rm -rf output.json
fi

exec /app/startup.sh "$@"

