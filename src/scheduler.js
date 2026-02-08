const cron = require('node-cron');
const { db } = require('./database/index');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

function startScheduler(client) {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        
        // 1. Timezone Handling (IST)
        const timeZone = config.defaults.timezone || 'UTC';
        const formatter = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: timeZone
        });
        const currentTime = formatter.format(now); // "HH:MM"

        console.log(`Checking reminders for ${currentTime} (${timeZone})...`);

        // 2. Fetch Tasks
        const fixedTasks = db.prepare('SELECT * FROM tasks WHERE reminder_time = ? AND (frequency != ? OR frequency IS NULL)').all(currentTime, 'interval');
        const intervalTasks = db.prepare('SELECT * FROM tasks WHERE frequency = ?').all('interval');

        // Combine candidates
        let candidates = [...fixedTasks];

        // Process Interval Logic to add to candidates
        for (const task of intervalTasks) {
            const lastRun = task.last_reminder_at ? new Date(task.last_reminder_at) : new Date(task.created_at);
            const diffMs = now - lastRun;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins >= task.interval_minutes) {
                candidates.push(task);
            }
        }

        // 3. Filter Candidates by Window & Targets
        const tasksToRemind = [];
        const todayStart = new Date(now.toLocaleString('en-US', { timeZone }));
        todayStart.setHours(0,0,0,0);
        
        // Since logs are UTC, we need to be careful. 
        // For MVP, we'll check logs from the last 18-24 hours.
        // Or better: use SQL filtered by approximate logical "today".
        
        for (const task of candidates) {
            // A. Check Time Window
            if (task.start_window && task.end_window) {
                if (currentTime < task.start_window || currentTime > task.end_window) {
                    // console.log(`Skipping task ${task.name} (Outside Window: ${task.start_window}-${task.end_window})`);
                    continue;
                }
            }

            // B. Check Target Count
            // We count COMPLETED logs since "Start of Day" (User Timezone)
            // todayStart is already set to 00:00 of the User's Timezone
            const logs = db.prepare(`
                SELECT COUNT(*) as count 
                FROM logs 
                WHERE task_id = ? 
                AND status = 'completed'
                AND timestamp >= ? 
            `).get(task.id, todayStart.toISOString());

            if (logs.count >= task.target_count) {
                // console.log(`Skipping task ${task.name} (Target Met: ${logs.count}/${task.target_count})`);
                continue;
            }

             // C. Check Daily duplicates for Fixed tasks
             if (task.frequency !== 'interval') {
                 // For fixed tasks, we also want to respect the target count logic we just added.
             }

            tasksToRemind.push({ task, currentCount: logs.count });
        }

        // 4. Send Reminders
        for (const item of tasksToRemind) {
            const { task, currentCount } = item;
            try {
                const user = await client.users.fetch(task.user_id);
                if (user) {
                    const embed = new EmbedBuilder()
                        .setTitle(`⏰ Reminder: ${task.name}`)
                        .setColor(0xFFA500);
                    
                    // Show progress in footer
                    const target = task.target_count || 1;

                    if (task.frequency === 'interval') {
                        embed.setDescription(`It's been ${task.interval_minutes} minutes! Time to grind.`);
                    } else {
                        embed.setDescription(`It's time for your ${task.frequency} task!`);
                    }
                    embed.setFooter({ text: `Progress Today: ${currentCount}/${target}` });

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`complete_${task.id}`)
                                .setLabel('Completed')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`missed_${task.id}`)
                                .setLabel('Missed')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`snooze_${task.id}`)
                                .setLabel('Snooze')
                                .setStyle(ButtonStyle.Secondary),
                        );

                    await user.send({ content: `Hey <@${user.id}>!`, embeds: [embed], components: [row] });
                    console.log(`Sent reminder to ${user.tag} for task ${task.name}`);
                    
                    // Update last_reminder_at for interval tasks
                    if (task.frequency === 'interval') {
                        db.prepare('UPDATE tasks SET last_reminder_at = ? WHERE id = ?').run(now.toISOString(), task.id);
                    }
                }
            } catch (error) {
                console.error(`Failed to send reminder to user ${task.user_id}:`, error);
            }
        }
    });
}

module.exports = { startScheduler };
