const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../database/index');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View your task statistics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('daily')
                .setDescription('View today\'s progress'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('weekly')
                .setDescription('View this week\'s progress'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('monthly')
                .setDescription('View this month\'s progress')),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        let startDate = new Date();
        let title = '';

        if (subcommand === 'daily') {
            startDate.setUTCHours(0, 0, 0, 0);
            title = 'Daily Statistics';
        } else if (subcommand === 'weekly') {
            const day = startDate.getUTCDay();
            const diff = startDate.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            startDate.setUTCDate(diff);
            startDate.setUTCHours(0, 0, 0, 0);
            title = 'Weekly Statistics';
        } else if (subcommand === 'monthly') {
            startDate.setUTCDate(1);
            startDate.setUTCHours(0, 0, 0, 0);
            title = 'Monthly Statistics';
        }

        const logs = db.prepare(`
            SELECT l.status, t.name, t.target_count, l.timestamp 
            FROM logs l 
            JOIN tasks t ON l.task_id = t.id 
            WHERE t.user_id = ? AND l.timestamp >= ?
        `).all(userId, startDate.toISOString());

        const total = logs.filter(l => ['completed', 'missed'].includes(l.status)).length;
        const completed = logs.filter(l => l.status === 'completed').length;
        const missed = logs.filter(l => l.status === 'missed').length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .addFields(
                { name: 'Completion Rate', value: `${rate}%`, inline: true },
                { name: 'Completed', value: `${completed}`, inline: true },
                { name: 'Missed', value: `${missed}`, inline: true }
            )
            .setColor(rate >= 80 ? 0x00FF00 : rate >= 50 ? 0xFFA500 : 0xFF0000);

        // Add detailed list for daily
        if (subcommand === 'daily' && logs.length > 0) {
            // Group logs by task to show progress for that task
            // Actually, the logs are individual entries. 
            // We want to show: "Hydrate: 3/5 ✅" or just list events.
            // The current list format is "✅ Hydrate at 10:00".
            // Let's keep that but append target info if relevant.
            
            const details = logs.map(l => {
                const icon = l.status === 'completed' ? '✅' : l.status === 'missed' ? '❌' : '💤';
                const time = new Date(l.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
                
                let line = `${icon} **${l.name}** at ${time}`;
                if (l.target_count > 1) {
                    // This is just one log entry, so we don't know "current count" easily without grouping.
                    // But we can show it's part of a multi-target task.
                    line += ` (Target: ${l.target_count})`;
                }
                return line;
            }).join('\n');
            embed.setDescription(details);
        }

        await interaction.reply({ embeds: [embed] });
    }
};
