const { Events, REST, Routes } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        const commands = [];
        client.commands.forEach(command => {
            commands.push(command.data.toJSON());
        });

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);

            // Use Guild commands for instant updates during dev
            if (process.env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commands },
                );
                console.log('Successfully reloaded application (/) commands for Guild.');
            } else {
                 await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commands },
                );
                console.log('Successfully reloaded application (/) commands Globally.');
            }

        } catch (error) {
            console.error(error);
        }
    },
};
