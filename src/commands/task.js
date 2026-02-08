const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../database/index');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('task')
        .setDescription('Manage your tasks')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new custom task')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the task')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('frequency')
                        .setDescription('How often to remind')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Daily', value: 'daily' },
                            { name: 'Weekly', value: 'weekly' },
                            { name: 'Monthly', value: 'monthly' },
                            { name: 'Recurring Interval', value: 'interval' }
                        ))
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Reminder time (HH:MM) - Required for Daily/Weekly/Monthly'))
                .addIntegerOption(option =>
                    option.setName('interval')
                        .setDescription('Interval in minutes - Required for Recurring Interval'))
                .addStringOption(option =>
                    option.setName('start_time')
                        .setDescription('Start time for window (HH:MM) - Optional'))
                .addStringOption(option =>
                    option.setName('end_time')
                        .setDescription('End time for window (HH:MM) - Optional'))
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Daily target count (Default: 1)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('predefined')
                .setDescription('Add a system predefined task')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Select a predefined task')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Gym', value: 'gym' },
                            { name: 'Hydrate', value: 'hydrate' },
                            { name: 'Read', value: 'read' },
                            { name: 'Meditate', value: 'meditate' },
                            { name: 'Journal', value: 'journal' },
                            { name: 'Walk', value: 'walk' }
                        ))
                 .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Reminder time (HH:MM or interval minutes)')
                        .setRequired(true))
                 .addStringOption(option =>
                    option.setName('start_time')
                        .setDescription('Start time for window (HH:MM) - Optional'))
                 .addStringOption(option =>
                    option.setName('end_time')
                        .setDescription('End time for window (HH:MM) - Optional'))
                 .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Daily target count (Default: 1)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your active tasks'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a task')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('The ID of the task to delete')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Ensure user exists in DB
        db.prepare('INSERT OR IGNORE INTO users (user_id) VALUES (?)').run(userId);

        if (subcommand === 'create') {
            const name = interaction.options.getString('name');
            const frequency = interaction.options.getString('frequency');
            let time = interaction.options.getString('time');
            const interval = interaction.options.getInteger('interval');
            const startTime = interaction.options.getString('start_time') || '00:00';
            const endTime = interaction.options.getString('end_time') || '23:59';
            const count = interaction.options.getInteger('count') || 1;

            // Validation
            if (frequency === 'interval') {
                if (!interval || interval < 1) {
                    return interaction.reply({ content: 'Please provide a valid `interval` in minutes for recurring tasks.', ephemeral: true });
                }
                // Time is not used for interval, but we can store it as null
                time = null;
            } else {
                // Fixed frequency validation
                if (!time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                    return interaction.reply({ content: `Please provide a valid \`time\` (HH:MM in 24h format) for ${frequency} tasks.`, ephemeral: true });
                }
            }

            // Window Validation
            if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
                 return interaction.reply({ content: 'Invalid start/end time format. Please use HH:MM (24h format).', ephemeral: true });
            }

            // Check limits
            const userTaskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(userId).count;
            if (userTaskCount >= config.limits.max_tasks_per_user) {
                return interaction.reply({ content: `You have reached the maximum number of tasks (${config.limits.max_tasks_per_user}).`, ephemeral: true });
            }

            try {
                db.prepare('INSERT INTO tasks (user_id, name, frequency, reminder_time, interval_minutes, start_window, end_window, target_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(userId, name, frequency, time, interval, startTime, endTime, count);
                
                let msg = `Task **${name}** created! `;
                if (frequency === 'interval') {
                    msg += `Reminding every ${interval} mins between ${startTime}-${endTime}. Target: ${count}/day.`;
                } else {
                    msg += `Reminding ${frequency} at ${time}. Target: ${count}/day.`;
                }
                await interaction.reply({ content: msg });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Failed to create task.', ephemeral: true });
            }

        } else if (subcommand === 'predefined') {
            const type = interaction.options.getString('type');
            const timeInput = interaction.options.getString('time');
            const startTime = interaction.options.getString('start_time') || '00:00';
            const endTime = interaction.options.getString('end_time') || '23:59';
            const count = interaction.options.getInteger('count') || 1;

            let frequency = 'daily';
            let reminderTime = null;
            let interval = null;

            // Check if input is HH:MM
            if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeInput)) {
                reminderTime = timeInput;
            } 
            // Check if input is a number (minutes)
            else if (/^\d+$/.test(timeInput)) {
                frequency = 'interval';
                interval = parseInt(timeInput);
                if (interval < 1) return interaction.reply({ content: 'Interval must be at least 1 minute.', ephemeral: true });
            } 
            else {
                 return interaction.reply({ content: 'Invalid format. Please use **HH:MM** (e.g., 09:00) or **minutes** (e.g., 30).', ephemeral: true });
            }

            // Window Validation
            if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
                return interaction.reply({ content: 'Invalid start/end time format. Please use HH:MM (24h format).', ephemeral: true });
           }

             const userTaskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(userId).count;
             if (userTaskCount >= config.limits.max_tasks_per_user) {
                 return interaction.reply({ content: `You have reached the maximum number of tasks (${config.limits.max_tasks_per_user}).`, ephemeral: true });
             }

            db.prepare('INSERT INTO tasks (user_id, name, type, frequency, reminder_time, interval_minutes, start_window, end_window, target_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(userId, type, 'system', frequency, reminderTime, interval, startTime, endTime, count);
            
            if (frequency === 'interval') {
                await interaction.reply({ content: `System task **${type}** added! Reminding every ${interval} mins (${startTime}-${endTime}). Target: ${count}.` });
            } else {
                await interaction.reply({ content: `System task **${type}** added! Reminding daily at ${reminderTime}. Target: ${count}.` });
            }

        } else if (subcommand === 'list') {
            const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(userId);
            if (tasks.length === 0) {
                return interaction.reply({ content: 'You have no active tasks.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Your Tasks')
                .setColor(0x0099FF);

            tasks.forEach(task => {
                let details = '';
                if (task.frequency === 'interval') {
                    details = `Every ${task.interval_minutes} mins`;
                } else {
                    details = `${task.frequency} at ${task.reminder_time}`;
                }
                embed.addFields({ name: `#${task.id} ${task.name}`, value: details, inline: false });
            });

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'delete') {
            const id = interaction.options.getInteger('id');
            const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
            
            if (result.changes > 0) {
                await interaction.reply({ content: `Task #${id} deleted.` });
            } else {
                await interaction.reply({ content: `Task #${id} not found.`, ephemeral: true });
            }
        }
    }
};
