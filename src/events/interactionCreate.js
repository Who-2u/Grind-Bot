const { Events } = require('discord.js');
const { db } = require('../database/index');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            // Handle Button Interactions
            const [action, taskId] = interaction.customId.split('_');
            
            if (!['complete', 'missed', 'snooze'].includes(action)) return;

            // Log the result
            const status = action === 'complete' ? 'completed' : action;
            const timestamp = new Date().toISOString();

            try {
                db.prepare('INSERT INTO logs (task_id, status, timestamp) VALUES (?, ?, ?)').run(taskId, status, timestamp);

                if (action === 'complete') {
                    await interaction.update({ content: '✅ Great job! Task marked as completed.', components: [] });
                } else if (action === 'missed') {
                    await interaction.update({ content: '❌ Task marked as missed. Try again next time!', components: [] });
                } else if (action === 'snooze') {
                     await interaction.update({ content: '💤 Snoozed for 15 minutes.', components: [] });
                     // TODO: Implement actual snooze logic (re-schedule)
                }

            } catch (error) {
                console.error('Error logging task:', error);
                await interaction.reply({ content: 'Failed to log task.', ephemeral: true });
            }
        }
    },
};
