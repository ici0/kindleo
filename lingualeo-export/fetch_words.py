#!/usr/bin/env python3

import json
import requests


def load_credentials(env_file="ENV"):
    """Load credentials from ENV file."""
    creds = {}
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                creds[key.strip()] = value.strip()
    return creds


def fetch_words_for_group(session, group_name, word_set_id=1, per_page=1000):
    """Fetch all words for a specific group with pagination."""
    url = "https://api.lingualeo.com/GetWords"
    all_words = []
    offset = None

    while True:
        # Build request body
        body = {
            "dateGroup": group_name,
            "perPage": per_page,
            "wordSetId": word_set_id
        }

        if offset is not None:
            body["offset"] = {"wordId": offset}

        # Make request
        response = session.post(url, json=body)
        data = response.json()

        if data.get("status") != "ok":
            print(f"Error fetching group {group_name}: {data}")
            break

        # Find the group in response and extract words
        words = []
        for group in data.get("data", []):
            if group["groupName"] == group_name:
                words = group.get("words", [])
                break

        if not words:
            break

        all_words.extend(words)

        # Check if we need to continue pagination
        if len(words) < per_page:
            break

        # Set offset to last word ID
        offset = words[-1]["id"]

    return all_words


def main():
    # Load credentials
    creds = load_credentials("ENV")
    userid = creds.get("userid")
    remember = creds.get("remember")

    if not userid or not remember:
        print("Error: Missing userid or remember token in ENV file")
        return

    # Create session with cookies
    session = requests.Session()
    session.headers.update({"content-type": "application/json"})
    session.cookies.set("userid", userid)
    session.cookies.set("remember", remember)

    # Discovery phase: fetch groups metadata
    url = "https://api.lingualeo.com/GetWords"
    initial_body = {
        "perPage": 1,
        "wordSetId": 1
    }

    response = session.post(url, json=initial_body)
    initial_data = response.json()

    if initial_data.get("status") != "ok":
        print(f"Error in discovery phase: {initial_data}")
        return

    # Extract all groups with words
    groups_to_fetch = []
    for group in initial_data.get("data", []):
        if group.get("groupCount", 0) > 0:
            groups_to_fetch.append({
                "name": group["groupName"],
                "count": group["groupCount"]
            })

    # Fetch all words from all groups
    all_words = []
    for group_info in groups_to_fetch:
        group_name = group_info["name"]
        words = fetch_words_for_group(session, group_name)
        all_words.extend(words)

    # Print merged results
    print(json.dumps(all_words, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
