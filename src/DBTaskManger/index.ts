import tasks from "./tasks";
import { getTaskDueDate } from "../helpers";
import { Database } from "../database";
import db from "../database";

class DBTaskManager {
    private started: boolean;
    private tasks: typeof tasks;
    private queue: typeof tasks[number][];
    private unpause: any;
    private db: Database;

    constructor(db: Database) {
        this.started = false;
        this.tasks = tasks;
        this.queue = [];
        this.db = db;

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
                        await task.perform(this.db);
                    } catch (e) {
                        console.error(e);
                    }

                    const taskDueDate = getTaskDueDate(
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

    addTask(task: typeof tasks[number]) {
        this.queue.push(task);

        if (this.unpause) {
            this.unpause();
            this.unpause = undefined;
        }
    }
}

const dbTaskManager = new DBTaskManager(db);

export default dbTaskManager;