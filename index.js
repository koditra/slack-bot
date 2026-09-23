require("dotenv").config();

const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

const dmCache = new Map();

const roasts = [
  "I've seen loading screens with more progress than you.",
  "You're not procrastinating. You're just doing side quests.",
  "Your Wi-Fi has a stronger work ethic than you.",
  "I would explain it, but I left my crayons at home.",
  "You have the confidence of someone who definitely didn't read the instructions.",
  "You're proof that autocorrect can't fix everything.",
  "That idea has potential. Unfortunately, so does a potato.",
  "You bring a lot to the table. Mostly confusion.",
  "I've seen NPCs make faster decisions.",
  "Your brain is running on power-saving mode.",
  "You somehow made a simple task a boss fight.",
  "Respectfully, what are you cooking?",
  "That was certainly one of the decisions of all time.",
  "You're not late. You're just operating on your own timezone.",
  "I've seen Git merge conflicts with better communication.",
  "Your productivity is currently in airplane mode.",
  "Bold strategy. Let's see if it survives contact with reality.",
  "You have successfully turned a two-minute task into a side project."
];

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function formatDays(days) {
  return days === 1 ? "1 day" : `${days} days`;
}

app.command("/ash-ping", async ({ ack, respond }) => {
  const start = Date.now();

  await ack();

  const latency = Date.now() - start;

  await respond({
    text: `Pong!\nLatency: ${latency}ms`
  });
});

app.command("/ash-roast", async ({ ack, command, respond }) => {
  await ack();

  const target = command.text.trim();

  if (!target) {
    return await respond({
      text: "Usage: `/ash-roast @user`"
    });
  }

  await respond({
    text: `${target}\n${getRandomItem(roasts)}`
  });
});

app.command("/ash-dms", async ({ command, ack, respond }) => {
  await ack();

  const args = command.text.trim();

  if (!args) {
    return await respond({
      text:
        "*Ash DMs*\n\n" +
        "`/ash-dms 30` - Show DMs from the last 30 days\n" +
        "`/ash-dms 7` - Show DMs from the last 7 days\n" +
        "`/ash-dms reply 1 Hey!` - Reply to DM #1\n" +
        "`/ash-dms reply 1 3 5 Hey!` - Reply to DMs #1, #3, and #5"
    });
  }

  const parts = args.split(/\s+/);

  if (parts[0].toLowerCase() === "reply") {
    if (parts.length < 3) {
      return await respond({
        text:
          "Usage:\n" +
          "`/ash-dms reply 1 Hey!`\n" +
          "`/ash-dms reply 1 3 5 Hey!`"
      });
    }

    const cachedDMs = dmCache.get(command.user_id);

    if (!cachedDMs) {
      return await respond({
        text:
          "I don't have your DM list loaded.\n\n" +
          "Run `/ash-dms 30` first."
      });
    }

    const selectedNumbers = [];
    let messageStart = -1;

    for (let i = 1; i < parts.length; i++) {
      if (!/^\d+$/.test(parts[i])) {
        messageStart = i;
        break;
      }

      const number = Number(parts[i]);

      if (number >= 1 && number <= 8) {
        selectedNumbers.push(number);
      } else {
        messageStart = i;
        break;
      }
    }

    if (messageStart === -1) {
      return await respond({
        text:
          "You need to include a message.\n\n" +
          "Example: `/ash-dms reply 1 3 5 Hey!`"
      });
    }

    if (selectedNumbers.length === 0) {
      return await respond({
        text: "Choose at least one DM number from 1-8."
      });
    }

    const uniqueNumbers = [...new Set(selectedNumbers)];
    const replyText = parts.slice(messageStart).join(" ");

    const selectedDMs = uniqueNumbers
      .map((number) => cachedDMs[number - 1])
      .filter(Boolean);

    if (selectedDMs.length === 0) {
      return await respond({
        text: "None of those DM numbers exist. Run `/ash-dms 30` again."
      });
    }

    await respond({
      text: `Sending to ${selectedDMs.length} DM${selectedDMs.length === 1 ? "" : "s"}...`
    });

    const results = [];

    for (const dm of selectedDMs) {
      try {
        await app.client.chat.postMessage({
          token: process.env.SLACK_USER_TOKEN,
          channel: dm.channel,
          text: replyText
        });

        results.push(`✓ ${dm.number}. ${dm.name}`);
      } catch (error) {
        console.error(error);

        results.push(
          `✗ ${dm.number}. ${dm.name} - ${
            error.data?.error || error.message
          }`
        );
      }
    }

    await respond({
      text:
        `*DM replies*\n\n` +
        results.join("\n") +
        `\n\nMessage: ${replyText}`
    });

    return;
  }

  const days = Number(parts[0]);

  if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
    return await respond({
      text:
        "Please enter a valid number of days.\n\n" +
        "Example: `/ash-dms 30`"
    });
  }

  try {
    await respond({
      text: `Loading DMs from the last ${formatDays(days)}...`
    });

    const userToken = process.env.SLACK_USER_TOKEN;

    if (!userToken) {
      return await respond({
        text: "SLACK_USER_TOKEN is missing from your .env file."
      });
    }

    const oldest = Math.floor(
      (Date.now() - days * 24 * 60 * 60 * 1000) / 1000
    );

    const conversations = [];
    let conversationCursor = "";

    do {
      const result = await app.client.conversations.list({
        token: userToken,
        types: "im",
        limit: 200,
        cursor: conversationCursor || undefined
      });

      conversations.push(...(result.channels || []));

      conversationCursor =
        result.response_metadata?.next_cursor || "";
    } while (conversationCursor);

    const dms = [];

    for (const conversation of conversations) {
      const messages = [];
      let messageCursor = "";

      do {
        const result = await app.client.conversations.history({
          token: userToken,
          channel: conversation.id,
          oldest: oldest.toString(),
          limit: 200,
          cursor: messageCursor || undefined
        });

        messages.push(...(result.messages || []));

        messageCursor =
          result.response_metadata?.next_cursor || "";

        if (messages.length >= 20) {
          break;
        }
      } while (messageCursor);

      if (messages.length === 0) {
        continue;
      }

      let name = conversation.user;

      try {
        const userResult = await app.client.users.info({
          token: userToken,
          user: conversation.user
        });

        const user = userResult.user;

        name =
          user.profile?.display_name ||
          user.profile?.real_name ||
          user.real_name ||
          conversation.user;
      } catch (error) {
        console.error("Could not get user:", error);
      }

      dms.push({
        channel: conversation.id,
        name,
        messages
      });
    }

    dms.sort((a, b) => {
      return Number(b.messages[0].ts) - Number(a.messages[0].ts);
    });

    if (dms.length === 0) {
      return await respond({
        text: `No DMs found in the last ${formatDays(days)}.`
      });
    }

    const numberedDMs = dms.map((dm, index) => ({
      ...dm,
      number: index + 1
    }));

    dmCache.set(command.user_id, numberedDMs);

    const output = numberedDMs.map((dm) => {
      const recentMessages = dm.messages
        .slice(0, 5)
        .reverse()
        .map((message) => {
          const date = new Date(Number(message.ts) * 1000);

          return (
            `_${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit"
            })}_\n` +
            `${message.text || "(no text)"}`
          );
        })
        .join("\n\n");

      return `*${dm.number}. ${dm.name}*\n${recentMessages}`;
    });

    const header =
      `*DMs from the last ${formatDays(days)}*\n\n` +
      `Reply using:\n` +
      "`/ash-dms reply 1 3 5 message`\n\n";

    const chunks = [];
    let current = header;

    for (const section of output) {
      if ((current + section).length > 3500) {
        chunks.push(current);
        current = section + "\n\n";
      } else {
        current += section + "\n\n";
      }
    }

    if (current.trim()) {
      chunks.push(current);
    }

    for (const chunk of chunks) {
      await respond({
        text: chunk
      });
    }
  } catch (error) {
    console.error(error);

    await respond({
      text:
        `Something went wrong:\n\`${error.data?.error || error.message}\``
    });
  }
});

app.event("message", async ({ event, client }) => {
  if (
    event.subtype ||
    event.bot_id ||
    !event.text
  ) {
    return;
  }

  const text = event.text.trim();

  if (text === "67") {
    try {
      await client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: "67"
      });
    } catch (error) {
      console.error("Could not add 67 reaction:", error.data?.error || error.message);
    }
  }

  if (
    event.thread_ts &&
    Math.random() < 0.02
  ) {
    try {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: "woof"
      });
    } catch (error) {
      console.error("Could not woof:", error.data?.error || error.message);
    }
  }
});

(async () => {
  await app.start();

  console.log("Ash's Right Hand is running!");
})();