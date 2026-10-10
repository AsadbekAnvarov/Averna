export class GroupMockError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
