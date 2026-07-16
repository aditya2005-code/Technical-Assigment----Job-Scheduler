export class Job {

  constructor({ id, command, state, attempts, max_retries, created_at, updated_at }) {
    this.id          = id;
    this.command     = command;
    this.state       = state;
    this.attempts    = attempts;
    this.max_retries = max_retries;
    this.created_at  = created_at;
    this.updated_at  = updated_at;
  }
}
