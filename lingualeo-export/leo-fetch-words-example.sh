#!/bin/bash

set -euo pipefail

source ENV

curl --request POST \
    --url https://api.lingualeo.com/GetWords \
    --header 'content-type: application/json' \
    --cookie 'remember="'${remember}'";userid='${userid}'' \
    --data '{
    "dateGroup": "year_1",
    "perPage": 10,
    "wordSetId": 1,
    "offset": {
        "wordId": 1181384364
    }
}'
