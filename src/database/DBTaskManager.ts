import dbInterface from "./DBInterface";

const tasks = [
    {
        name: "Update database",
        interval: 1000 * 60 * 30,
        minDelay: 1000 * 60 * 15,
        perform: dbInterface.update.updateDatabase.bind(dbInterface.update),
    },
    {
        name: "Update guilds",
        interval: 1000 * 60 * 60 * 36,
        minDelay: 1000 * 60 * 60 * 30,
        perform: dbInterface.update.updateGuilds.bind(dbInterface.update),
    },
];

class DBTaskManager {
    private started: boolean;
    private tasks: typeof tasks;
    private queue: (typeof tasks)[number][];
    private unpause: any;

    constructor() {
        this.started = false;
        this.tasks = tasks;
        this.queue = [];

        for (const task of this.tasks) {
            this.addTask(task);
        }
    }

    async start() {
        if (!this.started) {
            this.started = true;
            while (true) {
                const task = this.queue.shift();
                if (task) {
                    console.log("Performing task:", task.name);
                    const taskStarted = new Date().getTime();
                    try {
                        await task.perform();
                    } catch (e) {
                        console.error(e);
                    }

                    const taskDueDate = this.getTaskDueDate(
                        task.interval,
                        task.minDelay,
                        taskStarted
                    );

                    setTimeout(
                        () => this.addTask(task),
                        taskDueDate.getTime() - new Date().getTime()
                    );
                    console.log("Task", task.name, "completed.");
                } else {
                    await new Promise((resolve) => {
                        this.unpause = resolve;
                    });
                }
            }
        } else {
            console.log("Db task manager is already running.");
        }
    }

    addTask(task: (typeof tasks)[number]) {
        this.queue.push(task);

        if (this.unpause) {
            this.unpause();
            this.unpause = undefined;
        }
    }

    getTaskDueDate(
        interval: number,
        minDelay: number,
        lastTaskStart: number
    ): Date {
        const now = new Date().getTime();
        let delay = now - lastTaskStart + interval;

        while (delay < minDelay) {
            delay += interval;
        }

        return new Date(now + delay);
    }
}

const dbTaskManager = new DBTaskManager();

export default dbTaskManager;
