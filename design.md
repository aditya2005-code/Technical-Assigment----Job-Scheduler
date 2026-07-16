# System Architecture & Design Document

This document outlines the detailed system design, component interactions, worker thread lifecycle, database schema, and architectural trade-offs made during the implementation of QueueCTL.

---

## 📐 Architecture Overview

QueueCTL is designed as a single-process, multi-threaded background task queue runner suitable for local CLI environments. It employs a **Layered Service-Repository Architecture** to isolate inputs (CLI), core business rules (Services), database structures (Repositories), and asynchronous execution runners (Workers).

### System Data & Control Flow
```
                     [ User CLI Input ]
                             │
                             ▼
                    ┌─────────────────┐
                    │    index.js     │ (Composition Root)
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Commands     │ (Argument Parsing & IO)
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Services     │ (Business Logic & Policies)
                    └────┬────────┬───┘
                         │        │
        ┌────────────────┘        └────────────────┐
        ▼                                          ▼
┌──────────────┐                            ┌──────────────┐
│ Repositories │                            │   Workers    │ (Processes & Threads)
└──────┬───────┘                            └──────┬───────┘
       │                                           │
       ▼                                           ▼
┌──────────────┐                            ┌──────────────┐
│  SQLite DB   │ ◄──────────────────────────┤ Executor.js  │ (Shell command spawn)
└──────────────┘                            └──────────────┘
```

---

## 🧵 Thread Concurrency Model

Rather than spawning separate Operating System processes which carry heavy startup and resource footprints, QueueCTL uses Node.js `worker_threads` for concurrency.

### Master / Worker Interaction Diagram

```
Main Thread (Parent)                          Worker Thread (Child)
┌────────────────────────┐                    ┌──────────────────────┐
│     WorkerManager      │                    │     worker.js        │
└───────────┬────────────┘                    └──────────┬───────────┘
            │                                            │
            │ 1. Spawn Worker (workerData: workerId)      │
            ├───────────────────────────────────────────►│
            │                                            │
            │ 2. Listen to status events                 │
            │◄───────────────────────────────────────────┤ (Status: IDLE)
            │                                            │
            │                                            │ (Select pending job)
            │                                            │ (Atomic lock update)
            │                                            │
            │                                            │ (Status: BUSY)
            │◄───────────────────────────────────────────┤
            │                                            │
            │                                            │ (Spawn child command)
            │                                            │ (Wait child exit)
            │                                            │ (Update DB status)
            │                                            │
            │                                            │ (Status: IDLE)
            │◄───────────────────────────────────────────┤
            │                                            │
            │ 3. Signal: SIGINT (Shutdown)               │
            ├───────────────────────────────────────────►│ (Flag: shuttingDown)
            │                                            │ (Finish current job)
            │                                            │ (Clean exit code 0)
            │◄───────────────────────────────────────────┤
```

### IPC Message Protocol:
- **`status`**: Sent by child threads to update the manager about their current state:
  - `{ type: 'status', status: 'idle', jobId: null }`
  - `{ type: 'status', status: 'busy', jobId: 'job-123' }`
- **`shutdown`**: Sent by the parent thread to signal graceful shutdown. Tells children to cease polling, complete their current job execution, and exit.

---

## 💾 Database Design

QueueCTL uses two persistent SQLite tables: `jobs` and `config`.

```
    ┌──────────────────────────────────┐
    │               jobs               │
    ├──────────────────────────────────┤
    │ id : TEXT (PK)                   │
    │ command : TEXT                   │
    │ state : TEXT                     │
    │ attempts : INTEGER               │
    │ max_retries : INTEGER            │
    │ created_at : TEXT                │
    │ updated_at : TEXT                │
    │ next_retry_at : TEXT (Nullable)  │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │              config              │
    ├──────────────────────────────────┤
    │ key : TEXT (PK)                  │
    │ value : TEXT                     │
    └──────────────────────────────────┘
```

---

## 🧠 Architectural Trade-offs & Decisions

### 1. Why SQLite instead of an In-Memory Array or Redis?
- **Persistence Across Restarts:** CLI tools are short-lived. In-memory arrays lose all data as soon as the command completes. SQLite keeps data intact permanently on the disk workspace.
- **Concurrency & WAL Mode:** SQLite's **Write-Ahead Logging (WAL)** mode allows concurrent reader/writer connections. This allows multiple worker threads to poll the database concurrently without database locks or crashes.
- **Zero Configuration Overhead:** Redis requires a running daemon on the user's host machine. SQLite runs as a local file, requiring zero installation steps or background setups.

### 2. Why child_process.spawn() over execSync() or exec()?
- **Unblocking the Event Loop:** `execSync()` is a blocking call. During command execution, the entire thread is frozen. This prevents worker threads from responding to IPC status queries or SIGINT shutdown commands. `spawn()` is fully asynchronous and unblocks Node's event loop.
- **Standard Streams Piping:** `spawn()` allows streaming stdout/stderr data chunk-by-chunk rather than loading the entire buffer into memory at once, avoiding buffer overflow crashes.

### 3. Why Optimistic Database Locking?
- Instead of using a complex distributed lock file system or table locks (which could lead to deadlocks or SQLITE_BUSY errors), we use a compare-and-swap update query:
  `UPDATE jobs SET state = 'processing', updated_at = ? WHERE id = ? AND state = 'pending'`
- Because SQLite serializes writes, only one thread will successfully modify the row (returning `changes === 1`). The losing threads receive `changes === 0` and skip the job immediately.

---

## 🚀 Future Scalability

If this queue needs to scale to support production load across **multiple distributed servers**, we would change the following adapters:
1. **Database Adapter:** Migrate from SQLite to **PostgreSQL** or **Redis (BullMQ)** to allow concurrent, network-accessible data storage.
2. **Worker Layer:** Spin up worker processes on Kubernetes nodes using a central message broker like **RabbitMQ** or **Apache Kafka** to route and process tasks.
