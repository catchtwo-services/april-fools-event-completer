const { Client } = require("discord.js-selfbot-v13");
const { getImage, getName } = require("pokehint");
const { solveGlitch } = require("./function/solve.js");
const fs = require("fs");
const chalk = require("chalk");
const package = require("./package.json");
const date = require("date-and-time");

async function start(token) {
  const client = new Client({ checkUpdate: false });

  client.on("ready", () => {
    sendLog(
      client.user.username,
      `Logged in as ${client.user.username}`,
      "info"
    );
    client.user.setActivity("Glitching");
  });

  client.on("messageCreate", async (message) => {
    if (
      message?.embeds[0]?.title?.includes(
        "This pokémon appears to be glitched!"
      ) &&
      (await message?.fetchReference())?.author?.id === client.user.id
    ) {
      const embed = message.embeds[0];
      const glitchUrl = embed.image.url;
      const pokemonName = message.reference?.messageId
        ? (await message.fetchReference()).content.replace(
            /<@716390085896962058>\s+(?:c(?:atch)?)\s+/i,
            ""
          )
        : null;
      const englishName = await getName({
        name: pokemonName,
        language: "English",
      });
      const pokemonImage = await getImage(englishName.toLowerCase());

      await solveGlitch(
        glitchUrl.replace("format=webp", "format=png"),
        pokemonImage
      ).then(async (result) => {
        if (result) {
          await message.channel.send({
            content: `<@716390085896962058> afd fix ${result}`,
          });
          sendLog(
            client.user.username,
            `Solved a glitch for ${pokemonName} (${englishName}) with combination ${result}`,
            "event"
          );
        }
      });
    }
  });

  client.login(token.replace(/"/g, ""));
}

async function createClients() {
  let data = process.env.TOKENS
    ? process.env.TOKENS
    : fs.readFileSync("./tokens.txt", "utf-8");
  if (!data) throw new Error(`Unable to find your tokens.`);
  const tokenData = data.split(/\s+/);
  let tokens = [];

  for (let i = 0; i < tokenData.length; i += 1) {
    if (tokenData) {
      const token = tokenData[i].trim();

      if (token) {
        tokens.push({ token });
      }
    }
  }

  for (var i = 0; i < tokens.length; i++) {
    start(tokens[i].token);
  }
}

function sendLog(username, message, type) {
  let now = new Date();

  switch (type.toLowerCase()) {
    case "info":
      console.log(
        chalk.bold.blue(`[${type.toUpperCase()}]`) +
          ` - ` +
          chalk.white.bold(date.format(now, "HH:mm")) +
          `: ` +
          message
      );
      break;
    case "event":
      console.log(
        chalk.bold.yellow(`[${type.toUpperCase()}]`) +
          ` - ` +
          chalk.white.bold(date.format(now, "HH:mm")) +
          `: ` +
          chalk.bold.red(username) +
          `: ` +
          message
      );
      break;
  }
}

async function main() {
  const figlet = require("figlet");
  const gradient = await import("gradient-string").then(
    ({ default: gradient }) => gradient
  );

  // Displaying the CatchTwo logo
  await figlet.text(
    "CatchTwo - Event Solver",
    {
      font: "Standard",
      horizontalLayout: "fitted",
      verticalLayout: "default",
    },
    async function (err, data) {
      if (err) {
        console.log("Something went wrong...");
        console.dir(err);
        return;
      }
      console.log(gradient.fruit(data));
    }
  );

  // Extract version
  const version = package.version;

  // Displaying the CatchTwo logo and welcome message
  console.log(
    chalk.bold.yellow(`[${"WELCOME".toUpperCase()}]`) +
      ` - ` +
      chalk.yellow.bold(`Welcome to the Catchtwo April Fools Event Solver!`)
  );

  // Log the current version with a nicer color
  console.log(
    chalk.bold.cyan(`[VERSION]`) +
      ` - ` +
      chalk.cyan(
        `Version ${chalk.bold(version)}, by ${chalk.bold(`@kyan0045`)}`
      )
  );

  createClients();
}

main();
