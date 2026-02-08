# GrindBot (Discipline Discord Bot)

A configurable Discord bot that helps users track and complete daily, monthly, and yearly tasks with automated reminders and performance analytics.

## Features
- **Task System**: Create custom tasks or use predefined ones (Gym, Hydrate, etc.).
- **Reminders**: Automated DM reminders with "Completed", "Missed", and "Snooze" buttons.
- **Analytics**: View daily, weekly, and monthly completion rates.

## Setup

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configuration**:
    - Copy `.env.example` to `.env` and fill in your Discord Bot Token, Client ID, and Guild ID (for development).
    - Edit `config.json` to adjust limits and defaults.
4.  **Run the bot**:
    ```bash
    npm start
    ```

## Commands
- `/task create [name] [frequency] [time]`: Create a new task.
- `/task predefined [type]`: Add a system task (Gym, Read, etc.).
- `/task list`: List all active tasks.
- `/task delete [id]`: Delete a task.
- `/stats [daily/weekly/monthly]`: View your progress.

## Database
The bot uses SQLite (`database.sqlite`) to store data. It is automatically created on the first run.
