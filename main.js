const fs = require('fs');
const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
let config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel]
});

function parseDelay(input) {
  const match = input.match(/^(\d+)([mhd])$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

async function generateStatsEmbed(guild) {
  const members = await guild.members.fetch();

  const totalMembers = members.size;
  const onlineMembers = members.filter(m => ['online', 'idle', 'dnd'].includes(m.presence?.status));
  const voiceMembers = members.filter(m => m.voice.channel);
  const roleMembers = members.filter(m => m.roles.cache.has(config.roleID));

  return {
    color: 0x2f3136,
    title: 'Statistiques du Serveur',
    thumbnail: {
      url: guild.iconURL({ dynamic: true })
    },
    description:
      `👥 ┃ **Membres totaux : ${totalMembers}**\n` +
      `🟢 ┃ **Membres en ligne : ${onlineMembers.size}**\n` +
      `🎧 ┃ **Membres en vocal : ${voiceMembers.size}**\n` +
      `🏷️ ┃ **Membres avec le statut : ${roleMembers.size}**`,
    timestamp: new Date(),
    footer: {
      text: 'VC Stats ┃ d34fr',
      icon_url: client.user.displayAvatarURL({ dynamic: true })
    }
  };
}

let autoIntervalRef;

function startAutoStats() {
  if (config.autoChannelID && config.autoDelayMs > 0) {
    if (autoIntervalRef) clearInterval(autoIntervalRef);

    autoIntervalRef = setInterval(async () => {
      const channel = await client.channels.fetch(config.autoChannelID).catch(() => null);
      if (channel && channel.isTextBased()) {
        const embed = await generateStatsEmbed(channel.guild);
        channel.send({ embeds: [embed] });
      }
    }, config.autoDelayMs);

    console.log(`🔁 Envoi automatique toutes les ${config.autoDelayMs / 1000 / 60} minutes.`);
  }
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setActivity('J\'guette les stats mgl', {
    type: ActivityType.Streaming,
    url: 'https://twitch.tv/d34fr'
  });

  startAutoStats();
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'vc') {
    const embed = await generateStatsEmbed(message.guild);
    message.channel.send({ embeds: [embed] });
  }

  else if (command === 'config') {
    const channelMention = message.mentions.channels.first();
    const timeArg = args.find(a => /^[0-9]+[mhd]$/i.test(a));

    if (!channelMention || !timeArg) {
      return message.reply('❌ Utilisation : `+config #salon 2h` (ou `30m`, `1d`, etc.)');
    }

    const ms = parseDelay(timeArg);
    if (!ms) {
      return message.reply('❌ Format de temps invalide. Exemples : `30m`, `2h`, `1d`.');
    }

    config.autoChannelID = channelMention.id;
    config.autoDelayMs = ms;

    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    message.reply(`✅ Statistiques automatiques activées toutes les ${timeArg} dans ${channelMention}`);

    startAutoStats();
  }

  else if (command === 'stopvc') {
    if (autoIntervalRef) {
      clearInterval(autoIntervalRef);
      autoIntervalRef = null;

      config.autoChannelID = null;
      config.autoDelayMs = 0;

      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      message.reply('🛑 Envoi automatique des statistiques arrêté.');
    } else {
      message.reply('❌ Aucun envoi automatique actif actuellement.');
    }
  }

  else if (command === 'help') {
    message.channel.send({
      embeds: [{
        color: 0x2f3136,
        title: 'Aide - Commandes disponibles',
        description:
          '**+vc** :\n Affiche les statistiques du serveur dans le salon actuel.\n' +
          'Exemple : `+vc`\n\n' +
          '**+config <salon> <temps>** :\nActive l\'envoi automatique des stats toutes les 2 heures dans #salon.\n' +
          'Exemple : `+config #Stats 1h`\n\n' +
          '**+stopvc** :\nArrête l\'envoi automatique des statistiques.\n'+
          'Exemple : `+stopvc`\n\n'+
          '**+help** :\nAffiche le Menu d\'Aide\n'+
          'Exemple : `+help`',
        footer: {
          text: 'VC Stats ┃ d34fr',
          icon_url: client.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: new Date()
      }]
    });
  }
});

client.login(config.token);
