export type DoctorCheckStatus = 'pending' | 'pass' | 'warn' | 'fail' | 'skip';

export interface DoctorCheckResult {
  id: string;
  label: string;
  status: DoctorCheckStatus;
}

export interface DoctorIssue {
  severity: 'warning' | 'error';
  check: string;
  message: string;
}

export interface DoctorResult {
  checks: DoctorCheckResult[];
  issues: DoctorIssue[];
  projects: Array<{ label: string; tsconfig: string }>;
}

const CHECKS = [
  ['typescript-version', 'Checking TypeScript version'],
  ['dependencies', 'Checking installed dependencies'],
  ['tsconfig', 'Checking tsconfig.json'],
  ['external-files', 'Checking external files support'],
  ['vscode', 'Checking VSCode setup'],
  ['schema', 'Checking schema'],
] as const;

export const createDoctorResult = (): DoctorResult => ({
  checks: CHECKS.map(([id, label]) => ({ id, label, status: 'skip' })),
  issues: [],
  projects: [],
});

export class DoctorReporter {
  constructor(readonly result: DoctorResult) {}

  start(id: string): void {
    this.set(id, 'pending');
  }

  pass(id: string): void {
    this.set(id, 'pass');
  }

  fail(id: string): void {
    this.set(id, 'fail');
  }

  warn(id: string, message: string): void {
    this.set(id, 'warn');
    this.result.issues.push({ severity: 'warning', check: id, message });
  }

  private set(id: string, status: DoctorCheckStatus): void {
    const check = this.result.checks.find((entry) => entry.id === id);
    if (check) check.status = status;
  }
}
