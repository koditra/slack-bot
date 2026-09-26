# Ash's Right Hand

Ash's Right Hand is a Slack bot with a bunch of small useful and stupid features. I made it mostly because I wanted a bot that could do a few things for me without needing a huge setup.

## What it does

- `/ash-ping` - Checks the bot's latency
- `/ash-roast @user` - Sends a random roast for a user
- `/ash-dms 7` - Shows your 7 most recent DMs
- `/ash-dms reply 1 3 5 Hey!` - Replies to multiple DMs at once
- Reacts with `:67:` whenever someone says `67`
- Randomly says `woof` in threads

## How I made it

I made the bot using JavaScript with Node.js and Slack Bolt. I used Slack's Socket Mode so the bot can receive events without needing to host a public HTTP endpoint.

I started with a basic Slack app and got the bot connected first. Then I added the features one at a time. The slash commands are handled by Slack Bolt, and each command has its own logic for figuring out what the user typed and what response to send.

For the DM command, I made it so the bot can first list recent conversations and then use the numbers from that list to choose which DMs to reply to. This makes it possible to reply to multiple conversations from one command instead of opening each one individually.

The smaller features, like the `67` reaction and random `woof` messages, are event-based. The bot watches for certain Slack events and responds when the right thing happens.

## Commands

### `/ash-ping`

Checks how quickly the bot responds.

```text
/ash-ping
